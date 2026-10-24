export type PreviewTarget = { kind: 'web'; url: string } | { kind: 'file'; path: string; line?: number } | { kind: 'artifact'; title: string; language: string; content: string };
export interface PreviewRequest { id: string; workspaceId?: string; target: PreviewTarget; }

export function openArtifact(title: string, language: string, content: string) {
  window.dispatchEvent(new CustomEvent('superai:open-artifact', { detail: { title, language, content } }));
}

/** Classify links before they reach either Chromium or the project file endpoint. */
export function parsePreviewTarget(input: string): PreviewTarget {
  let value = input.trim().replace(/^<|>$/g, '');
  if (!value || /[\u0000-\u001f]/.test(value)) throw new Error('ลิงก์ไม่ถูกต้อง');
  if (/^(?:https?:\/\/|www\.)/i.test(value)) {
    const url = new URL(/^www\./i.test(value) ? `https://${value}` : value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('ใช้ได้เฉพาะ URL http/https ที่ไม่มีชื่อผู้ใช้หรือรหัสผ่าน');
    return { kind: 'web', url: url.href };
  }
  if (/^file:/i.test(value)) {
    const file = new URL(value);
    if (file.host && file.host !== 'localhost') throw new Error('เปิดได้เฉพาะไฟล์ภายในโปรเจกต์นี้');
    value = file.pathname + file.hash;
  }
  if (/^\/[a-z]:[\\/]/i.test(value)) value = value.slice(1);
  if (/^[a-z][\w+.-]*:/i.test(value) && !/^[a-z]:[\\/]/i.test(value)) throw new Error('ลิงก์ชนิดนี้ไม่รองรับ เปิดได้เฉพาะเว็บไซต์หรือไฟล์ในโปรเจกต์');
  try { value = decodeURIComponent(value); } catch { throw new Error('ที่อยู่ไฟล์ไม่ถูกต้อง'); }
  if (/[\u0000-\u001f]/.test(value) || value.startsWith('#') || value.startsWith('//') || value.startsWith('\\\\')) throw new Error('ที่อยู่ไฟล์ไม่ถูกต้อง');
  const location = /(?::(\d+)(?::\d+)?|#L(\d+)(?:C\d+)?)$/.exec(value);
  const line = location ? Number(location[1] || location[2]) : undefined;
  if (location) value = value.slice(0, location.index);
  return { kind: 'file', path: value, ...(line && Number.isSafeInteger(line) ? { line } : {}) };
}

export function openPreviewLink(href: string) {
  window.dispatchEvent(new CustomEvent('superai:open-preview-link', { detail: { href } }));
}
