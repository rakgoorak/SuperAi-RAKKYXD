import fs from 'node:fs/promises';
import path from 'node:path';
import { tr } from './i18n.js';

const IMAGE_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif' };
const MAX_MEDIA = 20 * 1024 * 1024;
const MAX_TEXT = 512 * 1024;

/** Resolve the real path before reading; a linked file cannot escape its registered project. */
export async function readPreviewFile(root: string, requested: string) {
  if (!requested || /[\u0000-\u001f]/.test(requested)) throw new Error(tr("ที่อยู่ไฟล์ไม่ถูกต้อง"));
  const rawBase = path.resolve(root);
  const base = await fs.realpath(rawBase);
  const inside = (dir: string, target: string) => {
    const relative = path.relative(dir, target);
    return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
  };
  const lexical = path.resolve(base, requested);
  if (!inside(base, lexical) && !inside(rawBase, path.resolve(rawBase, requested))) throw new Error(tr("เปิดได้เฉพาะไฟล์ภายในโปรเจกต์นี้"));
  const target = await fs.realpath(lexical);
  if (!inside(base, target)) throw new Error(tr("เปิดได้เฉพาะไฟล์ภายในโปรเจกต์นี้"));
  const info = await fs.stat(target);
  if (!info.isFile()) throw new Error(tr("กรุณาเลือกไฟล์ ไม่ใช่โฟลเดอร์"));
  const extension = path.extname(target).toLowerCase();
  const media = IMAGE_TYPES[extension] || (extension === '.pdf' ? 'application/pdf' : '');
  if (info.size > (media ? MAX_MEDIA : MAX_TEXT)) throw new Error(media ? tr("ไฟล์ Preview ต้องมีขนาดไม่เกิน 20 MB") : tr("ไฟล์ข้อความ Preview ต้องมีขนาดไม่เกิน 512 KB"));
  const content = await fs.readFile(target);
  if (!media && content.includes(0)) throw new Error(tr("ไฟล์ชนิดนี้ยังเปิดใน Preview ไม่ได้ รองรับรูปภาพ PDF และไฟล์ข้อความ"));
  return { content, contentType: media || 'text/plain; charset=utf-8', name: path.basename(target) };
}
