import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Copy, FilePen, FileText, Globe, ListChecks, Loader2, Paperclip, Search, Terminal as TerminalIcon, Wrench } from 'lucide-react';
import { Markdown } from './Markdown';

// Mirrors server/CliChat.ts.
type ToolKind = 'command' | 'read' | 'edit' | 'search' | 'web' | 'plan' | 'other';
type ToolItem = { id: string; kind: 'tool'; tool: ToolKind; title: string; output?: string; status: 'running' | 'done' | 'failed'; at: number };
type ChatItem =
  | { id: string; kind: 'user'; text: string; attachments?: string[]; at: number }
  | { id: string; kind: 'assistant'; text: string; at: number }
  | ToolItem
  | { id: string; kind: 'error' | 'notice'; text: string; at: number };
type Message = { type: 'snapshot'; chat: { items: ChatItem[]; running: boolean } } | { type: 'item'; item: ChatItem } | { type: 'state'; running: boolean };
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

function ToolRow({ tool }: { tool: ToolItem }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[tool.tool] || Wrench;
  return (
    <li className={`chat-tool ${tool.status}`}>
      <button className="chat-tool-row" onClick={() => setOpen(!open)} disabled={!tool.output} aria-expanded={open}>
        {tool.status === 'running' ? <Loader2 size={13} className="spin" /> : <Icon size={13} />}
        <code>{tool.title}</code>
        {tool.status === 'failed' && <span className="chat-tool-failed">ไม่สำเร็จ</span>}
      </button>
      {open && tool.output && <pre>{tool.output.trimEnd()}</pre>}
    </li>
  );
}

function ToolGroup({ tools }: { tools: ToolItem[] }) {
  const running = tools.find((t) => t.status === 'running');
  const [open, setOpen] = useState(false);
  return (
    <div className="chat-tools">
      <button className="chat-tools-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`chat-dot ${running ? 'running' : tools.some((t) => t.status === 'failed') ? 'failed' : ''}`} />
        <span>{running ? `กำลังทำงาน: ${running.title.split('\n')[0]}` : summary(tools)}</span>
        <ChevronRight size={13} className={`chat-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && <ul>{tools.map((t) => <ToolRow key={t.id} tool={t} />)}</ul>}
    </div>
  );
}

function AssistantMessage({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="chat-assistant">
      <Markdown text={text} />
      <button className="chat-copy" title="คัดลอกคำตอบ" onClick={() => {
        navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
      }}>{copied ? <Check size={12} /> : <Copy size={12} />}</button>
    </div>
  );
}

/**
 * Claude-style view of a Code session: messages and folded tool calls from the CLI's JSON stream.
 * Typing, files, Model/Effort, /skills and sign-in live in the bottom composer.
 */
export function ChatView({ sessionId, name }: { sessionId: string; name: string }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [running, setRunning] = useState(false);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now());
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

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
        if (message.type === 'snapshot') { setItems(message.chat.items); setRunning(message.chat.running); }
        else if (message.type === 'state') setRunning(message.running);
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

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  // Follow new output unless the user scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [items, running]);

  const started = [...items].reverse().find((i) => i.kind === 'user')?.at ?? now;
  const seconds = Math.max(0, Math.round((now - started) / 1000));

  return (
    <div className="chat-view">
      <div className="chat-scroll" ref={scroller} onScroll={(e) => {
        const el = e.currentTarget;
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
          {blocks(items).map((block) => {
            if (block.kind === 'user')
              return (
                <div key={block.id} className="chat-user">
                  <div>
                    {block.text}
                    {block.attachments?.length ? <small><Paperclip size={11} /> {block.attachments.join(', ')}</small> : null}
                  </div>
                </div>
              );
            if (block.kind === 'assistant') return <AssistantMessage key={block.id} text={block.text} />;
            if (block.kind === 'tools') return <ToolGroup key={block.id} tools={block.tools} />;
            if (block.kind === 'error') return <div key={block.id} role="alert" className="chat-error"><AlertTriangle size={14} /><span>{block.text}</span></div>;
            return <div key={block.id} className="chat-notice">{block.text}</div>;
          })}
          {running && (
            <div className="chat-working" role="status">
              <Loader2 size={14} className="spin" />
              <span>{name} กำลังทำงาน · {seconds} วิ · กดหยุดได้ที่ช่องคำสั่งด้านล่าง</span>
            </div>
          )}
          {offline && <div className="chat-notice">ขาดการเชื่อมต่อ กำลังเชื่อมต่อใหม่…</div>}
        </div>
      </div>
    </div>
  );
}
