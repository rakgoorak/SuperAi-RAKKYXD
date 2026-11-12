import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cliEnv, findExecutable } from './CliCatalog.js';
import { workingContext } from './WorkingContext.js';
import { tr } from './i18n.js';
const exec = promisify(execFile);
const git = (cwd: string, args: string[]) => exec(findExecutable('git') || 'git', args, { cwd, env: { ...process.env, ...cliEnv() }, windowsHide: true, timeout: 10000, maxBuffer: 512 * 1024 });

export async function branchChoices(cwd: string) {
  const context = await workingContext(cwd);
  if (context.git !== 'ready') throw new Error(context.git === 'none' ? tr("โฟลเดอร์นี้ยังไม่ได้ใช้ Git") : tr("อ่าน Git ไม่ได้ ตรวจว่าโฟลเดอร์และ Git พร้อมใช้งาน"));
  const { stdout } = await git(cwd, ['for-each-ref', '--format=%(refname:short)', '--sort=refname', 'refs/heads/']);
  const branches = stdout.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
  if (context.branch && !branches.includes(context.branch)) branches.unshift(context.branch);
  return { ...context, branches };
}

export async function selectBranch(cwd: string, name: string) {
  const choices = await branchChoices(cwd);
  if (!choices.branches.includes(name)) throw new Error(tr("ไม่พบ branch นี้ในโฟลเดอร์ที่เลือก กรุณาโหลดรายการใหม่"));
  if (choices.branch === name) return choices;
  const { stdout } = await git(cwd, ['status', '--porcelain', '--untracked-files=normal']);
  if (stdout.trim()) throw new Error(tr("มีไฟล์ที่ยังไม่ได้ commit กรุณาจัดการการเปลี่ยนแปลงก่อนสลับ branch"));
  // No force, stash, reset or automatic commit. Git also rejects branches checked out elsewhere.
  await git(cwd, ['switch', '--no-guess', name]);
  return branchChoices(cwd);
}
