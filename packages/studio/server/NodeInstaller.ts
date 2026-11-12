import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { tr } from './i18n.js';

const execFileAsync = promisify(execFile);

export const managedNodeDir = () => path.join(os.homedir(), '.opencode-multi', 'node-v22');
export const managedNodeBin = () =>
  process.platform === 'win32' ? managedNodeDir() : path.join(managedNodeDir(), 'bin');

export interface NodeArchiveInfo {
  url: string;
  filename: string;
  sha256?: string;
  version: string;
}

export interface InstallNodeOptions {
  onLog?: (msg: string) => void;
  signal?: AbortSignal;
  targetDir?: string;
  distBaseUrl?: string;
}

export function findManagedNode(baseDir = managedNodeDir()): { node: string; npm: string } | null {
  const node = process.platform === 'win32'
    ? path.join(baseDir, 'node.exe')
    : path.join(baseDir, 'bin', 'node');
  const npm = process.platform === 'win32'
    ? path.join(baseDir, 'npm.cmd')
    : path.join(baseDir, 'bin', 'npm');

  if (fs.existsSync(node) && fs.existsSync(npm)) {
    return { node, npm };
  }
  return null;
}

export async function resolveNodeArchiveInfo(options?: {
  signal?: AbortSignal;
  distBaseUrl?: string;
}): Promise<NodeArchiveInfo> {
  const baseUrls = [
    options?.distBaseUrl || 'https://nodejs.org/dist/latest-v22.x',
    'https://npmmirror.com/mirrors/node/latest-v22.x',
  ];

  const archMap: Record<string, string> = {
    x64: 'x64',
    arm64: 'arm64',
    ia32: 'x86',
  };
  const arch = archMap[process.arch] || 'x64';

  let targetPattern: RegExp;
  if (process.platform === 'win32') {
    targetPattern = new RegExp(`^node-(v22\\.[\\d.]+)-win-${arch}\\.zip$`);
  } else if (process.platform === 'darwin') {
    targetPattern = new RegExp(`^node-(v22\\.[\\d.]+)-darwin-${arch}\\.tar\\.gz$`);
  } else {
    targetPattern = new RegExp(`^node-(v22\\.[\\d.]+)-linux-${arch}\\.tar\\.gz$`);
  }

  let lastError: Error | null = null;
  for (const base of baseUrls) {
    if (options?.signal?.aborted) throw new Error(tr("ยกเลิกการค้นหาไฟล์ Node.js"));
    try {
      const shasumsUrl = `${base.replace(/\/$/, '')}/SHASUMS256.txt`;
      const res = await fetch(shasumsUrl, {
        signal: options?.signal || AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} when fetching ${shasumsUrl}`);
      const text = await res.text();

      for (const line of text.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;
        const [sha, file] = parts;
        const match = file.match(targetPattern);
        if (match) {
          return {
            url: `${base.replace(/\/$/, '')}/${file}`,
            filename: file,
            sha256: sha,
            version: match[1],
          };
        }
      }
    } catch (e: any) {
      lastError = e;
    }
  }

  throw new Error(tr`ไม่พบแพ็กเกจ Node.js 22 LTS ที่ตรงกับระบบ (${process.platform}-${process.arch}): ${lastError?.message || 'unknown'}`);
}

async function extractArchive(
  archiveFile: string,
  destinationDir: string,
  signal?: AbortSignal,
): Promise<void> {
  fs.mkdirSync(destinationDir, { recursive: true });

  if (process.platform === 'win32') {
    // Try tar.exe first (native on Windows 10/11)
    try {
      await execFileAsync('tar.exe', ['-xf', archiveFile, '-C', destinationDir], {
        windowsHide: true,
        signal,
      });
      return;
    } catch (tarErr: any) {
      if (signal?.aborted) throw tarErr;
      // Fallback to PowerShell Expand-Archive
      await execFileAsync(
        'powershell.exe',
        [
          '-NoLogo',
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `Expand-Archive -LiteralPath '${archiveFile.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`,
        ],
        { windowsHide: true, signal },
      );
      return;
    }
  }

  // Unix (Linux/macOS)
  await execFileAsync('tar', ['-xzf', archiveFile, '-C', destinationDir], {
    windowsHide: true,
    signal,
  });
}

function findExtractedRoot(extractDir: string): string {
  const exeName = process.platform === 'win32' ? 'node.exe' : 'node';
  const directPath = process.platform === 'win32'
    ? path.join(extractDir, exeName)
    : path.join(extractDir, 'bin', exeName);

  if (fs.existsSync(directPath)) return extractDir;

  const entries = fs.readdirSync(extractDir);
  for (const entry of entries) {
    const candidate = path.join(extractDir, entry);
    try {
      if (fs.statSync(candidate).isDirectory()) {
        const subPath = process.platform === 'win32'
          ? path.join(candidate, exeName)
          : path.join(candidate, 'bin', exeName);
        if (fs.existsSync(subPath)) return candidate;
      }
    } catch {}
  }

  return extractDir;
}

export async function installNode22(
  options: InstallNodeOptions = {},
): Promise<{ node: string; npm: string; version: string }> {
  const { onLog = () => {}, signal, targetDir = managedNodeDir() } = options;

  onLog(tr("กำลังตรวจสอบรุ่น Node.js 22 LTS ล่าสุด..."));
  const archiveInfo = await resolveNodeArchiveInfo({ signal, distBaseUrl: options.distBaseUrl });
  if (signal?.aborted) throw new Error(tr("ยกเลิกการติดตั้ง Node.js"));

  const parentDir = path.dirname(targetDir);
  fs.mkdirSync(parentDir, { recursive: true });

  const stagingDir = path.join(parentDir, `.staging-node-${Date.now()}`);
  fs.mkdirSync(stagingDir, { recursive: true });

  const archivePath = path.join(stagingDir, archiveInfo.filename);
  const extractDir = path.join(stagingDir, 'extracted');

  try {
    onLog(tr`กำลังดาวน์โหลด Node.js ${archiveInfo.version} (${archiveInfo.filename})...`);
    const res = await fetch(archiveInfo.url, { signal });
    if (!res.ok) throw new Error(tr`ดาวน์โหลดไม่สำเร็จ (HTTP ${res.status}) จาก ${archiveInfo.url}`);

    const totalBytes = Number(res.headers.get('content-length') || 0);
    let downloadedBytes = 0;
    const sha = crypto.createHash('sha256');
    const fileStream = fs.createWriteStream(archivePath);

    if (!res.body) throw new Error(tr("ไม่มีข้อมูลเนื้อหาจากเซิร์ฟเวอร์"));
    const bodyStream = Readable.fromWeb(res.body as any);

    let lastProgressLog = Date.now();
    bodyStream.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      sha.update(chunk);
      const now = Date.now();
      if (now - lastProgressLog > 1000) {
        lastProgressLog = now;
        const mb = (downloadedBytes / (1024 * 1024)).toFixed(1);
        const totalMb = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '?';
        onLog(tr`ดาวน์โหลด Node.js: ${mb}MB / ${totalMb}MB`);
      }
    });

    await pipeline(bodyStream, fileStream);

    if (archiveInfo.sha256) {
      const actualSha = sha.digest('hex');
      if (actualSha.toLowerCase() !== archiveInfo.sha256.toLowerCase()) {
        throw new Error(tr`ไฟล์ Node.js ไม่สมบูรณ์ (SHA256 checksum ไม่ตรง: คาดหวัง ${archiveInfo.sha256}, ได้รับ ${actualSha})`);
      }
      onLog(tr("ตรวจสอบความสมบูรณ์ไฟล์ (SHA256) ถูกต้อง"));
    }

    onLog(tr("กำลังแตกไฟล์ Node.js 22 LTS..."));
    await extractArchive(archivePath, extractDir, signal);

    const rootDir = findExtractedRoot(extractDir);
    const verified = findManagedNode(rootDir);
    if (!verified) {
      throw new Error(tr("ไม่พบ node executable ในไฟล์ที่แตกออกมา"));
    }

    onLog(tr("กำลังติดตั้งเข้าโฟลเดอร์ของ SuperAi..."));
    // Replace targetDir with rootDir
    if (fs.existsSync(targetDir)) {
      const backupDir = path.join(parentDir, `.node-old-${Date.now()}`);
      try {
        fs.renameSync(targetDir, backupDir);
        fs.rmSync(backupDir, { recursive: true, force: true });
      } catch {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    }

    try {
      fs.renameSync(rootDir, targetDir);
    } catch {
      // Fallback: copy recursively if rename fails across partitions
      fs.cpSync(rootDir, targetDir, { recursive: true });
    }

    const finalInstalled = findManagedNode(targetDir);
    if (!finalInstalled) {
      throw new Error(tr("ติดตั้งเสร็จสิ้นแต่ไม่พบ Node.js ในโฟลเดอร์ปลายทาง"));
    }

    // Verify version by running it
    const output = execFileSync(finalInstalled.node, ['-v'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    }).trim();

    onLog(tr`Node.js ${output} ติดตั้งสำเร็จและพร้อมใช้งานทันที!`);
    return {
      node: finalInstalled.node,
      npm: finalInstalled.npm,
      version: output,
    };
  } finally {
    // Clean up staging directory
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch {}
  }
}
