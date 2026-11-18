import { createContext, useContext, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ImageViewer } from './ImageViewer';
import { copyImageToClipboard } from '../imageActions';
import { tr } from '../i18n';

export const ImageEndpointContext = createContext<string | undefined>(undefined);

export const IMAGE_FILE = /\.(png|jpe?g|gif|webp|avif)$/i;
export const VIDEO_FILE = /\.(mp4|m4v|webm|mov|ogv)$/i;

/** Show a file the AI mentioned in Explorer / Finder: the server resolves it against the session's folder. */
export async function revealLinkedFile(endpoint: string | undefined, file: string) {
  if (!endpoint || !window.superai?.revealFile) throw new Error(tr("เปิดโฟลเดอร์ได้เฉพาะแอป Desktop"));
  const response = await fetch(`${endpoint}/locate?path=${encodeURIComponent(file)}`, { cache: 'no-store' });
  const found = await response.json().catch(() => ({}));
  if (!response.ok || typeof found.path !== 'string') throw new Error(found.error || tr("ไม่พบไฟล์นี้แล้ว"));
  await window.superai.revealFile(found.path);
}

/** Asks the server to serve a media file outside the project (same consent call as Preview's button). */
async function allowOutside(file: string) {
  const response = await fetch('/api/preview-file/allow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: file }) });
  return response.ok;
}

/**
 * A local image or video the AI linked, shown in full under its paragraph. The link itself stays
 * in the sentence. A file outside the project (often a clip the AI just made in another folder)
 * is shown too: only images and videos linked in the answer are opened this way, and only
 * displayed inside the app.
 */
export function MarkdownMedia({ path, label, kind }: { path: string; label: string; kind: 'image' | 'video' }) {
  const endpoint = useContext(ImageEndpointContext);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  if (!endpoint) return null;
  const src = `${endpoint}?path=${encodeURIComponent(path)}${attempt ? `&r=${attempt}` : ''}`;
  const data = { 'data-link-file': path };

  // The media element only says "error": ask why, and allow a file outside the project once.
  const recover = async () => {
    if (attempt) return setFailed(true);
    try {
      const response = await fetch(src, { cache: 'no-store' });
      const detail = response.status === 403 ? await response.json().catch(() => ({})) : null;
      if (detail?.outside && typeof detail.file === 'string' && await allowOutside(detail.file)) return setAttempt(1);
    } catch { /* fall through */ }
    setFailed(true);
  };

  if (failed) return <span className="markdown-media-failed" {...data}>
    {kind === 'video' ? tr("เล่นวิดีโอในแชทไม่ได้ · เปิดใน Preview") : tr("เปิดรูปในแชทไม่ได้ · เปิดใน Preview")}
  </span>;
  return <span className={`markdown-image${kind === 'video' ? ' markdown-video' : ''}`} {...data}>
    {kind === 'image'
      ? <span className="markdown-image-frame">
          <button type="button" className="markdown-image-open" aria-label={tr`ขยายรูป ${label}`} title={tr("กดดูรูปและซูม")}
            onClick={() => setOpen(true)}><img key={src} src={src} alt={label} loading="lazy" decoding="async" onError={() => void recover()} /></button>
          <button
            type="button"
            className={`markdown-image-copy-btn ${copied ? 'is-copied' : ''}`}
            title="Copy image"
            aria-label="Copy image"
            data-copy-exclude="true"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await copyImageToClipboard(src);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              } catch {}
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy image'}</span>
          </button>
        </span>
      : <video key={src} className="markdown-video-player" src={src} controls preload="metadata" playsInline aria-label={label} onError={() => void recover()} />}
    {open && <ImageViewer image={{ src, name: label }} onClose={() => setOpen(false)} />}
  </span>;
}
