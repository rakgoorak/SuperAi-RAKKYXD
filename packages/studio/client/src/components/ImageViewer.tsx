import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageOff, Maximize, Minus, Plus, X } from 'lucide-react';
import '../message-attachments.css';

export type ViewerImage = { src: string; name: string };

/** Shared by saved attachments and image links in AI answers. Zoom uses actual image pixels. */
export function ImageViewer({ image, onClose }: { image: ViewerImage; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number }>();
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const previousScale = useRef(1);
  const changeZoom = useCallback((factor: number) => setScale(value => Math.min(8, Math.max(0.05, value * factor))), []);
  const fit = useCallback(() => {
    const area = viewport.current;
    if (area && size.width && size.height) setScale(Math.min(1, area.clientWidth / size.width, area.clientHeight / size.height));
  }, [size]);
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
  useLayoutEffect(() => {
    const area = viewport.current;
    if (!area) return;
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area, { box: 'border-box' });
    return () => observer.disconnect();
  }, [fit]);
  useLayoutEffect(() => {
    const area = viewport.current;
    if (area) {
      const ratio = scale / previousScale.current;
      area.scrollLeft = (area.scrollLeft + area.clientWidth / 2) * ratio - area.clientWidth / 2;
      area.scrollTop = (area.scrollTop + area.clientHeight / 2) * ratio - area.clientHeight / 2;
    }
    previousScale.current = scale;
  }, [scale]);
  useEffect(() => {
    const area = viewport.current;
    if (!area || !size.width) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); changeZoom(event.deltaY < 0 ? 1.15 : 1 / 1.15); };
    area.addEventListener('wheel', wheel, { passive: false });
    return () => area.removeEventListener('wheel', wheel);
  }, [changeZoom, size.width]);
  const ready = !!size.width && !failed;
  return createPortal(<dialog ref={dialog} className="message-image-preview" aria-label={`ดูรูป ${image.name}`}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => {
      if (!ready) return;
      if (event.key === '+' || event.key === '=') { event.preventDefault(); changeZoom(1.25); }
      else if (event.key === '-') { event.preventDefault(); changeZoom(0.8); }
      else if (event.key === '0') { event.preventDefault(); fit(); }
    }}>
    <header><button type="button" aria-label="ปิดรูปภาพ" title="ปิดรูปภาพ (Esc)" onClick={onClose} autoFocus><X size={22} /><span>ปิดรูปภาพ</span><kbd>Esc</kbd></button><span className="message-image-title" title={image.name}>{image.name}</span></header>
    {failed ? <p role="alert"><ImageOff size={24} />เปิดรูปไม่ได้ ไฟล์อาจถูกย้ายหรือลบ กรุณาเปิดใน Preview หรือตรวจที่อยู่ไฟล์</p>
      : <div ref={viewport} className="image-viewer-viewport" aria-label="พื้นที่รูปภาพ เลื่อนล้อเมาส์เพื่อซูม"
        onPointerDown={event => {
          if (event.pointerType !== 'mouse' || event.button !== 0) return;
          const area = event.currentTarget;
          drag.current = { x: event.clientX, y: event.clientY, left: area.scrollLeft, top: area.scrollTop };
          area.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (!drag.current) return;
          event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX;
          event.currentTarget.scrollTop = drag.current.top + drag.current.y - event.clientY;
        }}
        onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}>
        <div className="image-viewer-canvas"><img src={image.src} alt={image.name} draggable={false}
          style={size.width ? { width: size.width * scale, height: size.height * scale } : undefined}
          onLoad={event => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onDoubleClick={() => scale === 1 ? fit() : setScale(1)} onError={() => setFailed(true)} /></div>
      </div>}
    <div className="image-viewer-controls" role="group" aria-label="ซูมรูปภาพ">
      <button disabled={!ready || scale <= 0.05} aria-label="ซูมออก" title="ซูมออก (-)" onClick={() => changeZoom(0.8)}><Minus size={18} /></button>
      <output aria-live="polite" aria-label="ระดับการซูม">{ready ? `${Math.round(scale * 100)}%` : '—'}</output>
      <button disabled={!ready || scale >= 8} aria-label="ซูมเข้า" title="ซูมเข้า (+)" onClick={() => changeZoom(1.25)}><Plus size={18} /></button>
      <button disabled={!ready} onClick={() => setScale(1)} title="ขนาดจริง">100%</button>
      <button disabled={!ready} onClick={fit} title="พอดีจอ (0)"><Maximize size={16} /> พอดีจอ</button>
    </div>
  </dialog>, document.body);
}
