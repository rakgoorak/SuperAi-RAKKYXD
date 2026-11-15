import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Maximize2, Pencil, Plus, X } from 'lucide-react';
import { TerminalPane } from './TerminalPane';
import { SessionEnded } from './SessionEnded';
import type { Session } from '../api';
import { paneView, type PaneView } from '../paneView';
import { ProviderBadge } from './ProviderBadge';
import { tr } from '../i18n';

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
  hiddenIds?: string[];
  select: (id: string) => void; zoom: (id: string) => void;
  hide?: (id: string) => void; unhide?: (id: string) => void; unhideAll?: () => void;
  close: (id: string) => void; restart: (id: string) => void; add: (type?: string) => void; refresh: () => void;
  switchView: (id: string, view: PaneView) => void;
  onError: (message: string) => void;
  rename: (id: string, name: string) => Promise<void>;
}
export function SessionCanvas({ sessions, workspaceId, selected, layout, zoomed, active, busy, hiddenIds = [], select, zoom, hide, unhide, unhideAll, close, restart, add, refresh, onError, switchView, rename }: Props) {
  // Closing deletes the session for good (it is kept across restarts otherwise), so ask first.
  const remove = (s: Session) => {
    window.dispatchEvent(new CustomEvent("superai:delete-session", { detail: { id: s.id, name: names[s.id] || s.name } }));
  };
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
  const [renaming, setRenaming] = useState(false);
  useEffect(() => { setEditing(''); setName(''); }, [workspaceId]);
  const saveName = async (id: string) => {
    if (renaming) return;
    setRenaming(true);
    try {
      await rename(id, name.trim());
      setNames(current => { const next = { ...current }; delete next[id]; return next; });
      setEditing('');
    } catch (error) { onError((error as Error).message); }
    finally { setRenaming(false); }
  };
  useEffect(() => {
    const edit = (event: Event) => {
      const session = sessions.find(item => item.id === (event as CustomEvent<string>).detail);
      if (session && active) { setName(session.name); setEditing(session.id); }
    };
    window.addEventListener('superai:rename-session', edit);
    return () => window.removeEventListener('superai:rename-session', edit);
  }, [sessions, active]);
  const [weights, setWeights] = useState<Record<string, number[]>>(() => {
    const value = stored<unknown>('superai-pane-sizes', {});
    return value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([, v]) => Array.isArray(v) && v.every(n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 100))) : {};
  });
  const resizeCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => resizeCleanup.current?.(), []);
  const dragging = useRef('');
  const hiddenSet = new Set(hiddenIds);
  const allOrdered = [...sessions].sort((a, b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
    return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
  });
  const ordered = allOrdered.filter(s => !hiddenSet.has(s.id));
  const hiddenList = allOrdered.filter(s => hiddenSet.has(s.id));
  const grid = layout !== 'tabs' && !zoomed;
  const columns = canvasColumns(layout, ordered.length, width);
  const rows = Math.ceil((ordered.length || 1) / columns);
  const signature = `${workspaceId}:${layout}:${columns}:${rows}`;
  const cols = weights[signature + ':x']?.length === columns ? weights[signature + ':x'] : Array(columns).fill(1);
  const rowSizes = weights[signature + ':y']?.length === rows ? weights[signature + ':y'] : Array(rows).fill(1);
  const fitted = grid && !['stack', 'split'].includes(layout) && ordered.length > 0;
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
    } catch { onError(tr("บันทึกการจัดวางบนเครื่องไม่ได้ กรุณาตรวจพื้นที่จัดเก็บ")); }
  }, [order, names, weights, onError]);
  useEffect(() => {
    if (grid && active && !hiddenSet.has(selected)) document.getElementById(`session-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [grid, active, selected, hiddenIds]);
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
      aria-label={tr`ปรับ${axis === 'x' ? tr("ความกว้างคอลัมน์") : tr("ความสูงแถว")} ${i + 1}`}
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
    {!grid && (ordered.length > 1 || editing) && <div className="session-tabs">
      {ordered.map(s => <div key={s.id} className={`session-tab ${s.id === selected ? 'active' : ''}`}>
        <button onClick={() => select(s.id)}><ProviderBadge provider={s.agentType} compact />{names[s.id] || s.name}</button>
        <button className="tab-rename" title={tr`เปลี่ยนชื่อ ${s.name}`} onClick={() => { setName(s.name); setEditing(s.id); }}><Pencil size={12} /></button>
        {hide && <button title={tr`ซ่อน ${s.name} พับเก็บไว้ก่อน (ไม่ลบ)`} aria-label={tr`ซ่อน ${s.name}`} onClick={() => hide(s.id)}><EyeOff size={12} /></button>}
        <button title={tr`ลบ ${s.name}`} disabled={busy} onClick={() => remove(s)}><X size={12} /></button>
      </div>)}
      <button className="icon-button" title={tr("เพิ่ม session")} onClick={() => add()}><Plus size={14} /></button>
    </div>}
    {!grid && editing && <form className="session-rename-inline" onSubmit={event => { event.preventDefault(); void saveName(editing); }}>
      <input autoFocus aria-label={tr("ชื่อห้องใหม่")} maxLength={60} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Escape' && !renaming) setEditing(''); }} />
      <button disabled={renaming || !name.trim()} type="submit">{tr("บันทึกชื่อ")}</button><button type="button" disabled={renaming} onClick={() => setEditing('')}>{tr("ยกเลิก")}</button>
    </form>}
    <div className={`tile-surface ${fitted ? 'fitted' : ''}`}>
      {ordered.length === 0 && hiddenList.length > 0 && (
        <div className="hidden-sessions-empty">
          <div className="hidden-sessions-empty-icon"><EyeOff size={24} /></div>
          <h3>{tr("ซ่อนไว้ทั้งหมด")} {hiddenList.length} session</h3>
          <p>{tr("ทุก session ยังทำงานและเก็บประวัติแชตไว้ครบ คลิกเลือกเพื่อเปิดกลับมาแสดงบนหน้าจอได้ทันที")}</p>
          <div className="hidden-sessions-empty-list">
            {hiddenList.map(s => (
              <button key={s.id} type="button" className="secondary" onClick={() => unhide?.(s.id)}>
                <Eye size={14} />
                <span>{names[s.id] || s.name}</span>
              </button>
            ))}
            {hiddenList.length > 1 && unhideAll && (
              <button type="button" className="primary" onClick={unhideAll}>
                <Eye size={14} /> {tr("แสดงทั้งหมด (")}{hiddenList.length})
              </button>
            )}
          </div>
        </div>
      )}
      <div className={`terminal-layout ${ordered.length === 0 ? 'not-visible' : ''} ${grid ? `grid ${layout} ${fitted ? 'fitted-grid' : ''}` : ''}`}
        style={grid && ordered.length > 0 ? { gridTemplateColumns: cols.map(v => `minmax(0,${v}fr)`).join(' '),
          ...(fitted ? { gridTemplateRows: rowSizes.map(v => `minmax(176px,${v}fr)`).join(' ') } : {}) } : undefined}>
        {allOrdered.map((s) => {
          const isHidden = hiddenSet.has(s.id);
          const visibleIndex = isHidden ? -1 : ordered.findIndex(v => v.id === s.id);
          const cellVisible = !isHidden && (grid || s.id === selected);
          return <div key={s.id} id={`session-${s.id}`} data-session-id={s.id}
            className={`terminal-cell ${!cellVisible ? 'not-visible' : ''} ${selected === s.id ? 'focused' : ''}`}
            style={!isHidden && fitted && visibleIndex === ordered.length - 1 && ordered.length % columns ? { gridColumn: `span ${columns - visibleIndex % columns}` } : undefined}
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); reorder(dragging.current, s.id); dragging.current = ''; }}>
            {grid && <div className="terminal-cell-heading" draggable={editing !== s.id}
              onDragStart={e => { dragging.current = s.id; e.dataTransfer.setData('text/plain', s.id); }}
              onDragEnd={() => { dragging.current = ''; }} onDoubleClick={() => zoom(s.id)}>
              {editing === s.id ? <form className="pane-rename" onSubmit={e => { e.preventDefault(); void saveName(s.id); }}>
                <input autoFocus aria-label={tr("ชื่อ session")} value={name} maxLength={60} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setEditing(''); }} />
                <button type="submit" disabled={renaming || !name.trim()}>{tr("บันทึก")}</button><button type="button" disabled={renaming} onClick={() => setEditing('')}>{tr("ยกเลิก")}</button>
              </form> : <button className="pane-title" onClick={() => select(s.id)} title={`${names[s.id] || s.name} · ${s.agentType} · ${s.cwd}`}>
                <span className={`status-dot ${s.status === 'running' ? '' : s.status === 'error' ? 'bad' : 'offline'}`} />
                <ProviderBadge provider={s.agentType} compact /><strong>{names[s.id] || s.name}</strong>
              </button>}
              <div className="pane-actions">
                <button className="icon-button secondary-pane-action" title={tr`เปลี่ยนชื่อ ${s.name}`} onClick={() => { setName(names[s.id] || s.name); setEditing(s.id); }}><Pencil size={11} /></button>
                <button className="icon-button secondary-pane-action" title={tr`ย้าย ${s.name} ก่อนหน้า`} disabled={visibleIndex <= 0} onClick={() => visibleIndex > 0 && reorder(s.id, ordered[visibleIndex - 1].id)}><ArrowLeft size={11} /></button>
                <button className="icon-button secondary-pane-action" title={tr`ย้าย ${s.name} ถัดไป`} disabled={visibleIndex < 0 || visibleIndex === ordered.length - 1} onClick={() => visibleIndex >= 0 && visibleIndex < ordered.length - 1 && reorder(s.id, ordered[visibleIndex + 1].id)}><ArrowRight size={11} /></button>
                <button className="icon-button" title={tr`เพิ่ม session แบบ ${s.name}`} onClick={() => add(s.agentType)}><Plus size={13} /></button>
                {hide && <button className="icon-button" title={tr`ซ่อน ${s.name} พับเก็บไว้ก่อน (ไม่ลบ)`} aria-label={tr`ซ่อน ${s.name}`} onClick={() => hide(s.id)}><EyeOff size={12} /></button>}
                <button className="icon-button" title={tr`ขยาย ${s.name}`} onClick={() => zoom(s.id)}><Maximize2 size={12} /></button>
                <button className="icon-button" title={tr`ลบ ${s.name}`} disabled={busy} onClick={() => remove(s)}><X size={12} /></button>
              </div>
            </div>}
            {(s.status === 'exited' || s.status === 'error') && paneView(s) !== 'chat' && <SessionEnded key={`${s.id}-${s.createdAt}`} session={{ ...s, name: names[s.id] || s.name }} onRestart={restart} onClose={close} />}
            <TerminalPane key={`${s.id}-${s.createdAt}`} tab={{ id: s.id, sessionId: s.id, authOnly: s.authOnly, name: names[s.id] || s.name, type: s.agentType, status: s.status === 'stopping' ? 'exited' : s.status, view: paneView(s) }}
              visible={active && cellVisible} focused={active && cellVisible && s.id === selected} showHeader={false}
              onFocus={() => select(s.id)} onClose={() => close(s.id)} onExit={refresh} registerSender={() => {}} onSwitchView={view => switchView(s.id, view)} />
          </div>;
        })}
      </div>
      {fitted && <div className="pane-splitters">{separator('x', cols)}{separator('y', rowSizes)}</div>}
    </div>
  </div>;
}
