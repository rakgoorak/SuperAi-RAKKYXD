import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageOff, Paperclip, X } from 'lucide-react';
import '../message-attachments.css';

type Image = { src: string; name: string };

function ImagePreview({ image, onClose }: { image: Image; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const trigger = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    window.dispatchEvent(new CustomEvent('superai:image-overlay', { detail: true }));
    return () => {
      element.close();
      window.dispatchEvent(new CustomEvent('superai:image-overlay', { detail: false }));
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog ref={dialog} className="message-image-preview" aria-label={`ดูรูป ${image.name}`}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <header><span title={image.name}>{image.name}</span><button type="button" aria-label="ปิดรูปภาพ" onClick={onClose} autoFocus><X size={22} /></button></header>
      {failed ? <p role="alert"><ImageOff size={24} />เปิดรูปไม่ได้ ไฟล์อาจถูกย้ายหรือลบ กรุณาแนบรูปอีกครั้ง</p>
        : <img src={image.src} alt={image.name} onError={() => setFailed(true)} />}
    </dialog>, document.body,
  );
}

function Thumbnail({ image, onOpen }: { image: Image; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  return <button type="button" className="message-image-thumb" onClick={onOpen} aria-label={`ดูรูป ${image.name}`} title={image.name}>
    {failed ? <span className="message-image-missing"><ImageOff size={24} /><span>เปิดรูปไม่ได้</span></span>
      : <img src={image.src} alt={image.name} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    <span className="message-image-name">{image.name}</span>
  </button>;
}

/** Saved files are loaded from the conversation's own project/session, including after reload. */
export function MessageAttachments({ paths, endpoint }: { paths?: string[]; endpoint: string }) {
  const [selected, setSelected] = useState<Image | null>(null);
  return <>
    {!!paths?.length && <div className="message-attachments" aria-label="ไฟล์แนบในข้อความ">
      {paths.map((file, index) => {
        const name = file.split(/[\\/]/).at(-1) || file;
        if (!/\.(?:png|jpe?g|gif|webp|avif)$/i.test(name)) return <span className="message-file" key={`${file}-${index}`} title={file}><Paperclip size={13} />{name}</span>;
        // Older Code transcripts retain only the basename, while Agent/Chat retain the full path.
        const savedPath = /[\\/]/.test(file) ? file : `.superai/attachments/${file}`;
        const image = { src: `${endpoint}?path=${encodeURIComponent(savedPath)}`, name };
        return <Thumbnail key={`${endpoint}-${file}-${index}`} image={image} onOpen={() => setSelected(image)} />;
      })}
    </div>}
    {selected && <ImagePreview image={selected} onClose={() => setSelected(null)} />}
  </>;
}
