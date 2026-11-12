import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, ImagePlus, Paperclip, Plus, X } from 'lucide-react';
import { ACCEPT_ATTACHMENTS, isPdf, isSupportedAttachment, pdfPageCount, unsupportedAttachmentMessage } from '../attachments';
import { tr } from '../i18n';

export interface ComposerAttachment {
  id: string;
  file: File;
  kind: 'image' | 'pdf';
  thumb?: string;
  pages?: number;
}

/** Attachments waiting in the main composer until the message is sent. */
export function useComposerAttachments(onError: (message: string) => void, scopeKey: string) {
  const [scopes, setScopes] = useState<Record<string, ComposerAttachment[]>>({});
  const scopesRef = useRef(scopes);
  scopesRef.current = scopes;
  const items = scopes[scopeKey] || [];
  const update = useCallback((key: string, change: (items: ComposerAttachment[]) => ComposerAttachment[]) => {
    setScopes(current => ({ ...current, [key]: change(current[key] || []) }));
  }, []);

  const add = useCallback(
    (files: File[]) => {
      const supported = files.filter(isSupportedAttachment);
      if (supported.length < files.length) onError(unsupportedAttachmentMessage());
      const room = 20 - (scopesRef.current[scopeKey]?.length || 0);
      if (supported.length > room) onError(tr("แนบได้ครั้งละไม่เกิน 20 ไฟล์ ส่งชุดนี้ก่อนแล้วค่อยแนบเพิ่ม"));
      const added = supported.slice(0, Math.max(0, room)).map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        kind: isPdf(file) ? ('pdf' as const) : ('image' as const),
        thumb: isPdf(file) ? undefined : URL.createObjectURL(file),
      }));
      if (!added.length) return;
      update(scopeKey, (current) => [...current, ...added]);
      for (const item of added)
        if (item.kind === 'pdf')
          void pdfPageCount(item.file)
            .then((pages) => pages && update(scopeKey, (current) => current.map((c) => (c.id === item.id ? { ...c, pages } : c))))
            .catch(() => {});
    },
    [onError, scopeKey, update],
  );
  const remove = (id: string) =>
    update(scopeKey, (current) => {
      const gone = current.find((c) => c.id === id);
      if (gone?.thumb) URL.revokeObjectURL(gone.thumb);
      return current.filter((c) => c.id !== id);
    });
  const clear = () =>
    update(scopeKey, (current) => {
      for (const c of current) if (c.thumb) URL.revokeObjectURL(c.thumb);
      return [];
    });
  useEffect(() => () => Object.values(scopesRef.current).flat().forEach((c) => c.thumb && URL.revokeObjectURL(c.thumb)), []);
  return { items, add, remove, clear };
}

export const AttachmentCards: React.FC<{ items: ComposerAttachment[]; onRemove: (id: string) => void; disabled?: boolean }> = ({ items, onRemove, disabled }) =>
  items.length ? (
    <ul className="attachment-cards" aria-label={tr("ไฟล์แนบ")}>
      {items.map((item) => (
        <li key={item.id} className={`attachment-card ${item.kind}`} title={item.file.name}>
          {item.thumb ? (
            <img src={item.thumb} alt={item.file.name} />
          ) : (
            <div className="attachment-pdf">
              <FileText size={26} />
              <span className="attachment-name">{item.file.name}</span>
              <span className="attachment-meta">PDF{item.pages ? tr` · ${item.pages} หน้า` : ''}</span>
            </div>
          )}
          <button className="attachment-remove" onClick={() => onRemove(item.id)} disabled={disabled} aria-label={tr`เอา ${item.file.name} ออก`} title={tr("เอาออก")}>
            <X size={12} />
          </button>
        </li>
      ))}
    </ul>
  ) : null;

/** "+" menu at the left of the composer; Ctrl+U opens the same file picker. */
export const AttachMenu: React.FC<{ onFiles: (files: File[]) => void; disabled?: boolean; actions?: { label: string; selected?: boolean; onSelect: () => void }[] }> = ({ onFiles, disabled, actions = [] }) => {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const pick = () => {
    setOpen(false);
    input.current?.click();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (disabled || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== 'u') return;
      // Ctrl+U inside a terminal pane belongs to the shell/CLI (clear line).
      if ((event.target as HTMLElement | null)?.closest?.('.xterm')) return;
      event.preventDefault();
      pick();
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [disabled]);
  return (
    <div className="attach-menu" ref={root}>
      <button
        className={`icon-button ${open ? 'selected' : ''}`}
        title={tr("แนบไฟล์หรือรูปภาพ (Ctrl+U)")}
        aria-label={tr("แนบไฟล์")}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <Plus size={15} />
      </button>
      {open && (
        <div className="dictation-menu attach-popover" role="menu">
          <button role="menuitem" onClick={pick}>
            <Paperclip size={13} />
            <span>{tr("เพิ่มไฟล์หรือรูปภาพ")}</span>
            <kbd>Ctrl+U</kbd>
          </button>
          {actions.map(action => <button key={action.label} type="button" role="menuitem" aria-pressed={action.selected} onClick={() => { setOpen(false); action.onSelect(); }}><FileText size={13} /><span>{action.label}</span></button>)}
        </div>
      )}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={ACCEPT_ATTACHMENTS}
        aria-label={tr("เลือกไฟล์แนบ")}
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          event.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
};

/**
 * Drag-and-drop anywhere on the window. Terminal panes handle drops on themselves
 * (and stop them); everything else goes to the composer.
 */
export function useWindowDrop(onFiles: (files: File[]) => void, enabled: boolean) {
  const [target, setTarget] = useState<'composer' | 'pane' | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let depth = 0;
    const hasFiles = (event: DragEvent) => !!event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files');
    const where = (event: DragEvent) => ((event.target as HTMLElement | null)?.closest?.('[data-terminal-pane]') ? 'pane' : 'composer');
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth++;
      setTarget(where(event));
    };
    const onOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      const next = where(event);
      setTarget((current) => (current === next ? current : next));
    };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      if (--depth <= 0) {
        depth = 0;
        setTarget(null);
      }
    };
    const onDrop = (event: DragEvent) => {
      depth = 0;
      setTarget(null);
      if (!hasFiles(event)) return;
      event.preventDefault();
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.length) onFiles(files);
    };
    // Pane drops are stopped before they reach window, so only reset state then.
    const onAnyDrop = () => {
      depth = 0;
      setTarget(null);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    document.addEventListener('drop', onAnyDrop, true);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
      document.removeEventListener('drop', onAnyDrop, true);
    };
  }, [onFiles, enabled]);
  return target;
}

export const ComposerDropOverlay: React.FC<{ active: boolean }> = ({ active }) =>
  active ? (
    <div className="composer-drop-overlay" aria-hidden="true">
      <ImagePlus size={28} />
      <strong>{tr("วางเพื่อแนบในช่องคำสั่ง")}</strong>
      <span>{tr("รูปหรือ PDF จะแสดงเหนือช่องพิมพ์ ส่งพร้อมข้อความเมื่อกดส่ง")}</span>
    </div>
  ) : null;
