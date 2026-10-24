import { createContext, useContext, useState, type ReactNode } from 'react';
import { ImageViewer } from './ImageViewer';

export const ImageEndpointContext = createContext<string | undefined>(undefined);

/** Local image links keep their original Preview link as a fallback. */
export function MarkdownImage({ path, label, fallback }: { path: string; label: string; fallback: ReactNode }) {
  const endpoint = useContext(ImageEndpointContext);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!endpoint) return fallback;
  const src = `${endpoint}?path=${encodeURIComponent(path)}`;
  return <span className="markdown-image">
    <span className="markdown-image-caption">{fallback}<small>{failed ? 'เปิดรูปในแชทไม่ได้ · เปิดใน Preview' : 'เปิดใน Preview'}</small></span>
    {!failed && <button type="button" className="markdown-image-open" aria-label={`ขยายรูป ${label}`} title="กดดูรูปและซูม"
      onClick={() => setOpen(true)}><img src={src} alt={label} loading="lazy" decoding="async" onError={() => setFailed(true)} /></button>}
    {open && <ImageViewer image={{ src, name: label }} onClose={() => setOpen(false)} />}
  </span>;
}
