/**
 * How each CLI in a terminal pane receives an attached file. Checked against the
 * installed CLIs on Windows:
 * - Claude Code / OpenCode: a pasted (bracketed) image path becomes "[Image #1]";
 *   other paths stay as text the CLI reads with its tools. Antigravity (agy) is
 *   treated the same way (not installed here, so not live-tested).
 * - Codex: reads images from the OS clipboard on Ctrl+V. Typed paths lose ":" and
 *   "\" through ConPTY on some keyboard layouts, so images go via the clipboard
 *   and other files are referred to by their path relative to the project.
 */
export type AttachMode = 'path' | 'clipboard';

export function attachMode(agentType: string): AttachMode {
  return agentType === 'codex' ? 'clipboard' : 'path';
}

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const ACCEPT_ATTACHMENTS = [...IMAGE_TYPES, 'application/pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf'].join(',');
export const UNSUPPORTED_ATTACHMENT = 'รองรับเฉพาะรูป PNG, JPG, GIF, WEBP และไฟล์ PDF กรุณาแปลงไฟล์แล้วลองใหม่';

export function isSupportedImage(file: { type: string; name: string }): boolean {
  return IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
}

export function isPdf(file: { type: string; name: string }): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isSupportedAttachment(file: { type: string; name: string }): boolean {
  return isSupportedImage(file) || isPdf(file);
}

/** Path text for a CLI: quoted when needed, followed by a space so typing can continue. */
export function formatPath(absolutePath: string): string {
  return /[\s"'&()]/.test(absolutePath) ? `"${absolutePath}" ` : `${absolutePath} `;
}

/** Image/PDF files from a paste event; extracts image/PDF files reliably even if clipboard metadata includes text. */
export function pastedFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const found: File[] = [];
  if (data.items && data.items.length) {
    for (const item of Array.from(data.items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && isSupportedAttachment(file)) found.push(file);
      }
    }
  }
  if (!found.length && data.files && data.files.length) {
    for (const file of Array.from(data.files)) {
      if (isSupportedAttachment(file)) found.push(file);
    }
  }
  return found;
}

export interface SavedAttachment {
  path: string;
  /** Relative to the project folder, with forward slashes. */
  relativePath: string;
  name: string;
  size: number;
}

/** Saves a file into the project's .superai/attachments via the given endpoint. */
export async function uploadAttachment(url: string, file: File): Promise<SavedAttachment> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
  } catch {
    throw new Error('เชื่อมต่อแอปไม่ได้ขณะบันทึกไฟล์แนบ กรุณาลองอีกครั้ง');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `บันทึกไฟล์แนบไม่สำเร็จ (${response.status}) กรุณาลองใหม่`);
  return body;
}

/** Rough PDF page count from the page objects; undefined when it can't tell. */
export async function pdfPageCount(file: File): Promise<number | undefined> {
  if (file.size > 20 * 1024 * 1024) return undefined;
  const text = new TextDecoder('latin1').decode(await file.arrayBuffer());
  const pages = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length;
  return pages || undefined;
}
