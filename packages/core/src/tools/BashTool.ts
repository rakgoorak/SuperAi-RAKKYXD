import { spawn } from 'node:child_process';
import { BaseTool, ExecutionContext, ToolResult } from './BaseTool.js';

export interface BashArgs {
  command: string;
  timeoutMs?: number;
}

export class BashTool extends BaseTool {
  name = 'bash';
  description = 'Execute a shell/terminal command in the workspace. Supports streaming output and timeout.';
  parameters = {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute.',
      },
      timeoutMs: {
        type: 'number',
        description: 'Command timeout in milliseconds (default 120,000ms).',
      },
    },
    required: ['command'],
  };

  async execute(args: BashArgs, context: ExecutionContext = { cwd: process.cwd() }): Promise<ToolResult> {
    const { command, timeoutMs = 120_000 } = args;
    const cwd = context?.cwd || process.cwd();
    const isWindows = process.platform === 'win32';

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const shell = isWindows ? 'powershell.exe' : 'bash';
      const shellArgs = isWindows ? ['-NoProfile', '-Command', command] : ['-c', command];

      const child = spawn(shell, shellArgs, {
        cwd,
        env: { ...process.env, ...context.env },
        windowsHide: true,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        stdout += text;
        if (context.onStream) {
          context.onStream(text);
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        stderr += text;
        if (context.onStream) {
          context.onStream(text);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          output: stdout,
          error: `Process execution error: ${err.message}`,
        });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          resolve({
            success: false,
            output: stdout,
            error: `Command timed out after ${timeoutMs}ms. Output before timeout:\n${stdout}`,
          });
          return;
        }

        const combined = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
        resolve({
          success: code === 0,
          output: combined || `Command finished with exit code ${code}`,
          metadata: { exitCode: code },
          error: code !== 0 ? `Command exited with non-zero code ${code}` : undefined,
        });
      });
    });
  }
}
