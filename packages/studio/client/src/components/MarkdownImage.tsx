import { createContext, useContext, useState, type ReactNode } from 'react';
import { ImageViewer } from './ImageViewer';
import { tr } from '../i18n';

export const ImageEndpointContext = createContext<string | undefined>(undefined);

export const IMAGE_FILE = /\.(png|jpe?g|gif|webp|avif)$/i;
export const VIDEO_FILE = /\.(mp4|m4v|webm|mov|ogv)$/i;

type Problem = '' | 'outside' | 'failed';

/**
 * A local image or video the AI linked, shown right in the chat. The original link stays as the
 * caption (it opens the file in Preview). A file outside the project needs one click first,
 * the same "open this file" consent as the Preview panel.
 */
export function MarkdownMedia({ path, label, fallback, kind }: { path: string; label: string; fallback: ReactNode; kind: 'image' | 'video' }) {
  const endpoint = useContext(ImageEndpointContext);
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<Problem>('');
  const [outsideFile, setOutsideFile] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  if (!endpoint) return fallback;
  const src = `${endpoint}?path=${encodeURIComponent(path)}${attempt ? `&r=${attempt}` : ''}`;

  // The media element only says "error"; ask the server why (outside the project, or missing).
  const explain = async () => {
    try {
      const response = await fetch(src, { method: 'HEAD', cache: 'no-store' });
      if (response.status !== 403) return setProblem('failed');
      const detail = await fetch(src, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
      if (detail?.outside && typeof detail.file === 'string') { setOutsideFile(detail.file); setProblem('outside'); }
      else setProblem('failed');
    } catch { setProblem('failed'); }
  };
  const allow = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/preview-file/allow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: outsideFile }) });
      if (!response.ok) throw new Error();
      setProblem('');
      setAttempt(n => n + 1);
    } catch { setProblem('failed'); }
    finally { setBusy(false); }
  };

  const note = problem === 'failed'
    ? (kind === 'video' ? tr("เล่นวิดีโอในแชทไม่ได้ · เปิดใน Preview") : tr("เปิดรูปในแชทไม่ได้ · เปิดใน Preview"))
    : tr("เปิดใน Preview");
  return <span className={`markdown-image${kind === 'video' ? ' markdown-video' : ''}`}>
    <span className="markdown-image-caption">{fallback}<small>{note}</small></span>
    {problem === 'outside' && <span className="markdown-media-outside" role="group" aria-label={tr("ไฟล์นี้อยู่นอกโปรเจกต์")}>
      <span><strong>{tr("ไฟล์นี้อยู่นอกโปรเจกต์")}</strong><small title={outsideFile}>{outsideFile}</small></span>
      <button type="button" className="primary" disabled={busy} onClick={() => void allow()}>{kind === 'video' ? tr("แสดงวิดีโอนี้") : tr("แสดงรูปนี้")}</button>
    </span>}
    {!problem && kind === 'image' && <button type="button" className="markdown-image-open" aria-label={tr`ขยายรูป ${label}`} title={tr("กดดูรูปและซูม")}
      onClick={() => setOpen(true)}><img key={src} src={src} alt={label} loading="lazy" decoding="async" onError={() => void explain()} /></button>}
    {!problem && kind === 'video' && <video key={src} className="markdown-video-player" src={src} controls preload="metadata" playsInline
      aria-label={label} onError={() => void explain()} />}
    {open && <ImageViewer image={{ src, name: label }} onClose={() => setOpen(false)} />}
  </span>;
}

