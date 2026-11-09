import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { cliEnv, findExecutable } from './CliCatalog.js';

const execAsync = promisify(execFile);

export interface VerificationResult {
  passed: boolean;
  exitCode: number;
  command: string;
  output: string;
  failureSummary: string;
  durationMs: number;
}

export interface SelfHealAttempt {
  attempt: number;
  verification: VerificationResult;
  fixPrompt?: string;
  fixedAt?: number;
}

export interface SelfHealResult {
  success: boolean;
  command: string;
  totalAttempts: number;
  attempts: SelfHealAttempt[];
  error?: string;
}

/** Detects default verification or test command based on project type. */
export async function detectVerificationCommand(cwd: string): Promise<string> {
  // 1. Node.js (package.json)
  const pkgPath = path.join(cwd, 'package.json');
  if (fsSync.existsSync(pkgPath)) {
    try {
      const content = await fs.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(content);
      const scripts = pkg.scripts || {};
      if (scripts.test && !scripts.test.includes('no test specified')) {
        return 'npm test';
      }
      if (scripts.build) {
        return 'npm run build';
      }
      if (scripts.check || scripts.typecheck) {
        return scripts.check ? 'npm run check' : 'npm run typecheck';
      }
    } catch {}
  }

  // 2. Python
  if (fsSync.existsSync(path.join(cwd, 'pytest.ini')) || fsSync.existsSync(path.join(cwd, 'conftest.py')) || fsSync.existsSync(path.join(cwd, 'pyproject.toml'))) {
    return 'pytest';
  }

  // 3. Rust
  if (fsSync.existsSync(path.join(cwd, 'Cargo.toml'))) {
    return 'cargo test';
  }

  // 4. Go
  if (fsSync.existsSync(path.join(cwd, 'go.mod'))) {
    return 'go test ./...';
  }

  return 'npm test';
}

/** Extract concise error clues from failed test output. */
export function extractFailureSummary(rawOutput: string, maxChars = 3500): string {
  if (!rawOutput) return 'Unknown failure';
  const lines = rawOutput.split(/\r?\n/);
  const failureLines: string[] = [];

  const errorRegex = /(error|fail|assertion|cannot find|exception|undefined|unhandled|not ok|syntaxerror|typeerror|referenceerror)/i;

  let inFailureBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (errorRegex.test(line)) {
      inFailureBlock = true;
      failureLines.push(line);
      // capture 3 lines of context around error
      for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 3); j++) {
        if (!failureLines.includes(lines[j])) failureLines.push(lines[j]);
      }
    } else if (inFailureBlock && (line.trim().startsWith('at ') || line.trim().startsWith('-->') || line.includes('│') || line.includes('^'))) {
      failureLines.push(line);
    } else {
      inFailureBlock = false;
    }
  }

  const combined = failureLines.length > 0 ? failureLines.join('\n') : lines.slice(-40).join('\n');
  return combined.length > maxChars ? combined.slice(0, maxChars) + '\n... [truncated]' : combined;
}

export class SelfHealingManager {
  /**
   * Run the test/build command once and return structured results.
   */
  async runVerification(cwd: string, customCommand?: string, timeoutMs = 90000): Promise<VerificationResult> {
    const command = (customCommand || await detectVerificationCommand(cwd)).trim();
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : 'sh';
    const shellArgs = isWindows ? ['/d', '/s', '/c', command] : ['-c', command];

    const startTime = Date.now();
    try {
      const { stdout, stderr } = await execAsync(shell, shellArgs, {
        cwd,
        env: { ...process.env, ...cliEnv(), CI: '1', FORCE_COLOR: '0' },
        timeout: timeoutMs,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      });

      const combined = (stdout + '\n' + stderr).trim();
      return {
        passed: true,
        exitCode: 0,
        command,
        output: combined,
        failureSummary: '',
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      const stdout = err.stdout ? String(err.stdout) : '';
      const stderr = err.stderr ? String(err.stderr) : '';
      const combined = (stdout + '\n' + stderr + '\n' + (err.message || '')).trim();
      const exitCode = typeof err.code === 'number' ? err.code : 1;

      return {
        passed: false,
        exitCode,
        command,
        output: combined,
        failureSummary: extractFailureSummary(combined),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run self-healing cycle: test -> feed error to agent -> wait for agent -> re-test.
   */
  async runHealingLoop(options: {
    cwd: string;
    command?: string;
    maxAttempts?: number;
    agentSend: (prompt: string) => Promise<void>;
    onProgress?: (attempt: number, max: number, stage: string, detail?: string) => void;
  }): Promise<SelfHealResult> {
    const maxAttempts = Math.min(Math.max(1, options.maxAttempts || 3), 5);
    const command = options.command || await detectVerificationCommand(options.cwd);
    const attempts: SelfHealAttempt[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      options.onProgress?.(attempt, maxAttempts, 'testing', `กำลังรันคำสั่งตรวจสอบ: ${command}`);
      const verification = await this.runVerification(options.cwd, command);

      if (verification.passed) {
        attempts.push({ attempt, verification });
        options.onProgress?.(attempt, maxAttempts, 'success', 'การทดสอบทั้งหมดผ่านสมบูรณ์ 100%');
        return {
          success: true,
          command,
          totalAttempts: attempt,
          attempts,
        };
      }

      // Verification failed
      const fixPrompt = `[Self-Healing Loop: ครั้งที่ ${attempt}/${maxAttempts}]\n` +
        `คำสั่งตรวจสอบ (${command}) ไม่ผ่าน (Exit Code ${verification.exitCode})\n` +
        `สรุปข้อผิดพลาดที่พบ:\n\`\`\`\n${verification.failureSummary}\n\`\`\`\n\n` +
        `กรุณาตรวจสอบสาเหตุของข้อผิดพลาดข้างต้น แก้ไขไฟล์โค้ดที่เกี่ยวข้อง และตรวจสอบให้แน่ใจว่าการทดสอบจะสามารถรันผ่านได้`;

      attempts.push({
        attempt,
        verification,
        fixPrompt,
        fixedAt: Date.now(),
      });

      if (attempt < maxAttempts) {
        options.onProgress?.(attempt, maxAttempts, 'fixing', `พบข้อผิดพลาด - กำลังส่งผลให้ AI แก้ไขไฟล์ (รอบ ${attempt}/${maxAttempts})`);
        try {
          await options.agentSend(fixPrompt);
        } catch (error: any) {
          return {
            success: false,
            command,
            totalAttempts: attempt,
            attempts,
            error: `ส่งคำสั่งให้ Agent แก้ไขไม่สำเร็จ: ${error.message}`,
          };
        }
      }
    }

    options.onProgress?.(maxAttempts, maxAttempts, 'failed', `ครบ ${maxAttempts} รอบแล้ว แต่การทดสอบยังไม่ผ่าน`);
    return {
      success: false,
      command,
      totalAttempts: maxAttempts,
      attempts,
      error: `ไม่สามารถแก้โค้ดให้ผ่านการทดสอบได้หลังพยายาม ${maxAttempts} ครั้ง`,
    };
  }
}
