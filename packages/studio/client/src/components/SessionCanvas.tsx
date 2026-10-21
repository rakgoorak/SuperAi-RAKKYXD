import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Maximize2, Pencil, Plus, Terminal, X } from 'lucide-react';
import { TerminalPane } from './TerminalPane';
import { SessionEnded } from './SessionEnded';
import type { Session } from '../api';

export type CanvasLayout = 'auto' | 'tabs' | 'stack' | 'split' | '3' | '4';
export function canvasColumns(layout: CanvasLayout, count: number, width: number) {
  const requested = layout === 'auto' ? (count <= 4 ? Math.ceil(Math.sqrt(count)) : count <= 6 ? 3 : 4)
    : layout === 'split' ? 2 : layout === '3' ? 3 : layout === '4' ? 4 : 1;
  return Math.max(1, Math.min(requested, count || 1, Math.floor(width / (layout === 'split' ? 450 : 180)) || 1));
}
function stored<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
interface Props {
  sessions: Session[]; workspaceId: string; selected: string; layout: CanvasLayout;
  zoomed: boolean; active: boolean; busy: boolean;
  select: (id: string) => void; zoom: (id: string) => void;
  close: (id: string) => void; restart: (id: string) => void; add: (type?: string) => void; refresh: () => void;
  onError: (message: string) => void;
}
export function SessionCanvas({ sessions, workspaceId, selected, layout, zoomed, active, busy, select, zoom, close, restart, add, refresh, onError }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [order, setOrder] = useState<string[]>(() => {
    const value = stored<unknown>('superai-pane-order', []);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  });
  const [names, setNames] = useState<Record<string, string>>(() => {
    const value = stored<unknown>('superai-pane-names', {});
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string')) : {};
  });
  const [editing, setEditing] = useState('');
  const [name, setName] = useState('');
  const [weights, setWeights] = useState<Record<string, number[]>>(() => {
    const value = stored<unknown>('superai-pane-sizes', {});
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([, v]) => Array.isArray(v) && v.every(n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 100))) : {};
  });
  const resizeCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => resizeCleanup.current?.(), []);
  const dragging = useRef('');
  const ordered = [...sessions].sort((a, b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
    return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
  });
  const grid = layout !== 'tabs' && !zoomed;
  const columns = canvasColumns(layout, sessions.length, width);
  const rows = Math.ceil(sessions.length / columns);
  const signature = `${workspaceId}:${layout}:${columns}:${rows}`;
  const cols = weights[signature + ':x']?.length === columns ? weights[signature + ':x'] : Array(columns).fill(1);
  const rowSizes = weights[signature + ':y']?.length === rows ? weights[signature + ':y'] : Array(rows).fill(1);
  const fitted = grid && !['stack', 'split'].includes(layout);
  useEffect(() => {
    if (!area.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(area.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('superai-pane-order', JSON.stringify(order));
      localStorage.setItem('superai-pane-names', JSON.stringify(names));
      localStorage.setItem('superai-pane-sizes', JSON.stringify(weights));
    } catch { onError('บันทึกการจัดวางบนเครื่องไม่ได้ กรุณาตรวจพื้นที่จัดเก็บ'); }
  }, [order, names, weights, onError]);
  useEffect(() => {
    if (grid && active) document.getElementById(`session-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [grid, active, selected]);
  const reorder = (from: string, to: string) => {
    if (from === to) return;
    const ids = ordered.map(s => s.id), start = ids.indexOf(from), end = ids.indexOf(to);
    if (start < 0 || end < 0) return;
    ids.splice(start, 1); ids.splice(end, 0, from);
    setOrder(current => [...current.filter(id => !ids.includes(id)), ...ids]);
  };
  const adjust = (axis: 'x' | 'y', index: number, delta: number, initial = axis === 'x' ? cols : rowSizes) => {
    const next = [...initial];
    const sum = next[index] + next[index + 1];
    next[index] = Math.max(sum * .15, Math.min(sum * .85, initial[index] + delta));
    next[index + 1] = sum - next[index];
    setWeights(current => ({ ...current, [signature + ':' + axis]: next }));
  };
  const resize = (event: React.PointerEvent, axis: 'x' | 'y', index: number) => {
    event.preventDefault();
    resizeCleanup.current?.();
    event.currentTarget.setPointerCapture(event.pointerId);
    const initial = [...(axis === 'x' ? cols : rowSizes)];
    const start = axis === 'x' ? event.clientX : event.clientY;
    const length = axis === 'x' ? area.current!.clientWidth : area.current!.clientHeight;
    const move = (e: PointerEvent) => adjust(axis, index, ((axis === 'x' ? e.clientX : e.clientY) - start) / length * initial.reduce((a, b) => a + b, 0), initial);
    const done = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', done); window.removeEventListener('pointercancel', done); resizeCleanup.current = null; };
    resizeCleanup.current = done;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', done); window.addEventListener('pointercancel', done);
  };
  const separator = (axis: 'x' | 'y', sizes: number[]) => sizes.slice(0, -1).map((_, i) => {
    const percent = sizes.slice(0, i + 1).reduce((a, b) => a + b, 0) / sizes.reduce((a, b) => a + b, 0) * 100;
    return <div key={axis + i} className={`pane-splitter ${axis}`} role="separator" tabIndex={0}
      aria-label={`ปรับ${axis === 'x' ? 'ความกว้างคอลัมน์' : 'ความสูงแถว'} ${i + 1}`}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}
      style={axis === 'x' ? { left: `${percent}%` } : { top: `${percent}%` }}
      onPointerDown={e => resize(e, axis, i)} onKeyDown={e => {
        if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(e.key)) {
          e.preventDefault(); adjust(axis, i, ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -.1 : .1);
        }
      }} />;
  });
  return <div className="session-canvas" ref={area}>
    {!grid && <div className="session-tabs">
      {ordered.map(s => <div key={s.id} className={`session-tab ${s.id === selected ? 'active' : ''}`}>
        <button onClick={() => select(s.id)}><span className={`status-dot ${s.status === 'running' ? '' : 'offline'}`} />{names[s.id] || s.name}</button>
        <button title={`ปิด ${s.name}`} disabled={busy} onClick={() => close(s.id)}><X size={12} /></button>
      </div>)}
      <button className="icon-button" title="เพิ่ม session" onClick={() => add()}><Plus size={14} /></button>
    </div>}
    <div className={`tile-surface ${fitted ? 'fitted' : ''}`}>
      <div className={`terminal-layout ${grid ? `grid ${layout} ${fitted ? 'fitted-grid' : ''}` : ''}`}
        style={grid ? { gridTemplateColumns: cols.map(v => `minmax(0,${v}fr)`).join(' '),
          ...(fitted ? { gridTemplateRows: rowSizes.map(v => `minmax(176px,${v}fr)`).join(' ') } : {}) } : undefined}>
        {ordered.map((s, i) => <div key={s.id} id={`session-${s.id}`} data-session-id={s.id}
          className={`terminal-cell ${!grid && s.id !== selected ? 'not-visible' : ''} ${selected === s.id ? 'focused' : ''}`}
          style={fitted && i === ordered.length - 1 && ordered.length % columns ? { gridColumn: `span ${columns - i % columns}` } : undefined}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); reorder(dragging.current, s.id); dragging.current = ''; }}>
          {grid && <div className="terminal-cell-heading" draggable={editing !== s.id}
            onDragStart={e => { dragging.current = s.id; e.dataTransfer.setData('text/plain', s.id); }}
            onDragEnd={() => { dragging.current = ''; }} onDoubleClick={() => zoom(s.id)}>
            {editing === s.id ? <form className="pane-rename" onSubmit={e => { e.preventDefault(); setNames(current => ({ ...current, [s.id]: name.trim() || s.name })); setEditing(''); }}>
              <input autoFocus aria-label="ชื่อ session" value={name} maxLength={60} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setEditing(''); }} />
              <button type="submit">บันทึก</button><button type="button" onClick={() => setEditing('')}>ยกเลิก</button>
            </form> : <button className="pane-title" onClick={() => select(s.id)} title={`${names[s.id] || s.name} · ${s.agentType} · ${s.cwd}`}>
              <span className={`status-dot ${s.status === 'running' ? '' : s.status === 'error' ? 'bad' : 'offline'}`} />
              <Terminal size={12} /><strong>{names[s.id] || s.name}</strong>
            </button>}
            <div className="pane-actions">
              <button className="icon-button secondary-pane-action" title={`เปลี่ยนชื่อ ${s.name}`} onClick={() => { setName(names[s.id] || s.name); setEditing(s.id); }}><Pencil size={11} /></button>
              <button className="icon-button secondary-pane-action" title={`ย้าย ${s.name} ก่อนหน้า`} disabled={!i} onClick={() => reorder(s.id, ordered[i - 1].id)}><ArrowLeft size={11} /></button>
              <button className="icon-button secondary-pane-action" title={`ย้าย ${s.name} ถัดไป`} disabled={i === ordered.length - 1} onClick={() => reorder(s.id, ordered[i + 1].id)}><ArrowRight size={11} /></button>
              <button className="icon-button" title={`เพิ่ม session แบบ ${s.name}`} onClick={() => add(s.agentType)}><Plus size={13} /></button>
              <button className="icon-button" title={`ขยาย ${s.name}`} onClick={() => zoom(s.id)}><Maximize2 size={12} /></button>
              <button className="icon-button" title={`ปิด ${s.name}`} disabled={busy} onClick={() => close(s.id)}><X size={12} /></button>
            </div>
          </div>}
          {(s.status === 'exited' || s.status === 'error') && <SessionEnded key={`${s.id}-${s.createdAt}`} session={{ ...s, name: names[s.id] || s.name }} onRestart={restart} onClose={close} />}
          <TerminalPane key={`${s.id}-${s.createdAt}`} tab={{ id: s.id, sessionId: s.id, name: names[s.id] || s.name, type: s.agentType, status: s.status === 'stopping' ? 'exited' : s.status }}
            visible={active && (grid || s.id === selected)} focused={active && s.id === selected} showHeader={false}
            onFocus={() => select(s.id)} onClose={() => close(s.id)} onExit={refresh} registerSender={() => {}} />
        </div>)}
      </div>
      {fitted && <div className="pane-splitters">{separator('x', cols)}{separator('y', rowSizes)}</div>}
    </div>
  </div>;
}
