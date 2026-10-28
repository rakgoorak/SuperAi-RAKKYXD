import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { cliEnv, findExecutable } from './CliCatalog.js';

const exec = promisify(execFile);

const IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.superai',
  'output',
  '.cache',
  'release',
  'coverage',
]);

export async function listProjectFiles(root: string, query = ''): Promise<{ files: string[] }> {
  let base: string;
  try {
    base = await fs.realpath(root);
  } catch {
    base = path.resolve(root);
  }

  let files: string[] = [];

  // Try git first if repository exists
  try {
    const gitBin = findExecutable('git') || 'git';
    const output = (
      await exec(gitBin, ['--no-pager', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
        cwd: base,
        env: { ...process.env, ...cliEnv() },
        timeout: 5000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      })
    ).stdout;
    files = output.split('\0').filter(Boolean);
  } catch {
    // Fallback: directory crawl
    async function crawl(dir: string, rel: string, depth = 0): Promise<void> {
      if (depth > 6 || files.length >= 1000) return;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (IGNORED_NAMES.has(entry.name)) continue;
          if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.gitignore') continue;
          const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            await crawl(path.join(dir, entry.name), entryRel, depth + 1);
          } else if (entry.isFile()) {
            files.push(entryRel);
            if (files.length >= 1000) break;
          }
        }
      } catch {
        // skip unreadable directories
      }
    }
    await crawl(base, '', 0);
  }

  // Normalize slashes
  files = files.map((f) => f.replace(/\\/g, '/'));

  if (query.trim()) {
    const q = query.toLowerCase().trim();
    files = files.filter((f) => f.toLowerCase().includes(q));
  }

  // Sort: shorter paths and direct filename matches first
  if (query.trim()) {
    const q = query.toLowerCase().trim();
    files.sort((a, b) => {
      const aName = a.split('/').pop()?.toLowerCase() || '';
      const bName = b.split('/').pop()?.toLowerCase() || '';
      const aStarts = aName.startsWith(q) ? 0 : 1;
      const bStarts = bName.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.length - b.length;
    });
  }

  return { files: files.slice(0, 60) };
}
