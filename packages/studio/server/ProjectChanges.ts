import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { cliEnv, findExecutable } from './CliCatalog.js';
const exec = promisify(execFile);
async function git(root: string, args: string[]) {
  return (await exec(findExecutable('git') || 'git', ['--no-pager', ...args], { cwd: root, env: cliEnv(), timeout: 10000, maxBuffer: 2 * 1024 * 1024, windowsHide: true })).stdout;
}
export async function projectChanges(root: string) {
  await git(root, ['rev-parse', '--show-toplevel']);
  const head = await git(root, ['rev-parse', '--verify', 'HEAD']).then(() => true, () => false);
  const changed = await git(root, head ? ['diff', '--no-ext-diff', '--no-textconv', '--relative', '--name-only', '-z', 'HEAD', '--'] : ['ls-files', '-z', '--cached']);
  const others = await git(root, ['ls-files', '--others', '--exclude-standard', '-z']);
  const files = [...new Set((changed + others).split('\0').filter(Boolean))];
  return { files: files.slice(0, 200), truncated: files.length > 200 };
}
export async function projectFile(root: string, name: string) {
  if (!name || name.includes('\0') || path.isAbsolute(name)) throw new Error('ที่อยู่ไฟล์ไม่ถูกต้อง');
  const base = await fs.realpath(root);
  const target = path.resolve(base, name);
  const inside = (file: string) => { const rel = path.relative(base, file); return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };
  if (!inside(target)) throw new Error('ไฟล์ต้องอยู่ในโปรเจกต์นี้');
  const real = await fs.realpath(target).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
  // For deleted files, validate their existing parent to exclude directory symlinks too.
  let ancestor = path.dirname(target);
  let resolved = real;
  while (!resolved) {
    resolved = await fs.realpath(ancestor).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
    if (ancestor === path.dirname(ancestor) && !resolved) throw new Error('ไม่พบโฟลเดอร์โปรเจกต์');
    ancestor = path.dirname(ancestor);
  }
  if (!inside(resolved)) throw new Error('ไฟล์ต้องอยู่ในโปรเจกต์นี้');
  let content = '';
  if (real) {
    const stat = await fs.stat(real);
    if (!stat.isFile() || stat.size > 256 * 1024) throw new Error('แสดงได้เฉพาะไฟล์ข้อความไม่เกิน 256 KB');
    const bytes = await fs.readFile(real);
    if (bytes.includes(0)) throw new Error('ไฟล์ไบนารีไม่รองรับการแสดงข้อความ');
    content = bytes.toString('utf8');
  }
  const diff = await git(base, ['diff', '--no-ext-diff', '--no-textconv', 'HEAD', '--', target]).catch(() => '');
  return { name, content, diff, deleted: !real };
}
