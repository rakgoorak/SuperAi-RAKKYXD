import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck, Check, CheckCheck, CheckCircle2, ChevronRight, Circle, Clock3, Copy, FilePen, FileText, GitFork, Globe, ListChecks, Loader2, Paperclip, RotateCcw, Search, Send, Terminal as TerminalIcon, Wrench, X } from 'lucide-react';
import { Markdown } from './Markdown';
import { post } from '../api';
import { prepareMessage, recoveryHint, showChanges } from '../recovery';
import { getSuggestions } from '../suggestions';
import { NextSteps } from './NextSteps';
import { ResponseActions } from './ResponseActions';
import { ConversationInteractions } from './ConversationInteractions';
import { ConversationExport } from './ConversationExport';
import { ArrowDown, Pencil } from 'lucide-react';
import { MessageAttachments } from './MessageAttachments';
import { stepLabel } from '../stepLabel';
import { QuestionCard, type QuestionItem } from './QuestionCard';
import { hideQuestionBlock } from '../questionBlock';
import { ImageEndpointContext } from './MarkdownImage';
import { ImageViewer } from './ImageViewer';
import { renderTextWithLinks } from '../previewLinks';
import { timeLabel, tokenLabel } from '../chatFormat';
import { taskProgressNote } from '../taskProgress';
import { createItemBatch } from '../chatStreamBatch';
import { notifyDone, sessionNotice } from '../completionNotify';
import { loadNextPromptSettings, predictNextPrompt, publishChatRunning, publishNextPrompt } from '../nextPrompt';
import '../chat-idle.css';
import '../chat-permission.css';
import '../chat-task-progress.css';
import { tr } from '../i18n';

// Mirrors server/CliChat.ts.
type ToolKind = 'command' | 'read' | 'edit' | 'search' | 'web' | 'plan' | 'other';
type ToolItem = { id: string; kind: 'tool'; tool: ToolKind; title: string; output?: string; images?: string[]; status: 'running' | 'done' | 'failed'; at: number };
type TodoStatus = 'pending' | 'in_progress' | 'completed';
type TodosItem = { id: string; kind: 'todos'; todos: { text: string; status: TodoStatus }[]; at: number };
type Activity = { startedAt: number; outputTokens: number; quiet?: { since: number; timeoutMs: number } };
type Queued = { id: string; text: string; attachments?: string[] };
type ChatItem =
  | { id: string; kind: 'user'; text: string; attachments?: string[]; request?: { text: string; model?: string; effort?: string; skillId?: string; attachments?: string[] }; at: number }
  | { id: string; kind: 'assistant'; text: string; at: number }
  | ToolItem
  | TodosItem
  | { id: string; kind: 'error' | 'notice'; text: string; at: number }
  | PermissionItem
  | QuestionItem;
type PermissionItem = { id: string; kind: 'permission'; requestId: string; tool: string; title: string; detail?: string; canAlways?: boolean; status: 'pending' | 'allowed' | 'always' | 'denied' | 'expired'; at: number };
type Message =
  | { type: 'snapshot'; chat: { items: ChatItem[]; running: boolean; activity?: Activity; queued?: Queued[] } }
  | { type: 'item'; item: ChatItem }
  | { type: 'state'; running: boolean }
  | { type: 'activity'; activity?: Activity }
  | { type: 'queue'; queued: Queued[] };
type Block = Exclude<ChatItem, ToolItem> | { id: string; kind: 'tools'; tools: ToolItem[] };

const ICONS = { command: TerminalIcon, read: FileText, edit: FilePen, search: Search, web: Globe, plan: ListChecks, other: Wrench };
const COUNTS: Record<ToolKind, (n: number) => string> = {
  command: (n) => tr`เรียกคำสั่ง ${n} ครั้ง`, read: (n) => tr`เรียกอ่านไฟล์ ${n} ครั้ง`, edit: (n) => tr`เรียกแก้ไฟล์ ${n} ครั้ง`, search: (n) => tr`ค้นหา ${n} ครั้ง`,
  web: (n) => tr`เปิดเว็บ ${n} ครั้ง`, plan: () => tr("อัปเดตแผนงาน"), other: (n) => tr`ใช้เครื่องมือ ${n} ครั้ง`,
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
  const [open, setOpen] = useState(false);
  return <><button type="button" className={`chat-shot ${small ? 'thumb' : ''}`} title={tr("ดูรูปและซูม")}
    onClick={(e) => { e.stopPropagation(); setOpen(true); }}><img src={src} alt={tr("ภาพจากเครื่องมือ")} loading="lazy" /></button>
    {open && <ImageViewer image={{ src, name: tr("ภาพจากเครื่องมือ") }} onClose={() => setOpen(false)} />}</>;
}

function toolBadge(kind: ToolKind) {
  switch (kind) {
    case "command": return tr("คำสั่ง");
    case "read": return tr("อ่านไฟล์");
    case "edit": return tr("แก้ไขโค้ด");
    case "search": return tr("ค้นหา");
    case "web": return tr("เว็บ");
    case "plan": return tr("แผนงาน");
    default: return tr("งาน");
  }
}

function ToolRow({ tool }: { tool: ToolItem }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[tool.tool] || Wrench;
  return (
    <li className={`chat-tool ${tool.status}`}>
      <button className="chat-tool-row" onClick={() => setOpen(!open)} disabled={!tool.output && !tool.images?.length} aria-expanded={open}>
        {tool.status === 'running' ? <Loader2 size={13} className="spin" /> : <Icon size={13} />}
        <span className="chat-tool-badge">{toolBadge(tool.tool)}</span>
        <code>{tool.title}</code>
        {tool.status === 'failed' && <span className="chat-tool-failed">{tr("ไม่สำเร็จ")}</span>}
      </button>
      {open && tool.output && <pre data-search-body>{tool.output.trimEnd()}</pre>}
      {open && tool.images?.length ? <div className="chat-shots">{tool.images.map((src, i) => <Shot key={i} src={src} />)}</div> : null}
    </li>
  );
}

function permissionResult(status: PermissionItem['status']) {
  switch (status) {
    case "pending": return tr("รอคำตอบ");
    case "allowed": return tr("ส่งคำอนุญาตแล้ว");
    case "always": return tr("ส่งคำอนุญาตแล้ว · จำสิทธิ์ในห้องนี้");
    case "denied": return tr("ส่งคำปฏิเสธแล้ว");
    case "expired": return tr("คำขอหมดอายุหรือส่งไม่สำเร็จ");
  }
}
/** Claude asks before using a tool its permission mode does not cover, like the prompt in Claude's own app. */
function PermissionCard({ item, sessionId, name, inPopup = false }: { item: PermissionItem; sessionId: string; name: string; inPopup?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const answer = async (decision: 'allow' | 'always' | 'deny') => {
    setBusy(true); setProblem('');
    try { await post(`/api/terminals/${sessionId}/chat/permission`, { requestId: item.requestId, decision }); }
    catch (error) { setProblem((error as Error).message); }
    finally { setBusy(false); }
  };
  const pending = item.status === 'pending';
  return <div className={`chat-permission ${item.status}`} role={pending && !inPopup ? 'alertdialog' : undefined} aria-label={tr`${name} ขออนุญาต${item.title}`}>
    <div className="chat-permission-head"><ShieldCheck size={15} /><strong>{name} {tr("ขออนุญาต")}{item.title}</strong>{!pending && <small>{permissionResult(item.status)}</small>}</div>
    {item.detail && <pre>{item.detail}</pre>}
    {pending && <div className="chat-permission-actions">
      <button className="primary" disabled={busy} onClick={() => void answer('allow')}>{tr("อนุญาต")}</button>
      {item.canAlways !== false && <button className="secondary" disabled={busy} onClick={() => void answer('always')} title={tr`ไม่ต้องถามอีกสำหรับ ${item.tool} ในห้องนี้`}>{tr("อนุญาตตลอดห้องนี้")}</button>}
      <button className="secondary" disabled={busy} onClick={() => void answer('deny')}>{tr("ไม่อนุญาต")}</button>
    </div>}
    {problem && <small role="alert">{problem}</small>}
  </div>;
}

/** Folded steps, like Claude's "Resized browser, waited, captured page ▸", with screenshot thumbnails. */
const ToolGroup = memo(function ToolGroup({ tools }: { tools: ToolItem[] }) {
  const running = tools.find((t) => t.status === 'running');
  const [open, setOpen] = useState(false);
  const images = tools.flatMap((t) => t.images || []);
  return (
    <div className="chat-tools">
      <div className="chat-tools-head">
        <button className="chat-tools-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className={`chat-dot ${running ? 'running' : tools.some((t) => t.status === 'failed') ? 'failed' : ''}`} />
          <span title={running ? running.title : undefined}>{running ? tr`กำลังทำงาน: ${stepLabel(running.title)}` : summary(tools)}</span>
          <ChevronRight size={13} className={`chat-chevron ${open ? 'open' : ''}`} />
        </button>
        {!open && images.length > 0 && <span className="chat-thumbs">{images.slice(-3).map((src, i) => <Shot key={i} src={src} small />)}</span>}
      </div>
      {open && <ul>{tools.map((t) => <ToolRow key={t.id} tool={t} />)}</ul>}
    </div>
  );
});

/** The CLI's task list as a live checklist: ✓ done, spinner in progress, ○ waiting. */
function TaskList({ item, live, items }: { item: TodosItem; live: boolean; items: ChatItem[] }) {
  const done = item.todos.filter((t) => t.status === 'completed').length;
  const [open, setOpen] = useState(true);
  return (
    <section className={`chat-tasks ${live ? 'live' : ''}`} aria-label={tr("รายการงานของ AI")}>
      <button type="button" className="chat-tasks-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ListChecks size={14} /><span>{tr("รายการงาน")}</span><small>{done}/{item.todos.length}</small>
        <ChevronRight size={13} className={`chat-chevron ${open ? 'open' : ''}`} />
      </button>
      <p className="chat-task-progress" role="status">{taskProgressNote(items, items.indexOf(item), item.at, done === item.todos.length)}</p>
      {open && <ol>
        {item.todos.map((t, i) => <li key={i} className={t.status}>
          {t.status === 'completed' ? <CheckCircle2 size={15} /> : t.status === 'in_progress' && live ? <Loader2 size={15} className="spin" /> : <Circle size={15} />}
          <span>{t.text}</span>
        </li>)}
      </ol>}
    </section>
  );
}

function UserMessageItem({
  block,
  sessionId,
  running,
  pending,
  now,
  onProblem,
}: {
  block: Extract<ChatItem, { kind: 'user' }>;
  sessionId: string;
  running: boolean;
  pending: boolean;
  now: number;
  onProblem: (msg: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      clearTimeout(copyTimer.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(block.text);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      onProblem(tr("คัดลอกข้อความไม่ได้ กรุณาลองเลือกข้อความแล้วคัดลอกเอง"));
    }
  };

  const handleEdit = () => {
    prepareMessage(block.text, sessionId, { expand: false });
    if (block.attachments?.length) {
      onProblem(tr("กรุณาแนบไฟล์เดิมอีกครั้งก่อนส่งข้อความที่แก้ไข"));
    }
  };

  const handleFork = async () => {
    try {
      const session = await post(`/api/terminals/${encodeURIComponent(sessionId)}/chat/fork`, { messageId: block.id });
      window.dispatchEvent(new CustomEvent('superai:fork-created', { detail: { session, sourceId: sessionId, side: false } }));
    } catch (error) { onProblem((error as Error).message); }
  };

  return (
    <div key={block.id} data-message-id={block.id} className="chat-user">
      <div className="chat-user-wrap">
        <div className="chat-user-bubble">
          <div className="chat-user-text" data-message-body={block.id}>{renderTextWithLinks(block.text)}</div>
          {block.attachments && block.attachments.length > 0 && (
            <MessageAttachments
              paths={block.attachments}
              endpoint={`/api/terminals/${encodeURIComponent(sessionId)}/preview-file`}
            />
          )}
        </div>
        <div className="chat-user-meta">
          <span className="chat-user-status">
            <CheckCheck size={13} className="chat-user-check" aria-hidden="true" />
            <time
              className="chat-user-time"
              dateTime={new Date(block.at).toISOString()}
              title={new Date(block.at).toLocaleString('th-TH')}
            >
              {timeLabel(block.at, now)}
            </time>
          </span>
          <span className="chat-user-sep" aria-hidden="true">·</span>
          <div className="chat-user-actions" role="group" aria-label={tr("จัดการข้อความ")}>
            <button
              type="button"
              className="chat-user-action-btn"
              aria-label={copied ? tr("คัดลอกแล้ว") : tr("คัดลอกข้อความ")}
              title={copied ? tr("คัดลอกแล้ว") : tr("คัดลอกข้อความ")}
              onClick={() => void handleCopy()}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
            <button
              type="button"
              className="chat-user-action-btn"
              aria-label={tr("แก้ไขข้อความ")}
              title={tr("แก้ไขข้อความในช่องคำสั่ง")}
              disabled={running || pending}
              onClick={handleEdit}
            >
              <RotateCcw size={13} />
            </button>
            <button
              type="button"
              className="chat-user-action-btn"
              aria-label={tr("แยกแชตใหม่ (Fork)")}
              title={tr("สร้างห้องใหม่พร้อมประวัติถึงข้อความนี้ โดยเก็บห้องเดิมไว้")}
              disabled={running || pending}
              onClick={() => void handleFork()}
            >
              <GitFork size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Claude-style view of a Code session: messages and folded tool calls from the CLI's JSON stream.
 * Typing, files, Model/Effort, /skills and sign-in live in the bottom composer.
 */
export function ChatView({ sessionId, name, active = true }: { sessionId: string; name: string; active?: boolean }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [running, setRunning] = useState(false);
  const [activity, setActivity] = useState<Activity | undefined>();
  const [queued, setQueued] = useState<Queued[]>([]);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now());
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const [newOutput, setNewOutput] = useState(false);
  const lastOutput = useRef<ChatItem[] | null>(null);
  // Turn-finished notification: the previous `running` and the latest tab name for the socket handler.
  const wasRunning = useRef(false);
  const nameRef = useRef(name);
  nameRef.current = name;
  const activeRef = useRef(active);
  activeRef.current = active;
  const [dismissedPermissions, setDismissedPermissions] = useState<string[]>([]);
  const [turnsDone, setTurnsDone] = useState(0);
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
  const groupedBlocks = useMemo(() => blocks(items), [items]);
  const lastUser = [...items].reverse().find(item => item.kind === 'user');
  const lastReply = [...items].reverse().find(item => item.kind === 'assistant');
  const replyIndex = lastReply ? items.indexOf(lastReply) : -1;
  const turnItems = lastUser ? items.slice(items.indexOf(lastUser) + 1) : [];
  const turnFailed = turnItems.some(item => item.kind === 'error');
  const turnEdited = turnItems.some(item => item.kind === 'tool' && item.tool === 'edit');
  const canSuggest = !running && !pending && !offline && !search.trim() && lastReply && lastUser
    && replyIndex > items.indexOf(lastUser) && !items.slice(items.indexOf(lastUser) + 1).some(item => item.kind === 'error');
  const nextSteps = canSuggest ? getSuggestions({ mode: 'code', lastRun: { status: 'completed', output: lastReply.text } }) : [];
  // After each finished turn: grey next-message text in the composer. The answer's own next step first,
  // otherwise a small model's guess (can be turned off in Settings).
  useEffect(() => {
    if (!turnsDone || !canSuggest) return;
    if (nextSteps.length) { publishNextPrompt(sessionId, nextSteps[0].label); return; }
    if (!loadNextPromptSettings().ai) return;
    const controller = new AbortController();
    predictNextPrompt(sessionId, controller.signal).then(text => { if (!controller.signal.aborted) publishNextPrompt(sessionId, text); }).catch(() => {});
    return () => controller.abort();
  }, [turnsDone]);
  const retry = async () => {
    if (!lastUser || lastUser.kind !== 'user') return;
    setPending(true); setProblem('');
    try { await post(`/api/terminals/${sessionId}/chat`, lastUser.request || { text: lastUser.text }); }
    catch (error) { setProblem((error as Error).message); }
    finally { setPending(false); }
  };
  const quietAction = async (action: 'wait' | 'cancel') => {
    setPending(true); setProblem('');
    try { await post(`/api/terminals/${sessionId}/chat/${action}`); }
    catch (error) { setProblem((error as Error).message); }
    finally { setPending(false); }
  };

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let disposed = false;
    const itemBatch = createItemBatch<ChatItem>(updates => {
      if (disposed) return;
      setItems(current => {
        const next = [...current];
        const positions = new Map(current.map((item, index) => [item.id, index]));
        for (const item of updates) {
          const index = positions.get(item.id);
          if (index === undefined) { positions.set(item.id, next.length); next.push(item); }
          else next[index] = item;
        }
        return next;
      });
    }, callback => window.setTimeout(callback, 16), handle => window.clearTimeout(handle));
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws/chat/${sessionId}`);
      socket.onopen = () => setOffline(false);
      socket.onmessage = (event) => {
        if (disposed) return;
        let message: Message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'snapshot') { itemBatch.reset(); setItems(message.chat.items); setRunning(message.chat.running); wasRunning.current = message.chat.running; publishChatRunning(sessionId, message.chat.running); setActivity(message.chat.activity); setQueued(message.chat.queued || []); }
        else if (message.type === 'state') {
          itemBatch.flush();
          if (wasRunning.current && !message.running) { notifyDone(sessionNotice(sessionId, nameRef.current)); setTurnsDone(n => n + 1); }
          if (message.running) publishNextPrompt(sessionId, '');
          publishChatRunning(sessionId, message.running);
          wasRunning.current = message.running;
          setRunning(message.running);
        }
        else if (message.type === 'activity') setActivity(message.activity);
        else if (message.type === 'queue') setQueued(message.queued);
        else if (message.type === 'item') {
          const item = message.item;
          // A question waits for the user: tell them even when the app is in the background.
          if (item.kind === 'permission' && item.status === 'pending')
            notifyDone({ tag: `permission:${item.requestId}`, title: tr`${nameRef.current} ขออนุญาต${item.title}`, body: item.detail || tr("กดเพื่อตอบในห้องแชท"), failed: false, target: { kind: 'session', id: sessionId } }, { inactiveSession: !activeRef.current });
          if (item.kind === 'question' && item.status === 'waiting')
            notifyDone({ tag: `question:${item.id}`, title: tr`${nameRef.current} ถามก่อนทำต่อ`, body: item.questions[0]?.question || tr("กดเพื่อตอบในห้องแชท"), failed: false, target: { kind: 'session', id: sessionId } });
          itemBatch.push(item);
          if (item.kind === 'permission' || item.kind === 'question' || item.kind === 'error') itemBatch.flush();
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        itemBatch.flush();
        setOffline(true);
        retry = window.setTimeout(connect, 1500);
      };
    };
    connect();
    return () => { disposed = true; itemBatch.reset(); window.clearTimeout(retry); socket?.close(); };
  }, [sessionId]);

  // Every second while working (live counter), every half minute otherwise (message times).
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), running ? 1000 : 30000);
    return () => window.clearInterval(timer);
  }, [running, active]);

  // Follow new output unless the user scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !items.length) return;
    const changed = !!lastOutput.current && lastOutput.current !== items;
    lastOutput.current = items;
    if (jumpToSaved()) { restored.current = true; return; }
    if (!restored.current) {
      restored.current = true;
      try {
        const saved = localStorage.getItem(`superai-scroll:${sessionId}`);
        if (saved !== null) { el.scrollTop = Number(saved) || 0; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; return; }
      } catch {}
    }
    if (stick.current && !search.trim()) el.scrollTop = el.scrollHeight;
    else if (changed && !search.trim()) setNewOutput(true);
    setAwayFromLatest(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
  }, [items, running, activity?.quiet]);

  const started = activity?.startedAt ?? [...items].reverse().find((i) => i.kind === 'user')?.at ?? now;
  const seconds = Math.max(0, Math.round((now - started) / 1000));
  // The task list of the turn in progress stays pinned above the live counter, like Claude's.
  const liveTodos = running && lastUser ? [...turnItems].reverse().find((item): item is TodosItem => item.kind === 'todos') : undefined;
  const pendingPermissions = items.filter((item): item is PermissionItem => item.kind === 'permission' && item.status === 'pending');
  const workingTool = [...turnItems].reverse().find((item): item is ToolItem => item.kind === 'tool' && item.status === 'running');
  const workingLabel = pendingPermissions.length ? tr("รอคำอนุญาต")
    : activity?.quiet ? tr("รอข้อมูลเพิ่มเติม")
      : workingTool ? tr`กำลังทำงาน: ${stepLabel(workingTool.title)}` : tr`กำลังทำงานกับ ${name}`;
  const popupPermission = active && pendingPermissions.find(item => !dismissedPermissions.includes(item.id));
  const queueAction = (id: string, action: 'send' | 'remove') => {
    post(`/api/terminals/${sessionId}/chat/queue/${id}/${action}`).catch((error) => setProblem((error as Error).message));
  };

  return (
    <ImageEndpointContext.Provider value={`/api/terminals/${encodeURIComponent(sessionId)}/preview-file`}><ConversationInteractions sessionId={sessionId} active={active} messages={items} revision={items} onSearch={setSearch}><div className="chat-view">
      <div className="conversation-export-position"><ConversationExport title={name} sessionId={sessionId} /></div>
      <button type="button" className="conversation-rename-trigger" aria-label={tr("เปลี่ยนชื่อห้อง")} title={tr("เปลี่ยนชื่อห้อง")} onClick={() => window.dispatchEvent(new CustomEvent('superai:rename-session', { detail: sessionId }))}><Pencil size={13} /></button>
      {pendingPermissions.length > 0 && <div className="chat-permission-banner" role="status"><span>{tr("รอการอนุญาต")} {pendingPermissions.length} {tr("รายการ · งานจะดำเนินต่อหลังตอบ")}</span><button type="button" className="secondary" onClick={() => scroller.current?.querySelector('.chat-permission.pending')?.scrollIntoView({ block: 'center', behavior: 'smooth' })}>{tr("ดูคำขอ")}</button></div>}
      {popupPermission && <div className="chat-permission-overlay" role="presentation">
        <div className="chat-permission-popup" role="dialog" aria-modal="true" aria-label={tr`${name} ขออนุญาต`}>
          <button type="button" autoFocus className="chat-permission-dismiss" onClick={() => setDismissedPermissions(previous => [...previous, popupPermission.id])} aria-label={tr("ปิดหน้าต่างคำขอ")}>×</button>
          <PermissionCard item={popupPermission} sessionId={sessionId} name={name} inPopup />
          <p>{tr("ปิดหน้าต่างนี้เพื่อกลับไปตอบจากแถบคำขอในแชทได้")}</p>
        </div>
      </div>}
      <div className="chat-scroll" ref={scroller} onScroll={(e) => {
        const el = e.currentTarget;
        try { if (!search.trim()) localStorage.setItem(`superai-scroll:${sessionId}`, String(el.scrollTop)); } catch {}
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        const away = el.scrollHeight - el.scrollTop - el.clientHeight > 80;
        setAwayFromLatest(away); if (!away) setNewOutput(false);
      }}>
        <div className="chat-column">
          {!items.length && (
            <div className="chat-empty">
              <strong>{tr("คุยกับ")} {name}</strong>
              <span>{tr("พิมพ์ในช่องคำสั่งด้านล่างแล้วกดส่ง")} {name} {tr("ทำงานในโฟลเดอร์โปรเจกต์นี้ แก้ไฟล์และรันคำสั่งได้เอง")}</span>
              <small>{tr("เลือก Model, Effort, /skills และเข้าสู่ระบบได้ที่ช่องคำสั่งด้านล่าง เมื่อเลือก session นี้อยู่")}</small>
            </div>
          )}
          {groupedBlocks.map((block) => {
            if (block.kind === 'user')
              return (
                <UserMessageItem
                  key={block.id}
                  block={block}
                  sessionId={sessionId}
                  running={running}
                  pending={pending}
                  now={now}
                  onProblem={setProblem}
                />
              );
            if (block.kind === 'assistant') {
              const latest = block.id === lastReply?.id && !!lastUser && replyIndex > items.indexOf(lastUser);
              const currentTurn = !!lastUser && items.indexOf(block) > items.indexOf(lastUser);
              return <div key={block.id} data-message-id={block.id}>
                <div className="chat-assistant" data-message-body={block.id}><Markdown text={hideQuestionBlock(block.text)} /></div>
                {!(running && currentTurn) && <ResponseActions text={block.text} at={block.at} now={now} disabled={pending || offline || running}
                  agentName={name}
                  currentSessionId={sessionId}
                  onRetry={latest && !turnFailed && !search.trim() && (lastUser?.request || !lastUser?.attachments?.length) ? () => void retry() : undefined}
                  onEdit={latest ? () => { prepareMessage(lastUser!.text, sessionId, { expand: false }); if (lastUser!.attachments?.length) setProblem(tr("กรุณาแนบไฟล์เดิมอีกครั้งก่อนส่งข้อความที่แก้ไข")); } : undefined}
                  onChanges={latest && turnEdited ? () => showChanges(sessionId) : undefined} />}
                {block.id === lastReply?.id && <NextSteps items={nextSteps} sessionId={sessionId} />}
              </div>;
            }
            if (block.kind === 'tools') return <ToolGroup key={block.id} tools={block.tools} />;
            if (block.kind === 'permission') return <PermissionCard key={block.id} item={block} sessionId={sessionId} name={name} />;
            if (block.kind === 'question') return <QuestionCard key={block.id} item={block} sessionId={sessionId} onError={setProblem} />;
            if (block.kind === 'todos') return block === liveTodos || !block.todos.length ? null : <TaskList key={block.id} item={block} live={false} items={items} />;
            if (block.kind === 'error') {
              const oldTimeout = lastUser && items.indexOf(block) < items.indexOf(lastUser) && /ไม่มีข้อมูลใหม่.*จึงหยุดรอบนี้/.test(block.text);
              return <div key={block.id} role={oldTimeout ? undefined : 'alert'} className={oldTimeout ? 'chat-notice' : 'chat-error'}><AlertTriangle size={14} /><span>{oldTimeout ? tr`รอบก่อนถูกหยุด: ${block.text}` : block.text}</span></div>;
            }
            return <div key={block.id} className="chat-notice">{block.text}</div>;
          })}
          {liveTodos && liveTodos.todos.length > 0 && <TaskList key={liveTodos.id} item={liveTodos} live items={items} />}
          {running && activity?.quiet && !pendingPermissions.length && <div className="chat-idle-warning" role="status" aria-label={tr("รอข้อมูลจากงานปัจจุบัน")}>
            <div><Clock3 size={16} /><strong>{tr("ยังไม่ได้รับข้อมูลใหม่ครบ")} {Math.max(1, Math.ceil(activity.quiet.timeoutMs / 60000))} {tr("นาที")}</strong></div>
            <p>{tr("โปรแกรมยังไม่หยุดงาน อาจกำลังรอเครื่องมือหรือ Subagent และยังยืนยันไม่ได้ว่างานค้าง")}</p>
            <div className="chat-idle-actions">
              <button className="secondary" disabled={pending || offline} onClick={() => void quietAction('wait')}>{tr("รอต่อ")}</button>
              <button className="secondary" onClick={() => showChanges(sessionId)}>{tr("ดูไฟล์ที่เปลี่ยน")}</button>
              <button className="secondary" disabled={pending || offline} onClick={() => void quietAction('cancel')}>{tr("หยุดงาน")}</button>
            </div>
          </div>}
          {running && (
            <div className="chat-working" role="status" title={tr`${name} ${activity?.quiet ? tr("รอข้อมูลเพิ่มเติม") : tr("กำลังทำงาน")} · กดหยุดได้ที่ช่องคำสั่งด้านล่าง`}>
              {activity?.quiet ? <Clock3 size={14} aria-hidden="true" /> : <span className="chat-pulse" aria-hidden="true"><i /><i /><i /></span>}
              {/* Activity describes observed state; token counts appear only when supplied. */}
              <span>{workingLabel} · {activity?.outputTokens ? `${tokenLabel(activity.outputTokens)} tokens · ` : ''}{seconds >= 60 ? tr`${Math.floor(seconds / 60)} นาที ${seconds % 60} วิ` : tr`${seconds} วิ`}</span>
            </div>
          )}
          {queued.length > 0 && (
            <div className="chat-queue" aria-label={tr("ข้อความที่รอคิว")}>
              {queued.map((q) => (
                <div key={q.id} className="chat-queued">
                  <Clock3 size={13} />
                  <span>{q.text}{q.attachments?.length ? <small><Paperclip size={11} /> {q.attachments.join(', ')}</small> : null}</span>
                  <small>{running ? tr("รอคิว") : tr("หยุดไว้")}</small>
                  {!running && <button type="button" title={tr("ส่งข้อความนี้เลย")} onClick={() => queueAction(q.id, 'send')}><Send size={13} /></button>}
                  <button type="button" title={tr("เอาออกจากคิว")} onClick={() => queueAction(q.id, 'remove')}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
          {!running && lastUser && turnFailed && <div className="recovery-actions"><button disabled={pending || offline || (!lastUser.request && !!lastUser.attachments?.length)} onClick={() => void retry()}>{tr("ลองส่งอีกครั้ง")}</button></div>}
          {problem && <div role="alert" className="chat-error">{recoveryHint(problem)}<br />{problem}</div>}
          {items.at(-1)?.kind === 'error' && <p className="recovery-note">{recoveryHint((items.at(-1) as { text: string }).text)} <button onClick={() => window.dispatchEvent(new Event('superai:open-setup'))}>{tr("ตรวจบัญชีและเครื่องมือ")}</button></p>}
          {offline && <div className="chat-notice">{tr("ขาดการเชื่อมต่อ กำลังเชื่อมต่อใหม่…")}</div>}
        </div>
      </div>
      {awayFromLatest && !search.trim() && <button type="button" className="conversation-latest" aria-label={tr("กลับข้อความล่าสุด")} onClick={() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; stick.current = true; setAwayFromLatest(false); setNewOutput(false); }}><ArrowDown size={14} />{newOutput ? tr("มีข้อความใหม่ · กลับล่าสุด") : tr("กลับข้อความล่าสุด")}</button>}
    </div></ConversationInteractions></ImageEndpointContext.Provider>
  );
}
