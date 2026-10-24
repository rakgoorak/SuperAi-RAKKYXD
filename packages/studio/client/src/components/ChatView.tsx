import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Circle, Clock3, FilePen, FileText, Globe, ListChecks, Loader2, Paperclip, Search, Send, Terminal as TerminalIcon, Wrench, X } from 'lucide-react';
import { Markdown } from './Markdown';
import { post } from '../api';
import { prepareMessage, recoveryHint, showChanges } from '../recovery';
import { getSuggestions } from '../suggestions';
import { NextSteps } from './NextSteps';
import { ResponseActions } from './ResponseActions';
import { MessageAttachments } from './MessageAttachments';
import { timeLabel, tokenLabel } from '../chatFormat';

// Mirrors server/CliChat.ts.
type ToolKind = 'command' | 'read' | 'edit' | 'search' | 'web' | 'plan' | 'other';
type ToolItem = { id: string; kind: 'tool'; tool: ToolKind; title: string; output?: string; images?: string[]; status: 'running' | 'done' | 'failed'; at: number };
type TodoStatus = 'pending' | 'in_progress' | 'completed';
type TodosItem = { id: string; kind: 'todos'; todos: { text: string; status: TodoStatus }[]; at: number };
type Activity = { startedAt: number; outputTokens: number };
type Queued = { id: string; text: string; attachments?: string[] };
type ChatItem =
  | { id: string; kind: 'user'; text: string; attachments?: string[]; request?: { text: string; model?: string; effort?: string; skillId?: string; attachments?: string[] }; at: number }
  | { id: string; kind: 'assistant'; text: string; at: number }
  | ToolItem
  | TodosItem
  | { id: string; kind: 'error' | 'notice'; text: string; at: number };
type Message =
  | { type: 'snapshot'; chat: { items: ChatItem[]; running: boolean; activity?: Activity; queued?: Queued[] } }
  | { type: 'item'; item: ChatItem }
  | { type: 'state'; running: boolean }
  | { type: 'activity'; activity?: Activity }
  | { type: 'queue'; queued: Queued[] };
type Block = Exclude<ChatItem, ToolItem> | { id: string; kind: 'tools'; tools: ToolItem[] };

const ICONS = { command: TerminalIcon, read: FileText, edit: FilePen, search: Search, web: Globe, plan: ListChecks, other: Wrench };
const COUNTS: Record<ToolKind, (n: number) => string> = {
  command: (n) => `รัน ${n} คำสั่ง`, read: (n) => `อ่าน ${n} ไฟล์`, edit: (n) => `แก้ ${n} ไฟล์`, search: (n) => `ค้นหา ${n} ครั้ง`,
  web: (n) => `เปิดเว็บ ${n} ครั้ง`, plan: () => 'อัปเดตแผนงาน', other: (n) => `ใช้เครื่องมือ ${n} ครั้ง`,
};

/** Consecutive tool calls fold into one row, like "Ran 2 commands, read 1 file". */
function blocks(items: ChatItem[]): Block[] {
  const out: Block[] = [];
  for (const item of items) {
    const last = out.at(-1);
    if (item.kind === 'tool' && last?.kind === 'tools') last.tools.push(item);
    else out.push(item.kind === 'tool' ? { id: `g-${item.id}`, kind: 'tools', tools: [item] } : item);
  }
  return out;
}

function summary(tools: ToolItem[]) {
  const counts = new Map<ToolKind, number>();
  for (const t of tools) counts.set(t.tool, (counts.get(t.tool) || 0) + 1);
  return [...counts].map(([kind, n]) => COUNTS[kind](n)).join(' · ');
}

/** A screenshot from a tool; click to see it full width. */
function Shot({ src, small = false }: { src: string; small?: boolean }) {
  const [big, setBig] = useState(false);
  return <button type="button" className={`chat-shot ${small ? 'thumb' : ''} ${big ? 'big' : ''}`} title={big ? 'ย่อรูป' : 'ดูรูปเต็ม'}
    onClick={(e) => { e.stopPropagation(); setBig(!big); }}><img src={src} alt="ภาพจากเครื่องมือ" loading="lazy" /></button>;
}

function ToolRow({ tool }: { tool: ToolItem }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[tool.tool] || Wrench;
  return (
    <li className={`chat-tool ${tool.status}`}>
      <button className="chat-tool-row" onClick={() => setOpen(!open)} disabled={!tool.output && !tool.images?.length} aria-expanded={open}>
        {tool.status === 'running' ? <Loader2 size={13} className="spin" /> : <Icon size={13} />}
        <code>{tool.title}</code>
        {tool.status === 'failed' && <span className="chat-tool-failed">ไม่สำเร็จ</span>}
      </button>
      {open && tool.output && <pre>{tool.output.trimEnd()}</pre>}
      {open && tool.images?.length ? <div className="chat-shots">{tool.images.map((src, i) => <Shot key={i} src={src} />)}</div> : null}
    </li>
  );
}

/** Folded steps, like Claude's "Resized browser, waited, captured page ▸", with screenshot thumbnails. */
function ToolGroup({ tools }: { tools: ToolItem[] }) {
  const running = tools.find((t) => t.status === 'running');
  const [open, setOpen] = useState(false);
  const images = tools.flatMap((t) => t.images || []);
  return (
    <div className="chat-tools">
      <div className="chat-tools-head">
        <button className="chat-tools-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className={`chat-dot ${running ? 'running' : tools.some((t) => t.status === 'failed') ? 'failed' : ''}`} />
          <span>{running ? `กำลังทำงาน: ${running.title.split('\n')[0]}` : summary(tools)}</span>
          <ChevronRight size={13} className={`chat-chevron ${open ? 'open' : ''}`} />
        </button>
        {!open && images.length > 0 && <span className="chat-thumbs">{images.slice(-3).map((src, i) => <Shot key={i} src={src} small />)}</span>}
      </div>
      {open && <ul>{tools.map((t) => <ToolRow key={t.id} tool={t} />)}</ul>}
    </div>
  );
}

/** The CLI's task list as a live checklist: ✓ done, spinner in progress, ○ waiting. */
function TaskList({ item, live }: { item: TodosItem; live: boolean }) {
  const done = item.todos.filter((t) => t.status === 'completed').length;
  const [open, setOpen] = useState(true);
  return (
    <section className={`chat-tasks ${live ? 'live' : ''}`} aria-label="รายการงานของ AI">
      <button type="button" className="chat-tasks-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ListChecks size={14} /><span>รายการงาน</span><small>{done}/{item.todos.length}</small>
        <ChevronRight size={13} className={`chat-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && <ol>
        {item.todos.map((t, i) => <li key={i} className={t.status}>
          {t.status === 'completed' ? <CheckCircle2 size={15} /> : t.status === 'in_progress' && live ? <Loader2 size={15} className="spin" /> : <Circle size={15} />}
          <span>{t.text}</span>
        </li>)}
      </ol>}
    </section>
  );
}

/**
 * Claude-style view of a Code session: messages and folded tool calls from the CLI's JSON stream.
 * Typing, files, Model/Effort, /skills and sign-in live in the bottom composer.
 */
export function ChatView({ sessionId, name }: { sessionId: string; name: string }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [running, setRunning] = useState(false);
  const [activity, setActivity] = useState<Activity | undefined>();
  const [queued, setQueued] = useState<Queued[]>([]);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now());
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const jumpToSaved = () => {
    try {
      const id = localStorage.getItem(`superai-jump:${sessionId}`);
      const item = id && Array.from(scroller.current?.querySelectorAll<HTMLElement>('[data-message-id]') || []).find(element => element.dataset.messageId === id);
      if (item) { item.scrollIntoView({ block: 'center' }); stick.current = false; localStorage.removeItem(`superai-jump:${sessionId}`); return true; }
    } catch {}
    return false;
  };
  useEffect(() => {
    const jump = (event: Event) => { if ((event as CustomEvent<string>).detail === sessionId) { setSearch(''); requestAnimationFrame(jumpToSaved); } };
    window.addEventListener('superai:jump-message', jump);
    return () => window.removeEventListener('superai:jump-message', jump);
  }, [sessionId]);
  const restored = useRef(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  const [search, setSearch] = useState('');
  const lastUser = [...items].reverse().find(item => item.kind === 'user');
  const lastReply = [...items].reverse().find(item => item.kind === 'assistant');
  const replyIndex = lastReply ? items.indexOf(lastReply) : -1;
  const turnItems = lastUser ? items.slice(items.indexOf(lastUser) + 1) : [];
  const turnFailed = turnItems.some(item => item.kind === 'error');
  const turnEdited = turnItems.some(item => item.kind === 'tool' && item.tool === 'edit');
  const canSuggest = !running && !pending && !offline && !search.trim() && lastReply && lastUser
    && replyIndex > items.indexOf(lastUser) && !items.slice(items.indexOf(lastUser) + 1).some(item => item.kind === 'error');
  const nextSteps = canSuggest ? getSuggestions({ mode: 'code', lastRun: { status: 'completed', output: lastReply.text } }) : [];
  const retry = async () => {
    if (!lastUser || lastUser.kind !== 'user') return;
    setPending(true); setProblem('');
    try { await post(`/api/terminals/${sessionId}/chat`, lastUser.request || { text: lastUser.text }); }
    catch (error) { setProblem((error as Error).message); }
    finally { setPending(false); }
  };

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let disposed = false;
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws/chat/${sessionId}`);
      socket.onopen = () => setOffline(false);
      socket.onmessage = (event) => {
        let message: Message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'snapshot') { setItems(message.chat.items); setRunning(message.chat.running); setActivity(message.chat.activity); setQueued(message.chat.queued || []); }
        else if (message.type === 'state') setRunning(message.running);
        else if (message.type === 'activity') setActivity(message.activity);
        else if (message.type === 'queue') setQueued(message.queued);
        else if (message.type === 'item') {
          const item = message.item;
          setItems((current) => {
            const index = current.findIndex((i) => i.id === item.id);
            if (index < 0) return [...current, item];
            const next = [...current];
            next[index] = item;
            return next;
          });
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        setOffline(true);
        retry = window.setTimeout(connect, 1500);
      };
    };
    connect();
    return () => { disposed = true; window.clearTimeout(retry); socket?.close(); };
  }, [sessionId]);

  // Every second while working (live counter), every half minute otherwise (message times).
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), running ? 1000 : 30000);
    return () => window.clearInterval(timer);
  }, [running]);

  // Follow new output unless the user scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !items.length) return;
    if (jumpToSaved()) { restored.current = true; return; }
    if (!restored.current) {
      restored.current = true;
      try {
        const saved = localStorage.getItem(`superai-scroll:${sessionId}`);
        if (saved !== null) { el.scrollTop = Number(saved) || 0; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; return; }
      } catch {}
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [items, running]);

  const started = activity?.startedAt ?? [...items].reverse().find((i) => i.kind === 'user')?.at ?? now;
  const seconds = Math.max(0, Math.round((now - started) / 1000));
  // The task list of the turn in progress stays pinned above the live counter, like Claude's.
  const liveTodos = running && lastUser ? [...turnItems].reverse().find((item): item is TodosItem => item.kind === 'todos') : undefined;
  const queueAction = (id: string, action: 'send' | 'remove') => {
    post(`/api/terminals/${sessionId}/chat/queue/${id}/${action}`).catch((error) => setProblem((error as Error).message));
  };

  return (
    <div className="chat-view">
      <label className="chat-history-search"><Search size={13} /><input aria-label={`ค้นหาในแชต ${name}`} placeholder="ค้นหาในบทสนทนานี้…" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="chat-scroll" ref={scroller} onScroll={(e) => {
        const el = e.currentTarget;
        try { if (!search.trim()) localStorage.setItem(`superai-scroll:${sessionId}`, String(el.scrollTop)); } catch {}
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      }}>
        <div className="chat-column">
          {!items.length && (
            <div className="chat-empty">
              <strong>คุยกับ {name}</strong>
              <span>พิมพ์ในช่องคำสั่งด้านล่างแล้วกดส่ง {name} ทำงานในโฟลเดอร์โปรเจกต์นี้ แก้ไฟล์และรันคำสั่งได้เอง</span>
              <small>เลือก Model, Effort, /skills และเข้าสู่ระบบได้ที่ช่องคำสั่งด้านล่าง เมื่อเลือก session นี้อยู่</small>
            </div>
          )}
          {blocks(items).filter(block => !search.trim() || (block.kind === 'tools' ? block.tools.map(t => t.title + ' ' + (t.output || '')).join(' ') : block.kind === 'todos' ? block.todos.map(t => t.text).join(' ') : block.text).toLowerCase().includes(search.trim().toLowerCase())).map((block) => {
            if (block.kind === 'user')
              return (
                <div key={block.id} data-message-id={block.id} className="chat-user">
                  <div>
                    {block.text}
                    <button className="edit-message" disabled={running || pending} onClick={() => { prepareMessage(block.text, sessionId); if (block.attachments?.length) setProblem('กรุณาแนบไฟล์เดิมอีกครั้งก่อนส่งข้อความที่แก้ไข'); }}>แก้ข้อความแล้วส่งใหม่</button>
                    <MessageAttachments paths={block.attachments} endpoint={`/api/terminals/${encodeURIComponent(sessionId)}/preview-file`} />
                    <time className="chat-time" dateTime={new Date(block.at).toISOString()} title={new Date(block.at).toLocaleString('th-TH')}>{timeLabel(block.at, now)}</time>
                  </div>
                </div>
              );
            if (block.kind === 'assistant') {
              const latest = block.id === lastReply?.id && !!lastUser && replyIndex > items.indexOf(lastUser);
              const currentTurn = !!lastUser && items.indexOf(block) > items.indexOf(lastUser);
              return <div key={block.id} data-message-id={block.id}>
                <div className="chat-assistant"><Markdown text={block.text} /></div>
                {!(running && currentTurn) && <ResponseActions text={block.text} at={block.at} now={now} disabled={pending || offline || running}
                  onRetry={latest && !turnFailed && !search.trim() && (lastUser?.request || !lastUser?.attachments?.length) ? () => void retry() : undefined}
                  onEdit={latest ? () => { prepareMessage(lastUser!.text, sessionId, { expand: false }); if (lastUser!.attachments?.length) setProblem('กรุณาแนบไฟล์เดิมอีกครั้งก่อนส่งข้อความที่แก้ไข'); } : undefined}
                  onChanges={latest && turnEdited ? () => showChanges(sessionId) : undefined} />}
                {block.id === lastReply?.id && <NextSteps items={nextSteps} sessionId={sessionId} />}
              </div>;
            }
            if (block.kind === 'tools') return <ToolGroup key={block.id} tools={block.tools} />;
            if (block.kind === 'todos') return block === liveTodos ? null : <TaskList key={block.id} item={block} live={false} />;
            if (block.kind === 'error') return <div key={block.id} role="alert" className="chat-error"><AlertTriangle size={14} /><span>{block.text}</span></div>;
            return <div key={block.id} className="chat-notice">{block.text}</div>;
          })}
          {liveTodos && <TaskList key={liveTodos.id} item={liveTodos} live />}
          {running && (
            <div className="chat-working" role="status" title={`${name} กำลังทำงาน · กดหยุดได้ที่ช่องคำสั่งด้านล่าง`}>
              <span className="chat-pulse" aria-hidden="true"><i /><i /><i /></span>
              {/* Codex reports tokens only when its turn ends: show the time alone until then. */}
              <span>{activity?.outputTokens ? `${tokenLabel(activity.outputTokens)} tokens · ` : ''}{seconds >= 60 ? `${Math.floor(seconds / 60)} นาที ${seconds % 60} วิ` : `${seconds} วิ`}</span>
            </div>
          )}
          {queued.length > 0 && (
            <div className="chat-queue" aria-label="ข้อความที่รอคิว">
              {queued.map((q) => (
                <div key={q.id} className="chat-queued">
                  <Clock3 size={13} />
                  <span>{q.text}{q.attachments?.length ? <small><Paperclip size={11} /> {q.attachments.join(', ')}</small> : null}</span>
                  <small>{running ? 'รอคิว' : 'หยุดไว้'}</small>
                  {!running && <button type="button" title="ส่งข้อความนี้เลย" onClick={() => queueAction(q.id, 'send')}><Send size={13} /></button>}
                  <button type="button" title="เอาออกจากคิว" onClick={() => queueAction(q.id, 'remove')}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
          {!running && lastUser && turnFailed && <div className="recovery-actions"><button disabled={pending || offline || (!lastUser.request && !!lastUser.attachments?.length)} onClick={() => void retry()}>ลองส่งอีกครั้ง</button></div>}
          {problem && <div role="alert" className="chat-error">{recoveryHint(problem)}<br />{problem}</div>}
          {items.at(-1)?.kind === 'error' && <p className="recovery-note">{recoveryHint((items.at(-1) as { text: string }).text)} <button onClick={() => window.dispatchEvent(new Event('superai:open-setup'))}>ตรวจบัญชีและเครื่องมือ</button></p>}
          {offline && <div className="chat-notice">ขาดการเชื่อมต่อ กำลังเชื่อมต่อใหม่…</div>}
        </div>
      </div>
    </div>
  );
}
