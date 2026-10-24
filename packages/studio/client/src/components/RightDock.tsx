import { useEffect, useState } from 'react';
import { Activity, Check, ClipboardList, Globe, MessageSquare, Play, Plus, Search, Trash2, X } from 'lucide-react';
import type { Run, Session, Workspace } from '../api';
import { post } from '../api';
import { PreviewPanel } from './PreviewPanel';
import type { PreviewRequest } from '../previewLinks';

export type DockView = 'dashboard' | 'tasks' | 'prompts' | 'browser';
interface SavedItem { id: string; wsId: string; title: string; text: string; state: 'todo' | 'sent' | 'done'; sessionId?: string; }
interface Props {
  previewRequest?: PreviewRequest;
  open: boolean; view: DockView; setView: (view: DockView) => void; close: () => void;
  suspended: boolean; workspace?: Workspace; workspaces: Workspace[]; sessions: Session[]; runs: Run[]; selected: string;
  onSelect: (session: Session) => void; onPrompt: (text: string) => void; onError: (message: string) => void;
}
function loadItems(key: string): SavedItem[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(x => x && typeof x.id === 'string' && typeof x.wsId === 'string' && typeof x.title === 'string' && typeof x.text === 'string' && ['todo', 'sent', 'done'].includes(x.state)) : [];
  } catch { return []; }
}
export function RightDock({ open, view, setView, close, suspended, workspace, workspaces, sessions, runs, selected, onSelect, onPrompt, onError, previewRequest }: Props) {
  const [width, setWidth] = useState(() => {
    try { const n = Number(localStorage.getItem('superai-dock-width')); return Number.isFinite(n) && n >= 320 ? Math.min(n, innerWidth * .6) : 420; } catch { return 420; }
  });
  const [resizing, setResizing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [tasks, setTasks] = useState(() => loadItems('superai-tasks-v1'));
  const [prompts, setPrompts] = useState(() => loadItems('superai-prompts-v1'));
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [recipient, setRecipient] = useState(selected);
  const [sending, setSending] = useState('');
  useEffect(() => { setEditing(null); setSearch(''); setFilter('all'); setRecipient(selected); }, [view, workspace?.id]);
  const persist = (kind: 'tasks' | 'prompts', items: SavedItem[]) => {
    try {
      localStorage.setItem(`superai-${kind}-v1`, JSON.stringify(items));
      (kind === 'tasks' ? setTasks : setPrompts)(items);
    } catch { onError('บันทึกรายการบนเครื่องไม่ได้ กรุณาตรวจพื้นที่จัดเก็บ'); }
  };
  const changeWidth = (next: number) => {
    const value = Math.max(320, Math.min(innerWidth * .6, next)); setWidth(value);
    try { localStorage.setItem('superai-dock-width', String(value)); } catch { onError('บันทึกขนาดแผงไม่ได้'); }
  };
  const matching = sessions.filter(s => `${s.name} ${s.agentType} ${workspaces.find(w => w.id === s.wsId)?.name || ''}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || s.status === filter));
  const kind = view === 'tasks' ? 'tasks' : 'prompts';
  const items = (view === 'tasks' ? tasks : prompts).filter(x => x.wsId === workspace?.id && `${x.title} ${x.text}`.toLowerCase().includes(search.toLowerCase()));
  const edit = (item?: SavedItem) => { setEditing(item?.id || 'new'); setTitle(item?.title || ''); setText(item?.text || ''); };
  const save = () => {
    if (!workspace || !title.trim() || !text.trim()) return;
    const current = kind === 'tasks' ? tasks : prompts;
    const existing = current.find(x => x.id === editing);
    const item: SavedItem = { id: editing === 'new' ? crypto.randomUUID() : editing!, wsId: workspace.id, title: title.trim(), text: text.trim(), state: existing?.state || 'todo', sessionId: existing?.sessionId };
    persist(kind, editing === 'new' ? [...current, item] : current.map(x => x.id === item.id ? item : x));
    setEditing(null);
  };
  const deliver = async (item: SavedItem) => {
    setSending(item.id);
    try {
      const target = sessions.find(s => s.id === recipient && s.wsId === workspace?.id && s.status === 'running');
      if (!target) throw new Error('เลือก session ที่กำลังทำงานในโปรเจกต์นี้ก่อน');
      const result = await post(`/api/terminals/${target.id}/input`, { input: item.text + '\r' });
      if (!result.success) throw new Error('ส่งงานไม่สำเร็จ กรุณาตรวจ session');
      persist('tasks', loadItems('superai-tasks-v1').map(x => x.id === item.id ? { ...x, state: 'sent', sessionId: target.id } : x));
    } catch (e) { onError((e as Error).message); } finally { setSending(''); }
  };
  return <aside className={`right-dock ${open ? '' : 'not-visible'}`} style={{ width }} aria-label="แผงเครื่องมือ">
    <div className="dock-resize" role="separator" aria-label="ปรับขนาดแผงด้านขวา" aria-orientation="vertical" tabIndex={0}
      onKeyDown={e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); changeWidth(width + (e.key === 'ArrowLeft' ? 24 : -24)); } }}
      onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setResizing(true); }}
      onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) changeWidth(innerWidth - e.clientX); }}
      onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); setResizing(false); }}
      onPointerCancel={() => setResizing(false)} />
    <nav className="dock-tabs" aria-label="เครื่องมือด้านขวา">
      {([['dashboard', 'สถานะ', Activity], ['tasks', 'งาน', ClipboardList], ['prompts', 'พรอมป์ต์', MessageSquare], ['browser', 'Browser', Globe]] as const).map(([value, label, Icon]) =>
        <button key={value} aria-pressed={view === value} onClick={() => setView(value)}><Icon size={12} />{label}</button>)}
      <button className="icon-button" title="ปิดแผงด้านขวา" onClick={close}><X size={14} /></button>
    </nav>
    <div className={`dock-browser ${view === 'browser' ? '' : 'not-visible'}`}>
      <PreviewPanel embedded onClose={close} suspended={!open || view !== 'browser' || suspended || resizing} onError={onError} request={previewRequest} workspaceId={workspace?.id} />
    </div>
    {view !== 'browser' && <div className="dock-content">
      {view === 'dashboard' ? <>
        <div className="dock-summary"><strong>{sessions.length}</strong><div><h2>session ทั้งหมด</h2><p>{sessions.filter(s => s.status === 'running').length} process เปิดอยู่ · {sessions.filter(s => s.status !== 'running').length} หยุด / ปิดแล้ว</p></div></div>
        <p className="dock-note">สถานะ process จากระบบ · CLI ที่เปิดอยู่อาจกำลังรอคำสั่ง</p>
        <div className="dock-filters">{[['all', 'ทั้งหมด'], ['running', 'เปิดอยู่'], ['exited', 'จบแล้ว'], ['error', 'ผิดพลาด']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      </> : <div className="dock-section-heading"><div><h2>{view === 'tasks' ? 'งานของโปรเจกต์' : 'พรอมป์ต์ที่บันทึก'}</h2><p>{workspace?.name || 'เลือกโปรเจกต์ก่อน'} · บันทึกบนเครื่อง</p></div><button className="icon-button" title={view === 'tasks' ? 'เพิ่มงาน' : 'เพิ่มพรอมป์ต์'} disabled={!workspace} onClick={() => edit()}><Plus size={16} /></button></div>}
      <label className="dock-search"><Search size={13} /><input aria-label="ค้นหาในแผง" placeholder="ค้นหา…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      {view === 'dashboard' ? <>
        <div className="dock-list">{matching.map(s => <button className={`session-summary ${selected === s.id ? 'active' : ''}`} key={s.id} onClick={() => onSelect(s)}>
          <span className={`status-dot ${s.status === 'running' ? '' : s.status === 'error' ? 'bad' : 'offline'}`} />
          <span><strong>{s.name}</strong><small>{s.agentType} · {workspaces.find(w => w.id === s.wsId)?.name || s.cwd}</small></span>
          <small>{s.status === 'running' ? 'เปิดอยู่' : s.status === 'stopping' ? 'กำลังปิด' : s.status === 'error' ? 'ผิดพลาด' : 'จบแล้ว'}</small>
        </button>)}{!matching.length && <p className="dock-empty">ยังไม่มี session ที่ตรงกับตัวกรอง</p>}</div>
        {runs.length > 0 && <section className="dock-runs"><h3>ประวัติผู้ช่วยในโปรเจกต์นี้</h3>{runs.slice(0, 15).map(run => <div key={run.id}><strong>{run.prompt}</strong><small>{run.status === 'completed' ? 'เสร็จแล้ว' : run.status === 'running' ? 'กำลังทำงาน' : run.status === 'failed' ? 'ผิดพลาด' : 'ยกเลิกแล้ว'}</small></div>)}</section>}
      </> : <>
        {view === 'tasks' && <label className="task-target">ส่งงานไปที่<select aria-label="session รับงาน" value={recipient} onChange={e => setRecipient(e.target.value)}><option value="">เลือก session</option>{sessions.filter(s => s.wsId === workspace?.id && s.status === 'running').map(s => <option key={s.id} value={s.id}>{s.name} · {s.id.slice(0, 5)}</option>)}</select></label>}
        {editing && <form className="dock-editor" onSubmit={e => { e.preventDefault(); save(); }}>
          <label>ชื่อ<input aria-label="ชื่อรายการ" required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label>ข้อความ<textarea aria-label="ข้อความรายการ" required maxLength={20000} rows={5} value={text} onChange={e => setText(e.target.value)} /></label>
          <div className="inline"><button className="primary compact" type="submit">บันทึกรายการ</button><button className="text-button" type="button" onClick={() => setEditing(null)}>ยกเลิก</button></div>
        </form>}
        <div className="dock-list">{items.map(item => <article className="saved-item" key={item.id}>
          <div className="saved-item-heading"><strong>{item.title}</strong>{view === 'tasks' && <small>{item.state === 'done' ? 'เสร็จแล้ว' : item.state === 'sent' ? 'ส่งแล้ว' : 'ยังไม่ส่ง'}</small>}</div>
          <p>{item.text}</p><div className="saved-item-actions">
            {view === 'tasks' ? <><button className="text-button" disabled={!!sending || item.state === 'done'} onClick={() => void deliver(item)}><Play size={12} />{sending === item.id ? 'กำลังส่ง…' : 'ส่งเข้า session'}</button><button className="text-button" onClick={() => persist('tasks', tasks.map(x => x.id === item.id ? { ...x, state: x.state === 'done' ? 'todo' : 'done' } : x))}><Check size={12} />{item.state === 'done' ? 'เปิดงานอีกครั้ง' : 'ทำเครื่องหมายเสร็จ'}</button></> : <button className="text-button" onClick={() => onPrompt(item.text)}>ใช้พรอมป์ต์</button>}
            <button className="text-button" onClick={() => edit(item)}>แก้ไข</button><button className="icon-button" title={`ลบ ${item.title}`} disabled={!!sending} onClick={() => persist(kind, (kind === 'tasks' ? tasks : prompts).filter(x => x.id !== item.id))}><Trash2 size={13} /></button>
          </div>
        </article>)}{!items.length && !editing && <p className="dock-empty">{view === 'tasks' ? 'เพิ่มงานแล้วส่งคำสั่งให้ session ที่เลือก เมื่อทำเสร็จให้ทำเครื่องหมายด้วยตนเอง' : 'บันทึกคำสั่งที่ใช้บ่อย แล้วกดใช้เพื่อใส่ในช่องคำสั่งก่อนส่ง'}</p>}</div>
      </>}
    </div>}
  </aside>;
}
