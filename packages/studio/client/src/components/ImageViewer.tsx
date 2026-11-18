import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, ImageOff, Maximize, Minus, Plus, X } from 'lucide-react';
import { copyImageToClipboard, saveImageFromSrc } from '../imageActions';
import '../message-attachments.css';
import { tr } from '../i18n';

export type ViewerImage = { src: string; name: string };

/** Shared by saved attachments and image links in AI answers. Zoom uses actual image pixels. */
export function ImageViewer({ image, onClose }: { image: ViewerImage; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [copied, setCopied] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const previousScale = useRef(1);
  const changeZoom = useCallback((factor: number) => setScale(value => Math.min(8, Math.max(0.05, value * factor))), []);
  const fit = useCallback(() => {
    const area = viewport.current;
    if (area && size.width && size.height) {
      setScale(Math.min(1, (area.clientWidth * 0.84) / size.width, (area.clientHeight * 0.82) / size.height));
    }
  }, [size]);
  useEffect(() => {
    const trigger = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    element.focus({ preventScroll: true });
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

  const handleCopy = async () => {
    try {
      await copyImageToClipboard(image.src);
      setCopied(true);
      setCtxMenu(null);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleSave = async () => {
    setCtxMenu(null);
    await saveImageFromSrc(image.src, image.name);
  };

  const ready = !!size.width && !failed;
  return createPortal(<dialog ref={dialog} tabIndex={-1} className="message-image-preview" aria-label={tr`ดูรูป ${image.name}`}
    onCancel={event => { event.preventDefault(); if (ctxMenu) setCtxMenu(null); else onClose(); }}
    onClick={event => {
      if (ctxMenu) { setCtxMenu(null); return; }
      if (event.target === event.currentTarget) onClose();
    }}
    onKeyDown={event => {
      if (event.key === 'Escape' && ctxMenu) { event.preventDefault(); event.stopPropagation(); setCtxMenu(null); return; }
      if (!ready) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); void handleCopy(); }
      else if (event.key === '+' || event.key === '=') { event.preventDefault(); changeZoom(1.25); }
      else if (event.key === '-') { event.preventDefault(); changeZoom(0.8); }
      else if (event.key === '0') { event.preventDefault(); fit(); }
    }}>
    <header><button type="button" aria-label={tr("ปิดรูปภาพ")} title={tr("ปิดรูปภาพ (Esc)")} onClick={onClose}><X size={18} /><span>{tr("ปิดรูปภาพ")}</span><kbd>Esc</kbd></button><span className="message-image-title" title={image.name}>{image.name}</span></header>
    {failed ? <p role="alert"><ImageOff size={24} />{tr("เปิดรูปไม่ได้ ไฟล์อาจถูกย้ายหรือลบ กรุณาเปิดใน Preview หรือตรวจที่อยู่ไฟล์")}</p>
      : <div ref={viewport} className="image-viewer-viewport" aria-label={tr("พื้นที่รูปภาพ เลื่อนล้อเมาส์เพื่อซูม")}
        onClick={event => {
          if (ctxMenu) { setCtxMenu(null); return; }
          if (!drag.current?.moved && !(event.target as HTMLElement).closest('img')) onClose();
        }}
        onPointerDown={event => {
          if (event.pointerType !== 'mouse' || event.button !== 0) return;
          const area = event.currentTarget;
          drag.current = { x: event.clientX, y: event.clientY, left: area.scrollLeft, top: area.scrollTop, moved: false };
          area.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (!drag.current) return;
          const dx = drag.current.x - event.clientX;
          const dy = drag.current.y - event.clientY;
          if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true;
          event.currentTarget.scrollLeft = drag.current.left + dx;
          event.currentTarget.scrollTop = drag.current.top + dy;
        }}
        onPointerUp={() => { window.setTimeout(() => { drag.current = undefined; }, 0); }}
        onPointerCancel={() => { drag.current = undefined; }}>
        <div className="image-viewer-canvas"><img src={image.src} alt={image.name} draggable={false}
          style={size.width ? { width: size.width * scale, height: size.height * scale } : undefined}
          onLoad={event => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onContextMenu={event => {
            event.preventDefault();
            event.stopPropagation();
            setCtxMenu({
              x: Math.max(12, Math.min(event.clientX, window.innerWidth - 180)),
              y: Math.max(12, Math.min(event.clientY, window.innerHeight - 104)),
            });
          }}
          onDoubleClick={() => scale === 1 ? fit() : setScale(1)} onError={() => setFailed(true)} /></div>
      </div>}
    {ctxMenu && (
      <div className="claude-image-context-menu" role="menu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={e => e.stopPropagation()}>
        <button type="button" role="menuitem" onClick={() => void handleCopy()}>Copy image</button>
        <button type="button" role="menuitem" onClick={() => void handleSave()}>Save image</button>
      </div>
    )}
    <div className="image-viewer-controls" role="group" aria-label={tr("ซูมรูปภาพ")}>
      <button disabled={!ready} onClick={() => void handleCopy()} title="Copy image">
        {copied ? <Check size={15} /> : <Copy size={15} />} Copy image
      </button>
      <button disabled={!ready} onClick={() => void handleSave()} title="Save image">
        <Download size={15} /> Save image
      </button>
      <button disabled={!ready || scale <= 0.05} aria-label={tr("ซูมออก")} title={tr("ซูมออก (-)")} onClick={() => changeZoom(0.8)}><Minus size={18} /></button>
      <output aria-live="polite" aria-label={tr("ระดับการซูม")}>{ready ? `${Math.round(scale * 100)}%` : '—'}</output>
      <button disabled={!ready || scale >= 8} aria-label={tr("ซูมเข้า")} title={tr("ซูมเข้า (+)")} onClick={() => changeZoom(1.25)}><Plus size={18} /></button>
      <button disabled={!ready} onClick={() => setScale(1)} title={tr("ขนาดจริง")}>100%</button>
      <button disabled={!ready} onClick={fit} title={tr("พอดีจอ (0)")}><Maximize size={16} /> {tr("พอดีจอ")}</button>
    </div>
  </dialog>, document.body);
}
