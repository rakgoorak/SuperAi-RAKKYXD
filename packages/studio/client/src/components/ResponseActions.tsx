import { useEffect, useRef, useState } from 'react';
import { Check, Copy, FilePen, MoreHorizontal, Pencil, RotateCcw } from 'lucide-react';

/** Response controls are separate from suggestions and never invent provider capabilities. */
export function ResponseActions({ text, disabled = false, onRetry, onEdit, onChanges }: {
  text?: string; disabled?: boolean; onRetry?: () => void; onEdit?: () => void; onChanges?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState('');
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); event.stopPropagation(); } };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape); };
  }, [open]);
  const copy = async () => {
    setProblem('');
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text || '');
      setCopied(true); clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); setProblem('คัดลอกไม่ได้ ลองเลือกข้อความแล้วคัดลอกอีกครั้ง'); }
  };
  return <div className="response-controls">
    <div className="response-actions" role="group" aria-label="จัดการคำตอบ">
      {text?.trim() && <button type="button" aria-label={copied ? 'คัดลอกแล้ว' : 'คัดลอกคำตอบ'} title={copied ? 'คัดลอกแล้ว' : 'คัดลอกคำตอบ'} onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>}
      {onRetry && <button type="button" aria-label="สร้างคำตอบใหม่" title="สร้างคำตอบใหม่ด้วยข้อความและการตั้งค่าเดิม อาจแก้ไฟล์หรือรันคำสั่งซ้ำ" disabled={disabled} onClick={onRetry}><RotateCcw size={16} /></button>}
      {(onEdit || onChanges) && <div className="response-more" ref={menu} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
        <button ref={trigger} type="button" aria-label="ตัวเลือกคำตอบ" title="ตัวเลือกคำตอบ" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}><MoreHorizontal size={18} /></button>
        {open && <div className="response-options">
          {onEdit && <button type="button" onClick={() => { setOpen(false); onEdit(); }}><Pencil size={14} />แก้ไขข้อความต้นฉบับ</button>}
          {onChanges && <button type="button" onClick={() => { setOpen(false); onChanges(); }}><FilePen size={14} />ดูไฟล์ที่เปลี่ยน</button>}
        </div>}
      </div>}
      <span className="response-copy-status" role="status">{copied ? 'คัดลอกแล้ว' : ''}</span>
    </div>
    {problem && <small role="alert">{problem}</small>}
  </div>;
}
