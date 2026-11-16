import fs from 'node:fs/promises';
import path from 'node:path';
import { tr } from './i18n.js';

const IMAGE_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif' };
const VIDEO_TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.ogv': 'video/ogg' };
const MAX_MEDIA = 20 * 1024 * 1024;
const MAX_TEXT = 512 * 1024;

/** A file outside the project: the panel offers to open it, and only a file the user then allows is served. */
export class OutsideProjectError extends Error { readonly outside = true; constructor(readonly file: string) { super(tr("เปิดได้เฉพาะไฟล์ภายในโปรเจกต์นี้")); } }

const inside = (dir: string, target: string) => {
  const relative = path.relative(dir, target);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};

/** The real path of a requested file: inside the project, or one the user allowed (`allowed` holds real paths). */
export async function resolvePreviewPath(root: string, requested: string, allowed: ReadonlySet<string> = new Set()) {
  if (!requested || /[\u0000-\u001f]/.test(requested)) throw new Error(tr("ที่อยู่ไฟล์ไม่ถูกต้อง"));
  const rawBase = path.resolve(root);
  const base = await fs.realpath(rawBase);
  const lexical = path.resolve(base, requested);
  const lexicalInside = inside(base, lexical) || inside(rawBase, path.resolve(rawBase, requested));
  const target = await fs.realpath(lexical);
  if (!(lexicalInside && inside(base, target)) && !allowed.has(target)) throw new OutsideProjectError(target);
  const info = await fs.stat(target);
  if (!info.isFile()) throw new Error(tr("กรุณาเลือกไฟล์ ไม่ใช่โฟลเดอร์"));
  return { target, size: info.size };
}

/** Resolve the real path before reading; a linked file cannot escape its registered project unless the user allowed it. */
export async function readPreviewFile(root: string, requested: string, allowed?: ReadonlySet<string>) {
  const { target, size } = await resolvePreviewPath(root, requested, allowed);
  const extension = path.extname(target).toLowerCase();
  // Videos are streamed from disk (with seeking), so they have no size limit.
  if (VIDEO_TYPES[extension]) return { file: target, contentType: VIDEO_TYPES[extension], name: path.basename(target) };
  const media = IMAGE_TYPES[extension] || (extension === '.pdf' ? 'application/pdf' : '');
  if (size > (media ? MAX_MEDIA : MAX_TEXT)) throw new Error(media ? tr("ไฟล์ Preview ต้องมีขนาดไม่เกิน 20 MB") : tr("ไฟล์ข้อความ Preview ต้องมีขนาดไม่เกิน 512 KB"));
  const content = await fs.readFile(target);
  if (!media && content.includes(0)) throw new Error(tr("ไฟล์ชนิดนี้ยังเปิดใน Preview ไม่ได้ รองรับรูปภาพ วิดีโอ PDF และไฟล์ข้อความ"));
  return { content, contentType: media || 'text/plain; charset=utf-8', name: path.basename(target) };
}
