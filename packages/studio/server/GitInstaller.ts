import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const execFileAsync = promisify(execFile);

// Claude Code on Windows needs Git Bash. PortableGit installs per-user, no admin.
export const managedGitDir = () => path.join(os.homedir(), '.opencode-multi', 'git');
export const managedGitCmd = () => path.join(managedGitDir(), 'cmd');

export interface GitStatus {
  required: boolean;
  installed: boolean;
  version: string | null;
  gitPath: string | null;
  bashPath: string | null;
  isManaged: boolean;
}

// Git for Windows layout: <root>\cmd\git.exe and <root>\bin\bash.exe.
export function bashForGit(gitPath: string): string | null {
  const root = path.resolve(path.dirname(gitPath), '..');
  for (const candidate of [path.join(root, 'bin', 'bash.exe'), path.join(root, 'usr', 'bin', 'bash.exe')])
    if (fs.existsSync(candidate)) return candidate;
  return null;
}

export function getGitStatus(
  find: (command: string) => string | null,
  version: (git: string) => string = (git) =>
    execFileSync(git, ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim(),
  platform = process.platform,
): GitStatus {
  const required = platform === 'win32';
  const git = find('git');
  if (!git) return { required, installed: false, version: null, gitPath: null, bashPath: null, isManaged: false };
  let ver: string | null = null;
  try { ver = version(git).replace(/^git version\s*/i, '') || null; } catch {}
  const bash = platform === 'win32' ? process.env.CLAUDE_CODE_GIT_BASH_PATH && fs.existsSync(process.env.CLAUDE_CODE_GIT_BASH_PATH) ? process.env.CLAUDE_CODE_GIT_BASH_PATH : bashForGit(git) : null;
  return {
    required,
    installed: platform === 'win32' ? !!bash : true,
    version: ver,
    gitPath: git,
    bashPath: bash,
    isManaged: path.resolve(git).toLowerCase().startsWith(path.resolve(managedGitDir()).toLowerCase()),
  };
}

export interface GitAsset { url: string; filename: string; sha256?: string; version: string }

export function pickPortableGitAsset(release: any, arch = process.arch): GitAsset {
  const suffix = arch === 'arm64' ? 'arm64' : '64-bit';
  const asset = (release?.assets || []).find((a: any) => new RegExp(`^PortableGit-[\\d.]+-${suffix}\\.7z\\.exe$`).test(a.name));
  if (!asset) throw new Error(`ไม่พบ PortableGit สำหรับ ${suffix} ใน release ล่าสุดของ Git for Windows`);
  const digest = typeof asset.digest === 'string' && asset.digest.startsWith('sha256:') ? asset.digest.slice(7) : undefined;
  return { url: asset.browser_download_url, filename: asset.name, sha256: digest, version: String(release.tag_name || '').replace(/^v/, '') };
}

export async function installPortableGit(options: { onLog?: (msg: string) => void; signal?: AbortSignal; targetDir?: string } = {}) {
  if (process.platform !== 'win32') throw new Error('ติดตั้ง Git อัตโนมัติรองรับเฉพาะ Windows บน macOS ให้ใช้ xcode-select --install');
  const { onLog = () => {}, signal, targetDir = managedGitDir() } = options;
  onLog('กำลังตรวจรุ่นล่าสุดของ Git for Windows...');
  const response = await fetch('https://api.github.com/repos/git-for-windows/git/releases/latest', {
    signal: signal || AbortSignal.timeout(20000), headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SuperAi-RAKKYXD' },
  });
  if (!response.ok) throw new Error(`อ่านข้อมูล Git for Windows ไม่ได้ (HTTP ${response.status})`);
  const asset = pickPortableGitAsset(await response.json());
  const parent = path.dirname(targetDir);
  const staging = path.join(parent, `.staging-git-${Date.now()}`);
  fs.mkdirSync(staging, { recursive: true });
  try {
    const archive = path.join(staging, asset.filename);
    onLog(`กำลังดาวน์โหลด ${asset.filename}...`);
    const res = await fetch(asset.url, { signal });
    if (!res.ok || !res.body) throw new Error(`ดาวน์โหลด Git ไม่สำเร็จ (HTTP ${res.status})`);
    const total = Number(res.headers.get('content-length') || 0);
    const sha = crypto.createHash('sha256');
    let received = 0, last = 0;
    const body = Readable.fromWeb(res.body as any);
    body.on('data', (chunk: Buffer) => {
      received += chunk.length; sha.update(chunk);
      if (Date.now() - last > 1000) { last = Date.now(); onLog(`ดาวน์โหลด Git: ${(received / 1048576).toFixed(1)}MB / ${total ? (total / 1048576).toFixed(1) : '?'}MB`); }
    });
    await pipeline(body, fs.createWriteStream(archive));
    if (asset.sha256) {
      const actual = sha.digest('hex');
      if (actual.toLowerCase() !== asset.sha256.toLowerCase()) throw new Error('ไฟล์ Git ไม่สมบูรณ์ (SHA256 ไม่ตรง) กรุณาลองใหม่');
      onLog('ตรวจ SHA256 ถูกต้อง');
    }
    onLog('กำลังแตกไฟล์ Git...');
    const extracted = path.join(staging, 'git');
    // 7-Zip self-extractor: -o target, -y no prompts.
    await execFileAsync(archive, [`-o${extracted}`, '-y'], { windowsHide: true, signal, timeout: 600000 });
    if (!fs.existsSync(path.join(extracted, 'cmd', 'git.exe')) || !bashForGit(path.join(extracted, 'cmd', 'git.exe')))
      throw new Error('แตกไฟล์แล้วแต่ไม่พบ git.exe หรือ bash.exe');
    if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
    try { fs.renameSync(extracted, targetDir); } catch { fs.cpSync(extracted, targetDir, { recursive: true }); }
    const git = path.join(targetDir, 'cmd', 'git.exe');
    const version = execFileSync(git, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 10000 }).trim();
    onLog(`${version} พร้อมใช้งาน`);
    return { git, bash: bashForGit(git)!, version };
  } finally {
    try { fs.rmSync(staging, { recursive: true, force: true }); } catch {}
  }
}
