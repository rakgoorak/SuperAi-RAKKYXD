// Files that must survive a power cut or a crash mid-write (the open-session list, chat history).
// A plain writeFileSync over the old file can leave it empty or cut short if the computer turns off
// before Windows / macOS flush it; the next start then could not read it and saved an empty list over it.
import fs from "node:fs";
import path from "node:path";

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Write to a temporary file, flush it to disk, then swap it in with a rename (atomic on NTFS, APFS
 * and ext4): after a crash the file is either the old version or the new one, never half of each.
 * backup: also keep the previous version as `<file>.bak`.
 */
export function writeFileSafely(file: string, data: string | Buffer, options: { backup?: boolean } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(temp, "w");
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (options.backup) try { fs.copyFileSync(file, `${file}.bak`); } catch { /* no previous version yet */ }
  // Windows: an antivirus or indexer can hold the file for a moment.
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(temp, file); return; } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 4 || !["EPERM", "EACCES", "EBUSY"].includes(code || "")) { try { fs.rmSync(temp, { force: true }); } catch {} throw error; }
      sleep(40 * (attempt + 1));
    }
  }
}

/**
 * Read a JSON file written by writeFileSafely, falling back to its `.bak`. A file that exists but
 * cannot be read is kept aside as `<file>.broken-<time>` (so it is not saved over) and undefined is
 * returned only when neither copy is readable. `missing` tells a first start from a damaged file.
 */
export function readJsonSafely(file: string): { value?: unknown; missing: boolean; recovered: boolean } {
  let missing = true;
  for (const [index, candidate] of [file, `${file}.bak`].entries()) {
    let text: string;
    try { text = fs.readFileSync(candidate, "utf8"); } catch { continue; }
    missing = false;
    try { return { value: JSON.parse(text), missing: false, recovered: index > 0 }; } catch {
      if (index === 0) try { fs.copyFileSync(candidate, `${file}.broken-${Date.now()}`); } catch {}
    }
  }
  return { missing, recovered: false };
}
