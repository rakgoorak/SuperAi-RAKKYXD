import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowUp, Check, ChevronRight, Copy, FilePen, FileText, Globe, ListChecks, Loader2, Paperclip, Search, Square, Terminal as TerminalIcon, Wrench, X } from 'lucide-react';
import { Markdown } from './Markdown';
import { api, post, loginProvider, type ChatSkill } from '../api';
import { useModels, EFFORT_LABEL } from '../providers';
import { ModelCombo } from './ModelCombo';
import { useProviderAccess } from './ProviderAccess';
import { ACCEPT_ATTACHMENTS, isSupportedAttachment, pastedFiles, uploadAttachment, UNSUPPORTED_ATTACHMENT, type SavedAttachment } from '../attachments';

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

/** Claude-style view of a Code session: messages and folded tool calls from the CLI's JSON stream. */
export function ChatView({ sessionId, name, focused }: { sessionId: string; name: string; focused: boolean }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [running, setRunning] = useState(false);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<SavedAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [agent, setAgent] = useState('');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const [skills, setSkills] = useState<ChatSkill[]>([]);
  const [skillId, setSkillId] = useState('');
  const [showSkills, setShowSkills] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const { list, error: modelError } = useModels(agent);
  const { auth, checking, error: authError, check } = useProviderAccess(agent);
  const efforts = (model && list?.modelEfforts?.[model]) || list?.efforts || [];
  const blocked = auth?.status === 'login-required' && agent !== 'opencode' || auth?.status === 'not-installed';
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    let disposed = false;
    api<{ agent: string; model: string; effort: string; skills: ChatSkill[] }>(`/api/terminals/${sessionId}/chat/settings`)
      .then((settings) => {
        if (disposed) return;
        setAgent(settings.agent); setModel(settings.model); setEffort(settings.effort); setSkills(settings.skills); setSettingsReady(true);
      }).catch((e) => !disposed && setProblem((e as Error).message));
    return () => { disposed = true; };
  }, [sessionId]);

  const browseSkills = async () => {
    setShowSkills(true);
    try {
      const settings = await api<{ skills: ChatSkill[] }>(`/api/terminals/${sessionId}/chat/settings`);
      setSkills(settings.skills);
    } catch (e) { setProblem((e as Error).message); }
  };
  const login = async () => {
    setBusy(true); setProblem('');
    try { await loginProvider(agent, { sessionId }); }
    catch (e) { setProblem((e as Error).message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (focused) input.current?.focus();
  }, [focused]);

  // Grow with the text up to a third of the pane, like Claude's composer.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [draft]);

  const attach = async (list: File[]) => {
    if (!list.length) return;
    const supported = list.filter(isSupportedAttachment);
    if (supported.length < list.length) setProblem(UNSUPPORTED_ATTACHMENT);
    setBusy(true);
    try {
      for (const file of supported) {
        const saved = await uploadAttachment(`/api/terminals/${sessionId}/attachments`, file);
        setFiles((current) => [...current, saved]);
      }
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = draft.trim() || (files.length ? 'ดูไฟล์แนบนี้' : '');
    if (!text || busy || running || !settingsReady) return;
    if (/^\/skills?\s*$/.test(text)) { await browseSkills(); return; }
    if (text === '/login') { await login(); return; }
    if (text === '/model') { setProblem('เลือก Model จากช่องด้านล่าง ใช้กับข้อความถัดไป'); return; }
    if (blocked) { setProblem(auth?.note || 'กรุณาเข้าสู่ระบบก่อนส่งข้อความ'); return; }
    setBusy(true);
    setProblem('');
    try {
      await post(`/api/terminals/${sessionId}/chat`, { text, model, effort, ...(skillId ? { skillId } : {}), attachments: files.map((f) => f.path) });
      setDraft('');
      setFiles([]);
      setSkillId(''); setShowSkills(false);
      stick.current = true;
    } catch (error) {
      setProblem((error as Error).message);
      void check(true);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
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
  const previousRunning = useRef(false);
  useEffect(() => {
    if (previousRunning.current && !running) void check(true);
    previousRunning.current = running;
  }, [running, check]);

  // Follow new output unless the user scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [items, running]);

  const started = [...items].reverse().find((i) => i.kind === 'user')?.at ?? now;
  const seconds = Math.max(0, Math.round((now - started) / 1000));
  const stop = () => { post(`/api/terminals/${sessionId}/chat/cancel`).catch(() => {}); };

  return (
    <div className="chat-view"
      onDragOver={(e) => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); e.stopPropagation(); } }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        e.stopPropagation(); // the pane would otherwise type the paths into the hidden terminal
        void attach(Array.from(e.dataTransfer.files));
      }}>
     <div className="chat-scroll" ref={scroller} onScroll={(e) => {
      const el = e.currentTarget;
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
     }}>
      <div className="chat-column">
        {!items.length && (
          <div className="chat-empty">
            <strong>คุยกับ {name}</strong>
            <span>พิมพ์ข้อความในช่องด้านล่างแล้วกดส่ง {name} ทำงานในโฟลเดอร์โปรเจกต์นี้ แก้ไฟล์และรันคำสั่งได้เอง</span>
            <small>เลือก Model ด้านล่าง · พิมพ์ /skills เพื่อดู skill · เข้าสู่ระบบได้จากปุ่มด้านล่าง</small>
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
            <span>{name} กำลังทำงาน · {seconds} วิ</span>
          </div>
        )}
        {offline && <div className="chat-notice">ขาดการเชื่อมต่อ กำลังเชื่อมต่อใหม่…</div>}
      </div>
     </div>
      <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <div className={`chat-account ${auth?.status || ''}`}>
          <small>{authError || auth?.note || (agent ? 'กำลังตรวจบัญชี…' : 'กำลังโหลดการตั้งค่า…')}</small>
          <button type="button" className="text-button" disabled={checking || busy || !agent} onClick={() => void check(true)}>ตรวจบัญชีอีกครั้ง</button>
          {auth?.status !== 'authenticated' && auth?.status !== 'not-installed' && <button type="button" className="text-button" disabled={!agent || busy || running} onClick={() => void login()}>เข้าสู่ระบบใน Terminal</button>}
        </div>
        {problem && <div className="chat-composer-problem" role="alert">{problem}<button type="button" onClick={() => setProblem('')} aria-label="ปิดข้อความ"><X size={12} /></button></div>}
        {showSkills && <div className="chat-skill-menu" aria-label="Skills ที่เรียกใช้ได้">
          <div><strong>Skills ของ {name}</strong><button type="button" className="text-button" onClick={() => setShowSkills(false)}>ปิด</button></div>
          {!skills.length && <p>ยังไม่พบ skill ในโปรเจกต์หรือโฟลเดอร์ของผู้ให้บริการ ติดตั้งได้จากหน้า Skills · คำสั่งที่มีเฉพาะใน CLI ให้ใช้หน้า Terminal</p>}
          {skills.map((skill) => <button type="button" key={skill.id} title={skill.path} onClick={() => {
            setSkillId(skill.id); setDraft(`/skill ${skill.name} `); setShowSkills(false); input.current?.focus();
          }}><strong>/{skill.name}</strong><small>{skill.source} · {skill.description || 'ใช้ skill นี้'}</small></button>)}
        </div>}
        <div className="chat-model-controls">
          <label>Model<ModelCombo label={`Model ในแชท ${name}`} value={model} options={list?.models || []} placeholder="ค่าเริ่มต้นของ CLI" disabled={running || busy || !settingsReady}
            onChange={(value) => { setModel(value); setEffort(''); }} /></label>
          <label>Effort<select aria-label={`Effort ในแชท ${name}`} value={effort} disabled={running || busy || !efforts.length} onChange={(e) => setEffort(e.target.value)}>
            <option value="">ค่าเริ่มต้น</option>{efforts.map((e) => <option key={e} value={e}>{EFFORT_LABEL[e] || e}</option>)}
          </select></label>
          <button type="button" className="text-button" disabled={running || busy} onClick={() => void browseSkills()}>/skills</button>
          {skillId && <button type="button" className="text-button" onClick={() => setSkillId('')}>ยกเลิก skill</button>}
        </div>
        {modelError && <small className="muted">{modelError} · พิมพ์ชื่อ Model เองได้</small>}
        {files.length > 0 && (
          <div className="chat-composer-files">
            {files.map((file) => (
              <span key={file.path}>
                <Paperclip size={11} />{file.name}
                <button type="button" onClick={() => setFiles((current) => current.filter((f) => f.path !== file.path))} aria-label={`เอา ${file.name} ออก`}><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={input}
          rows={1}
          value={draft}
          placeholder={running ? `${name} กำลังทำงาน… พิมพ์ข้อความถัดไปไว้ได้ ส่งได้เมื่อเสร็จ` : `ส่งข้อความถึง ${name}`}
          aria-label={`ข้อความถึง ${name}`}
          onChange={(e) => {
            const value = e.target.value; setDraft(value);
            const selected = skills.find((s) => s.id === skillId);
            if (!selected || !value.startsWith(`/skill ${selected.name} `)) setSkillId('');
            if (/^\/skills?\s*$/.test(value)) void browseSkills();
          }}
          onPaste={(e) => {
            const pasted = pastedFiles(e.clipboardData);
            if (!pasted.length) return;
            e.preventDefault();
            void attach(pasted);
          }}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a new line; never while a Thai IME is composing.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="chat-composer-actions">
          <button type="button" className="chat-attach" title="แนบรูปหรือ PDF" onClick={() => picker.current?.click()} disabled={busy}><Paperclip size={15} /></button>
          <input ref={picker} type="file" multiple accept={ACCEPT_ATTACHMENTS} hidden onChange={(e) => { void attach(Array.from(e.target.files || [])); e.target.value = ''; }} />
          <small>Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่</small>
          {running ? (
            <button type="button" className="chat-send stop" title="หยุดงานนี้" onClick={stop}><Square size={13} /></button>
          ) : (
            <button type="submit" className="chat-send" title="ส่ง" disabled={busy || !settingsReady || blocked || (!draft.trim() && !files.length)}>
              {busy ? <Loader2 size={15} className="spin" /> : <ArrowUp size={16} />}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
