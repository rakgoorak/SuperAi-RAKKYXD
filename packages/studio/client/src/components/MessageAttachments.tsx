import { useState } from 'react';
import { ImageOff, Paperclip } from 'lucide-react';
import { ImageViewer } from './ImageViewer';
import '../message-attachments.css';
import { tr } from '../i18n';

type Image = { src: string; name: string };

function Thumbnail({ image, onOpen }: { image: Image; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  return <button type="button" className="message-image-thumb" onClick={onOpen} aria-label={tr`ดูรูป ${image.name}`} title={image.name}>
    {failed ? <span className="message-image-missing"><ImageOff size={24} /><span>{tr("เปิดรูปไม่ได้")}</span></span>
      : <img src={image.src} alt={image.name} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    <span className="message-image-name">{image.name}</span>
  </button>;
}

/** Saved files are loaded from the conversation's own project/session, including after reload. */
export function MessageAttachments({ paths, endpoint }: { paths?: string[]; endpoint: string }) {
  const [selected, setSelected] = useState<Image | null>(null);
  return <>
    {!!paths?.length && <div className="message-attachments" aria-label={tr("ไฟล์แนบในข้อความ")}>
      {paths.map((file, index) => {
        const name = file.split(/[\\/]/).at(-1) || file;
        if (!/\.(?:png|jpe?g|gif|webp|avif)$/i.test(name)) return <span className="message-file" key={`${file}-${index}`} title={file}><Paperclip size={13} />{name}</span>;
        // Older Code transcripts retain only the basename, while Agent/Chat retain the full path.
        const savedPath = /[\\/]/.test(file) ? file : `.superai/attachments/${file}`;
        const image = { src: `${endpoint}?path=${encodeURIComponent(savedPath)}`, name };
        return <Thumbnail key={`${endpoint}-${file}-${index}`} image={image} onOpen={() => setSelected(image)} />;
      })}
    </div>}
    {selected && <ImageViewer image={selected} onClose={() => setSelected(null)} />}
  </>;
}
