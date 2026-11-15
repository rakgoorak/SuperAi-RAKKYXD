import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { tr } from '../i18n';

/** Native disclosure: keyboard reachable, dismissed outside or with Escape. */
export function ComposerOptions({ label, children, attention = false }: { label: string; children: ReactNode; attention?: boolean }) {
  const root = useRef<HTMLDetailsElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      if (!root.current || !popup.current) return;
      const anchor = root.current.getBoundingClientRect();
      const surface = root.current.closest('.work-canvas')?.getBoundingClientRect();
      const minLeft = Math.max(12, (surface?.left || 0) + 12);
      const maxRight = Math.min(innerWidth - 12, (surface?.right || innerWidth) - 12);
      const width = Math.min(340, maxRight - minLeft);
      const left = Math.max(minLeft, Math.min(anchor.right - width, maxRight - width));
      Object.assign(popup.current.style, { width: `${width}px`, left: `${left - anchor.left}px`, maxHeight: `${Math.max(100, Math.min(440, anchor.top - 76))}px` });
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [open]);
  useEffect(() => {
    const dismiss = (event: PointerEvent | KeyboardEvent) => {
      if (!root.current?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        root.current.open = false;
        root.current.querySelector('summary')?.focus();
        event.stopPropagation();
      } else if (event.target instanceof Node && !root.current.contains(event.target)) root.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss); };
  }, []);
  return <details ref={root} className={`composer-options ${attention ? 'needs-attention' : ''}`} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary aria-label={label} title={attention ? tr`${label} · ตรวจบัญชี AI` : label} aria-expanded={open} aria-controls={id}><SlidersHorizontal size={15} />{attention && <span>{tr("ตรวจบัญชี")}</span>}</summary>
    <div ref={popup} className="composer-options-popover" id={id} role="group" aria-label={label}>{children}</div>
  </details>;
}
