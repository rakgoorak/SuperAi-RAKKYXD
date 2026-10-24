import { useEffect, useState } from 'react';
import { Activity, Check, ClipboardList, Folder, Forward, Globe, MessageSquare, Play, Plus, Search, Trash2, X } from 'lucide-react';
import type { Run, Session, Workspace } from '../api';
import { post } from '../api';
import { PreviewPanel } from './PreviewPanel';
import { FileExplorerPanel } from './FileExplorerPanel';
import type { PreviewRequest } from '../previewLinks';
import { paneView } from '../paneView';
import { dispatchHandoff, formatHandoffPrompt } from '../handoffUtils';

export type DockView = 'dashboard' | 'tasks' | 'prompts' | 'files' | 'browser';
interface SavedItem {
  id: string;
  wsId: string;
  title: string;
  text: string;
  state: 'todo' | 'sent' | 'done';
  sessionId?: string;
}
interface Props {
  previewRequest?: PreviewRequest;
  open: boolean;
  view: DockView;
  setView: (view: DockView) => void;
  close: () => void;
  suspended: boolean;
  workspace?: Workspace;
  workspaces: Workspace[];
  sessions: Session[];
  runs: Run[];
  selected: string;
  onSelect: (session: Session) => void;
  onPrompt: (text: string) => void;
  onError: (message: string) => void;
  onOpenFile?: (path: string) => void;
}

function isSessionActive(s: Session): boolean {
  return s.status === 'running' || paneView(s) === 'chat';
}

function loadItems(key: string): SavedItem[] {
  try {
    const raw = localStorage.getItem(key);
    const value: unknown = JSON.parse(raw || '[]');
    return Array.isArray(value)
      ? value.filter(
          x =>
            x &&
            typeof x.id === 'string' &&
            typeof x.title === 'string' &&
            typeof x.text === 'string' &&
            ['todo', 'sent', 'done'].includes(x.state)
        )
      : [];
  } catch {
    return [];
  }
}

export function RightDock({
  open,
  view,
  setView,
  close,
  suspended,
  workspace,
  workspaces,
  sessions,
  runs,
  selected,
  onSelect,
  onPrompt,
  onError,
  previewRequest,
  onOpenFile,
}: Props) {
  const [width, setWidth] = useState(() => {
    try {
      const n = Number(localStorage.getItem('superai-dock-width'));
      return Number.isFinite(n) && n >= 320 ? Math.min(n, innerWidth * 0.6) : 420;
    } catch {
      return 420;
    }
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
  const [attachLatestSummary, setAttachLatestSummary] = useState(false);

  const getLatestSummary = (): { agentName: string; text: string } | null => {
    const latestRun = runs.find(r => r.status === 'completed' && r.output?.trim());
    if (!latestRun) return null;
    const agent = latestRun.main?.name || latestRun.summarizer?.name || 'AI';
    return { agentName: agent, text: latestRun.output };
  };

  const activeSessions = sessions.filter(isSessionActive);
  const projectActiveSessions = activeSessions.filter(s => !workspace || s.wsId === workspace.id);

  useEffect(() => {
    setEditing(null);
    setSearch('');
    setFilter('all');
  }, [view, workspace?.id]);

  useEffect(() => {
    const available = projectActiveSessions.length ? projectActiveSessions : activeSessions;
    if (selected && available.some(s => s.id === selected)) {
      setRecipient(selected);
    } else if (available.length > 0 && (!recipient || !available.some(s => s.id === recipient))) {
      setRecipient(available[0].id);
    }
  }, [selected, workspace?.id, sessions]);

  const persist = (kind: 'tasks' | 'prompts', items: SavedItem[]) => {
    try {
      localStorage.setItem(`superai-${kind}-v1`, JSON.stringify(items));
      (kind === 'tasks' ? setTasks : setPrompts)(items);
    } catch {
      onError('บันทึกรายการบนเครื่องไม่ได้ กรุณาตรวจพื้นที่จัดเก็บ');
    }
  };

  const changeWidth = (next: number) => {
    const value = Math.max(320, Math.min(innerWidth * 0.6, next));
    setWidth(value);
    try {
      localStorage.setItem('superai-dock-width', String(value));
    } catch {
      onError('บันทึกขนาดแผงไม่ได้');
    }
  };

  const matching = sessions.filter(s => {
    const matchesSearch = `${s.name} ${s.agentType} ${workspaces.find(w => w.id === s.wsId)?.name || ''}`
      .toLowerCase()
      .includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'all') return true;
    if (filter === 'running') return isSessionActive(s);
    if (filter === 'exited') return s.status === 'exited' && paneView(s) !== 'chat';
    if (filter === 'error') return s.status === 'error';
    return true;
  });

  const kind = view === 'tasks' ? 'tasks' : 'prompts';
  const currentList = view === 'tasks' ? tasks : prompts;
  const items = currentList.filter(
    x =>
      (!x.wsId || !workspace || x.wsId === workspace.id) &&
      `${x.title} ${x.text}`.toLowerCase().includes(search.toLowerCase())
  );

  const edit = (item?: SavedItem) => {
    setEditing(item?.id || 'new');
    setTitle(item?.title || '');
    setText(item?.text || '');
  };

  const save = () => {
    if (!title.trim() || !text.trim()) return;
    const existing = currentList.find(x => x.id === editing);
    const item: SavedItem = {
      id: editing === 'new' ? crypto.randomUUID() : editing!,
      wsId: workspace?.id || existing?.wsId || '',
      title: title.trim(),
      text: text.trim(),
      state: existing?.state || 'todo',
      sessionId: existing?.sessionId,
    };
    persist(kind, editing === 'new' ? [...currentList, item] : currentList.map(x => (x.id === item.id ? item : x)));
    setEditing(null);
  };

  const deliver = async (item: SavedItem) => {
    setSending(item.id);
    try {
      const target =
        sessions.find(s => s.id === recipient && (!workspace || s.wsId === workspace.id) && isSessionActive(s)) ||
        sessions.find(s => (!workspace || s.wsId === workspace.id) && isSessionActive(s)) ||
        sessions.find(s => isSessionActive(s));
      if (!target) throw new Error('ไม่พบ session ที่พร้อมใช้งานในขณะนี้ กรุณาเปิด session ก่อน');
      const summary = (view === 'tasks' && attachLatestSummary) ? getLatestSummary() : null;
      const deliverText = summary
        ? formatHandoffPrompt({ agentName: summary.agentName, text: summary.text, nextInstruction: item.text })
        : item.text;
      if (paneView(target) === 'chat') {
        const result = await post<{ queued?: boolean }>(`/api/terminals/${target.id}/chat`, { text: deliverText });
        if (!result) throw new Error('ส่งงานเข้าแชตไม่สำเร็จ กรุณาตรวจ session');
      } else {
        const result = await post(`/api/terminals/${target.id}/input`, { input: deliverText + '\r' });
        if (!result.success) throw new Error('ส่งงานเข้า Terminal ไม่สำเร็จ กรุณาตรวจ session');
      }
      persist(kind, currentList.map(x => (x.id === item.id ? { ...x, state: 'sent', sessionId: target.id } : x)));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSending('');
    }
  };

  const activeCount = sessions.filter(isSessionActive).length;
  const stoppedCount = sessions.filter(s => !isSessionActive(s)).length;

  return (
    <aside className={`right-dock ${open ? '' : 'not-visible'}`} style={{ width }} aria-label="แผงเครื่องมือ">
      <div
        className="dock-resize"
        role="separator"
        aria-label="ปรับขนาดแผงด้านขวา"
        aria-orientation="vertical"
        tabIndex={0}
        onKeyDown={e => {
          if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            changeWidth(width + (e.key === 'ArrowLeft' ? 24 : -24));
          }
        }}
        onPointerDown={e => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setResizing(true);
        }}
        onPointerMove={e => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) changeWidth(innerWidth - e.clientX);
        }}
        onPointerUp={e => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          setResizing(false);
        }}
        onPointerCancel={() => setResizing(false)}
      />
      <nav className="dock-tabs" aria-label="เครื่องมือด้านขวา">
        {(
          [
            ['dashboard', 'สถานะ', Activity],
            ['tasks', 'งาน', ClipboardList],
            ['prompts', 'พรอมป์ต์', MessageSquare],
            ['files', 'ไฟล์', Folder],
            ['browser', 'Browser', Globe],
          ] as const
        ).map(([value, label, Icon]) => (
          <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>
            <Icon size={12} />
            {label}
          </button>
        ))}
        <button className="icon-button" title="ปิดแผงด้านขวา" onClick={close}>
          <X size={14} />
        </button>
      </nav>
      <div className={`dock-browser ${view === 'browser' ? '' : 'not-visible'}`}>
        <PreviewPanel
          embedded
          onClose={close}
          suspended={!open || view !== 'browser' || suspended || resizing}
          onError={onError}
          request={previewRequest}
          workspaceId={workspace?.id}
        />
      </div>
      {view === 'files' && (
        <FileExplorerPanel
          workspace={workspace}
          onOpenFile={onOpenFile}
          onError={onError}
        />
      )}
      {view !== 'browser' && view !== 'files' && (
        <div className="dock-content">
          {view === 'dashboard' ? (
            <>
              <div className="dock-summary">
                <strong>{sessions.length}</strong>
                <div>
                  <h2>session ทั้งหมด</h2>
                  <p>
                    {activeCount} session พร้อมใช้งาน · {stoppedCount} หยุด / ปิดแล้ว
                  </p>
                </div>
              </div>
              <p className="dock-note">สถานะ session ในโปรเจกต์ · แชตและ Terminal พร้อมรับคำสั่ง</p>
              <div className="dock-filters">
                {[
                  ['all', 'ทั้งหมด'],
                  ['running', 'เปิดอยู่'],
                  ['exited', 'จบแล้ว'],
                  ['error', 'ผิดพลาด'],
                ].map(([value, label]) => (
                  <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="dock-section-heading">
              <div>
                <h2>{view === 'tasks' ? 'งานของโปรเจกต์' : 'พรอมป์ต์ที่บันทึก'}</h2>
                <p>{workspace?.name || 'โปรเจกต์ปัจจุบัน'} · บันทึกบนเครื่อง</p>
              </div>
              <button
                className="icon-button"
                title={view === 'tasks' ? 'เพิ่มงาน' : 'เพิ่มพรอมป์ต์'}
                onClick={() => edit()}
              >
                <Plus size={16} />
              </button>
            </div>
          )}

          <label className="dock-search">
            <Search size={13} />
            <input
              aria-label="ค้นหาในแผง"
              placeholder="ค้นหา…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>

          {view === 'dashboard' ? (
            <>
              <div className="dock-list">
                {matching.map(s => {
                  const isChat = paneView(s) === 'chat';
                  const isActive = isSessionActive(s);
                  return (
                    <button
                      className={`session-summary ${selected === s.id ? 'active' : ''}`}
                      key={s.id}
                      onClick={() => onSelect(s)}
                    >
                      <span className={`status-dot ${isActive ? '' : s.status === 'error' ? 'bad' : 'offline'}`} />
                      <span>
                        <strong>{s.name}</strong>
                        <small>
                          {s.agentType} · {workspaces.find(w => w.id === s.wsId)?.name || s.cwd}{' '}
                          {isChat ? '· แชต' : '· Terminal'}
                        </small>
                      </span>
                      <small>
                        {s.status === 'error'
                          ? 'ผิดพลาด'
                          : s.status === 'stopping'
                            ? 'กำลังปิด'
                            : isChat
                              ? 'แชตพร้อมใช้'
                              : s.status === 'running'
                                ? 'เปิดอยู่'
                                : 'จบแล้ว'}
                      </small>
                    </button>
                  );
                })}
                {!matching.length && <p className="dock-empty">ยังไม่มี session ที่ตรงกับตัวกรอง</p>}
              </div>
              {runs.length > 0 && (
                <section className="dock-runs">
                  <h3>ประวัติผู้ช่วยในโปรเจกต์นี้</h3>
                  {runs.slice(0, 15).map(run => (
                    <button
                      key={run.id}
                      type="button"
                      className="dock-run-item"
                      title="คลิกเพื่อนำคำสั่งนี้ไปใส่ในช่องคำสั่ง"
                      onClick={() => onPrompt(run.prompt)}
                    >
                      <strong>{run.prompt}</strong>
                      <small>
                        {run.status === 'completed'
                          ? 'เสร็จแล้ว'
                          : run.status === 'running'
                            ? 'กำลังทำงาน'
                            : run.status === 'failed'
                              ? 'ผิดพลาด'
                              : 'ยกเลิกแล้ว'}
                      </small>
                    </button>
                  ))}
                </section>
              )}
            </>
          ) : (
            <>
              {view === 'tasks' && (
                <div className="task-handoff-controls">
                  <label className="task-target">
                    ส่งงานไปที่
                    <select
                      aria-label="session รับงาน"
                      value={recipient}
                      onChange={e => setRecipient(e.target.value)}
                    >
                      <option value="">เลือก session รับงาน</option>
                      {(projectActiveSessions.length ? projectActiveSessions : activeSessions).map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({paneView(s) === 'chat' ? 'แชต' : 'Terminal'})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="task-attach-summary-toggle">
                    <input
                      type="checkbox"
                      checked={attachLatestSummary}
                      onChange={e => setAttachLatestSummary(e.target.checked)}
                    />
                    <span>แนบข้อสรุปล่าสุดจาก AI อื่น</span>
                  </label>
                </div>
              )}
              {editing && (
                <form
                  className="dock-editor"
                  onSubmit={e => {
                    e.preventDefault();
                    save();
                  }}
                >
                  <label>
                    ชื่อ
                    <input
                      aria-label="ชื่อรายการ"
                      required
                      maxLength={120}
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                    />
                  </label>
                  <label>
                    ข้อความ
                    <textarea
                      aria-label="ข้อความรายการ"
                      required
                      maxLength={20000}
                      rows={5}
                      value={text}
                      onChange={e => setText(e.target.value)}
                    />
                  </label>
                  <div className="inline">
                    <button className="primary compact" type="submit">
                      บันทึกรายการ
                    </button>
                    <button className="text-button" type="button" onClick={() => setEditing(null)}>
                      ยกเลิก
                    </button>
                  </div>
                </form>
              )}
              <div className="dock-list">
                {items.map(item => (
                  <article className="saved-item" key={item.id}>
                    <div className="saved-item-heading">
                      <strong>{item.title}</strong>
                      {view === 'tasks' && (
                        <small>{item.state === 'done' ? 'เสร็จแล้ว' : item.state === 'sent' ? 'ส่งแล้ว' : 'ยังไม่ส่ง'}</small>
                      )}
                    </div>
                    <p>{item.text}</p>
                    <div className="saved-item-actions">
                      <button
                        className="text-button"
                        disabled={!!sending || (view === 'tasks' && item.state === 'done')}
                        onClick={() => void deliver(item)}
                      >
                        <Play size={12} />
                        {sending === item.id ? 'กำลังส่ง…' : 'ส่งเข้า session'}
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          const summary = view === 'tasks' && attachLatestSummary ? getLatestSummary() : null;
                          const promptText = summary
                            ? formatHandoffPrompt({ agentName: summary.agentName, text: summary.text, nextInstruction: item.text })
                            : item.text;
                          onPrompt(promptText);
                        }}
                      >
                        {view === 'tasks' ? 'ใส่ในช่องคำสั่ง' : 'ใช้พรอมป์ต์'}
                      </button>
                      {view === 'tasks' && (
                        <button
                          className="text-button"
                          title="ส่งต่องานนี้พร้อมข้อสรุปไปยัง session ที่เลือก"
                          onClick={() => {
                            const summary = getLatestSummary();
                            const promptText = summary
                              ? formatHandoffPrompt({ agentName: summary.agentName, text: summary.text, nextInstruction: item.text })
                              : formatHandoffPrompt({ agentName: 'AI', text: item.text, nextInstruction: 'ช่วยดำเนินการต่อตามนี้' });
                            if (recipient) {
                              dispatchHandoff(recipient, promptText);
                            } else {
                              onPrompt(promptText);
                            }
                          }}
                        >
                          <Forward size={12} />
                          ส่งต่องาน
                        </button>
                      )}
                      {view === 'tasks' && (
                        <button
                          className="text-button"
                          onClick={() =>
                            persist(
                              'tasks',
                              tasks.map(x => (x.id === item.id ? { ...x, state: x.state === 'done' ? 'todo' : 'done' } : x))
                            )
                          }
                        >
                          <Check size={12} />
                          {item.state === 'done' ? 'เปิดงานอีกครั้ง' : 'ทำเครื่องหมายเสร็จ'}
                        </button>
                      )}
                      <button className="text-button" onClick={() => edit(item)}>
                        แก้ไข
                      </button>
                      <button
                        className="icon-button"
                        title={`ลบ ${item.title}`}
                        disabled={!!sending}
                        onClick={() => persist(kind, currentList.filter(x => x.id !== item.id))}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </article>
                ))}
                {!items.length && !editing && (
                  <p className="dock-empty">
                    {view === 'tasks'
                      ? 'เพิ่มงานแล้วส่งคำสั่งให้ session ที่เลือก เมื่อทำเสร็จให้ทำเครื่องหมายด้วยตนเอง'
                      : 'บันทึกคำสั่งที่ใช้บ่อย แล้วกดใช้เพื่อใส่ในช่องคำสั่งก่อนส่ง'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
