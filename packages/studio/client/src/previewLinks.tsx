import type { ReactNode } from 'react';

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

/** Open any web link in the system's default browser (via Electron shell.openExternal or window.open). */
export function openExternalLink(url: string) {
  try {
    let clean = url.trim();
    if (/^www\./i.test(clean)) clean = `https://${clean}`;
    if (window.superai?.openExternal) {
      void window.superai.openExternal(clean);
    } else {
      window.open(clean, '_blank', 'noopener,noreferrer');
    }
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/** Check if text at cursor position is a URL */
export function findUrlAtPosition(text: string, pos: number): string | null {
  if (!text || pos < 0 || pos > text.length) return null;
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'()[\]{}]+/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (pos >= start && pos <= end) {
      let url = match[0].replace(/[.,;:!?)\]}>"']+$/, '');
      if (/^www\./i.test(url)) url = `https://${url}`;
      return url;
    }
  }
  return null;
}

/** Extract all URLs from a text string */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'()[\]{}]+/gi;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches.map(u => {
    let clean = u.replace(/[.,;:!?)\]}>"']+$/, '');
    return /^www\./i.test(clean) ? `https://${clean}` : clean;
  })));
}

/** Render text with all URLs transformed into clickable and Ctrl+Clickable links */
export function renderTextWithLinks(text: string, className = "chat-user-link"): ReactNode {
  if (!text) return null;
  const urlRegex = /((?:https?:\/\/|www\.)[^\s<>"'()[\]{}]+)/gi;
  const parts = text.split(urlRegex);
  if (parts.length <= 1) return text;

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      const cleanUrl = part.replace(/[.,;:!?)\]}>"']+$/, '');
      const trailing = part.slice(cleanUrl.length);
      const href = /^www\./i.test(cleanUrl) ? `https://${cleanUrl}` : cleanUrl;
      return (
        <span key={index}>
          <a
            href={href}
            className={className}
            title={`คลิกหรือ Ctrl+Click เพื่อเปิดลิงก์: ${cleanUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              openExternalLink(href);
            }}
          >
            {cleanUrl}
          </a>
          {trailing}
        </span>
      );
    }
    return part;
  });
}
