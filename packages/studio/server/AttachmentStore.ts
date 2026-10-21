import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** Files the AI CLIs can read, detected from the file header (not the claimed type). */
const SIGNATURES: { ext: string; test: (b: Buffer) => boolean }[] = [
  { ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "gif", test: (b) => /^GIF8[79]a/.test(b.subarray(0, 6).toString("latin1")) },
  { ext: "webp", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { ext: "pdf", test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
];
const UNSUPPORTED = "รองรับเฉพาะรูป PNG, JPG, GIF, WEBP และไฟล์ PDF กรุณาแปลงไฟล์แล้วลองใหม่";

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const ATTACHMENT_DIR = path.join(".superai", "attachments");

export class AttachmentError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function attachmentExtension(data: Buffer): string | undefined {
  return SIGNATURES.find((s) => s.test(data))?.ext;
}

export interface SavedAttachment {
  path: string;
  /** Path relative to the session folder, with forward slashes. */
  relativePath: string;
  name: string;
  size: number;
}

/**
 * Saves a pasted/dropped image or PDF under `<root>/.superai/attachments/` with a
 * new, unique name. Never overwrites or removes existing files.
 */
export function saveAttachment(root: string, data: Buffer, now = new Date()): SavedAttachment {
  if (!data.length) throw new AttachmentError("ไม่พบข้อมูลไฟล์ ลองคัดลอกหรือเลือกไฟล์ใหม่แล้วลองอีกครั้ง");
  if (data.length > MAX_ATTACHMENT_BYTES)
    throw new AttachmentError("ไฟล์ใหญ่เกิน 20 MB กรุณาย่อรูปหรือแยกไฟล์ PDF ให้เล็กลงแล้วลองใหม่", 413);
  const ext = attachmentExtension(data);
  if (!ext) throw new AttachmentError(UNSUPPORTED, 415);
  const dir = path.join(root, ATTACHMENT_DIR);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const name = `${ext === "pdf" ? "document" : "image"}-${stamp}-${crypto.randomBytes(3).toString("hex")}.${ext}`;
  const file = path.join(dir, name);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, data, { flag: "wx" });
  } catch (error: any) {
    throw new AttachmentError(
      `บันทึกไฟล์แนบไม่สำเร็จ (${error.code || error.message}) ตรวจว่าโฟลเดอร์ ${dir} เขียนไฟล์ได้และพื้นที่ดิสก์ยังเหลือ`,
      500,
    );
  }
  return { path: file, relativePath: path.relative(root, file).split(path.sep).join("/"), name, size: data.length };
}

/**
 * Checks paths sent back by the client: only files this app saved into the
 * project's attachment folder are passed on to an AI CLI.
 */
export function resolveAttachments(root: string, paths: unknown): string[] {
  if (paths === undefined) return [];
  if (!Array.isArray(paths) || paths.length > 20) throw new AttachmentError("แนบไฟล์ได้ครั้งละไม่เกิน 20 ไฟล์");
  const dir = path.resolve(root, ATTACHMENT_DIR);
  return paths.map((value) => {
    const file = typeof value === "string" ? path.resolve(value) : "";
    if (!file || path.dirname(file) !== dir || !fs.existsSync(file))
      throw new AttachmentError("ไม่พบไฟล์แนบในโปรเจกต์แล้ว กรุณาแนบไฟล์ใหม่อีกครั้ง");
    return file;
  });
}
