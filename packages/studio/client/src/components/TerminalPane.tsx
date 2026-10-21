import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { X, Terminal as TerminalIcon, Bot, Sparkles, Cpu, Circle, ImagePlus, AlertTriangle, BookOpen } from 'lucide-react';
import { attachMode, formatPath, isPdf, isSupportedAttachment, isSupportedImage, pastedFiles, uploadAttachment, UNSUPPORTED_ATTACHMENT, type SavedAttachment } from '../attachments';
import { bufferText, loadTerminalThaiFont } from '../terminalText';

export interface TerminalTab {
  id: string;
  name: string;
  type: string;
  sessionId?: string;
  /** Command typed into the shell once it is ready (e.g. `claude`, `codex`). */
  autoCommand?: string;
  status: 'connecting' | 'running' | 'exited' | 'error';
}

interface TerminalPaneProps {
  tab: TerminalTab;
  visible: boolean;
  focused: boolean;
  showHeader: boolean;
  onFocus: () => void;
  onClose: () => void;
  onExit: () => void;
  /** Lets the parent send text to this terminal (prompt bar). */
  registerSender: (id: string, sender: ((data: string) => void) | null) => void;
}

const THEME = {
  background: '#0a0d14',
  foreground: '#e2e8f0',
  cursor: '#00d2ff',
  cursorAccent: '#0a0d14',
  selectionBackground: '#1e3a5f',
  black: '#1e293b',
  red: '#f87171',
  green: '#34d399',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e2e8f0',
  brightBlack: '#64748b',
  brightRed: '#fca5a5',
  brightGreen: '#6ee7b7',
  brightYellow: '#fde68a',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f8fafc',
};

interface AttachNotice {
  kind: 'busy' | 'ok' | 'error';
  text: string;
  detail?: string;
  thumb?: string;
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

// Started once: every terminal waits for the Thai face before xterm measures widths.
const thaiFontReady = Promise.race([loadTerminalThaiFont(), sleep(1500)]);

export function tabIcon(type: string, className = 'w-3.5 h-3.5') {
  switch (type) {
    case 'claude-code':
      return <Bot className={`${className} text-cyan-400`} />;
    case 'codex':
      return <Sparkles className={`${className} text-purple-400`} />;
    case 'antigravity':
      return <Cpu className={`${className} text-indigo-400`} />;
    case 'opencode-multi':
      return <Bot className={`${className} text-emerald-400`} />;
    default:
      return <TerminalIcon className={`${className} text-slate-400`} />;
  }
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({
  tab,
  visible,
  focused,
  showHeader,
  onFocus,
  onClose,
  onExit,
  registerSender,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const attachRef = useRef<((files: File[], source: 'paste' | 'drop') => Promise<void>) | null>(null);
  const [notice, setNotice] = useState<AttachNotice | null>(null);
  const [dragging, setDragging] = useState(false);
  const noticeTimer = useRef<number>();
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  // Reading mode: the buffer as plain text so Thai reads like normal text. The CLI keeps running.
  const [reading, setReading] = useState(false);
  const [readerText, setReaderText] = useState('');
  const readerRef = useRef<HTMLDivElement>(null);

  const showNotice = (next: AttachNotice | null) => {
    window.clearTimeout(noticeTimer.current);
    setNotice((previous) => {
      if (previous?.thumb && previous.thumb !== next?.thumb) URL.revokeObjectURL(previous.thumb);
      return next;
    });
    if (next && next.kind !== 'busy') noticeTimer.current = window.setTimeout(() => showNotice(null), next.kind === 'error' ? 12000 : 6000);
  };
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // Create xterm + websocket once per session.
  useEffect(() => {
    if (!containerRef.current || !tab.sessionId) return;

    const term = new Terminal({
      theme: THEME,
      fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, "Noto Sans Thai", monospace',
      fontSize: 15,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;
    // Output arriving before this is buffered by xterm and drawn on open.
    let disposed = false;
    void thaiFontReady.then(() => {
      if (disposed || !containerRef.current) return;
      term.open(containerRef.current);
      safeFit();
      if (focusedRef.current) term.focus();
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal/${tab.sessionId}`);
    wsRef.current = ws;

    const send = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
    };
    const sendResize = () => {
      if (ws.readyState === WebSocket.OPEN && term.cols > 1 && term.rows > 1) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    let autoTimer: number | undefined;
    ws.onopen = () => {
      safeFit();
      sendResize();
      if (tab.autoCommand) {
        autoTimer = window.setTimeout(() => send(tab.autoCommand + '\r'), 1200);
      }
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') term.write(msg.data);
        else if (msg.type === 'exit') { term.write('\r\n[จบการทำงาน]\r\n'); onExitRef.current(); }
        else if (msg.type === 'error') term.write(`\r\n\x1b[31m${msg.message}\x1b[0m\r\n`);
      } catch {
        term.write(String(event.data));
      }
    };
    ws.onclose = () => {
      term.write('\r\n\x1b[90m[การเชื่อมต่อขาดหาย]\x1b[0m\r\n');
      onExitRef.current();
    };

    // Image/PDF paste and drop: hand the file to the CLI the way that CLI accepts
    // it (see attachments.ts). Nothing is submitted; the user keeps typing.
    const upload = (file: File) => uploadAttachment(`/api/terminals/${tab.sessionId}/attachments`, file);
    const attach = async (files: File[], source: 'paste' | 'drop') => {
      const mode = attachMode(tab.type);
      const native = window.superai;
      const images = files.filter(isSupportedImage);
      const firstImage = images[0];
      showNotice({ kind: 'busy', text: 'กำลังแนบไฟล์…' });
      try {
        let saved: SavedAttachment | undefined;
        let staged = 0;
        for (const file of files) {
          const existing = native?.pathForFile(file) || '';
          if (!isSupportedAttachment(file) && (file.type.startsWith('image/') || !existing)) {
            throw new Error(file.type.startsWith('image/') ? UNSUPPORTED_ATTACHMENT : `ไฟล์ "${file.name}" ไม่มีตำแหน่งบนเครื่อง ให้บันทึกลงเครื่องก่อนแล้วลากมาวางใหม่`);
          }
          if (mode === 'clipboard' && isSupportedImage(file)) {
            if (source === 'paste') {
              send('\x16'); // Codex reads the image straight from the clipboard.
              continue;
            }
            if (native) {
              const filePath = existing || (saved = await upload(file)).path;
              if (staged++) await sleep(700);
              await native.stageClipboardImage(filePath);
              send('\x16');
              continue;
            }
          }
          if (mode === 'clipboard' && isPdf(file)) {
            // A project-relative path has no ":" or "\" for ConPTY to drop.
            saved = await upload(file);
            term.paste(formatPath(saved.relativePath));
            continue;
          }
          if (existing) {
            term.paste(formatPath(existing));
            continue;
          }
          saved = await upload(file);
          term.paste(formatPath(saved.path));
        }
        const count = files.length > 1 ? ` ${files.length} ไฟล์` : '';
        showNotice({
          kind: 'ok',
          text: firstImage ? `แนบรูปแล้ว${count}` : files.some(isPdf) ? `แนบ PDF แล้ว${count}` : 'ใส่ตำแหน่งไฟล์แล้ว',
          detail: saved
            ? `บันทึกที่ ${saved.relativePath} · พิมพ์ข้อความต่อแล้วกด Enter เพื่อส่ง`
            : mode === 'clipboard' && firstImage
              ? 'ส่งให้ Codex ผ่านคลิปบอร์ดแล้ว · พิมพ์ข้อความต่อแล้วกด Enter เพื่อส่ง'
              : 'พิมพ์ข้อความต่อแล้วกด Enter เพื่อส่ง',
          thumb: firstImage ? URL.createObjectURL(firstImage) : undefined,
        });
      } catch (error: any) {
        showNotice({ kind: 'error', text: 'แนบไฟล์ไม่สำเร็จ', detail: error?.message || 'กรุณาลองใหม่อีกครั้ง' });
      } finally {
        term.focus();
      }
    };
    attachRef.current = attach;
    // Capture phase: runs before xterm's own paste handler; text paste falls through untouched.
    const onPaste = (event: ClipboardEvent) => {
      const files = pastedFiles(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      void attach(files, 'paste');
    };
    const host = containerRef.current;
    host.addEventListener('paste', onPaste, true);

    const dataSub = term.onData(send);
    const resizeSub = term.onResize(sendResize);
    registerSender(tab.id, send);

    function safeFit() {
      const el = containerRef.current;
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        try {
          fit.fit();
        } catch {}
      }
    }
    const observer = new ResizeObserver(() => safeFit());
    observer.observe(containerRef.current);

    return () => {
      disposed = true;
      window.clearTimeout(autoTimer);
      observer.disconnect();
      host.removeEventListener('paste', onPaste, true);
      attachRef.current = null;
      dataSub.dispose();
      resizeSub.dispose();
      registerSender(tab.id, null);
      ws.onclose = null;
      ws.close();
      term.dispose();
      termRef.current = null;
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.sessionId]);

  // Refit & focus when shown / focused.
  useEffect(() => {
    if (!visible) return;
    const id = window.requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el && el.offsetWidth > 0) {
        try {
          fitRef.current?.fit();
        } catch {}
      }
      if (focused) termRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [visible, focused]);

  // Keep the reading view in step with the terminal while it is shown (at most ~5 updates a second).
  useEffect(() => {
    const term = termRef.current;
    if (!reading || !visible || !term) return;
    let timer: number | undefined;
    const update = () => {
      timer = undefined;
      const el = readerRef.current;
      const atBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setReaderText(bufferText(term.buffer.active));
      if (atBottom) requestAnimationFrame(() => { if (readerRef.current) readerRef.current.scrollTop = readerRef.current.scrollHeight; });
    };
    const schedule = () => { if (timer === undefined) timer = window.setTimeout(update, 200); };
    update();
    readerRef.current?.focus();
    const parsed = term.onWriteParsed(schedule);
    const switched = term.buffer.onBufferChange(schedule);
    return () => {
      window.clearTimeout(timer);
      parsed.dispose();
      switched.dispose();
    };
  }, [reading, visible, tab.sessionId]);

  const closeReader = () => {
    setReading(false);
    requestAnimationFrame(() => termRef.current?.focus());
  };

  const hasFiles = (event: React.DragEvent) => !!tab.sessionId && Array.from(event.dataTransfer.types).includes('Files');

  return (
    <div
      onMouseDown={onFocus}
      data-terminal-pane={tab.sessionId ? '' : undefined}
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        if (!dragging) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation(); // the window-level drop (composer) must not take it too
        setDragging(false);
        onFocus();
        const files = Array.from(event.dataTransfer.files);
        if (files.length) void attachRef.current?.(files, 'drop');
      }}
      className={`${visible ? 'flex' : 'hidden'} flex-col min-h-0 min-w-0 h-full bg-[#0a0d14] ${
        showHeader ? `rounded-lg border ${focused ? 'border-cyan-500/70 shadow-[0_0_0_1px_rgba(0,210,255,0.15)]' : 'border-[#1f293d]'}` : ''
      } overflow-hidden`}
    >
      {showHeader && (
        <div className="h-7 px-2 flex items-center justify-between bg-[#0e131f] border-b border-[#1f293d] text-[11px] select-none shrink-0">
          <div className="flex items-center space-x-1.5 truncate">
            {tabIcon(tab.type, 'w-3 h-3')}
            <span className={`truncate ${focused ? 'text-cyan-300' : 'text-slate-400'}`}>{tab.name}</span>
            {tab.status === 'running' && <Circle className="w-1.5 h-1.5 fill-emerald-400 text-emerald-400" />}
            {tab.status === 'exited' && <span className="text-slate-500">(exited)</span>}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-0.5 text-slate-500 hover:text-rose-400 rounded"
            title="Close terminal"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="relative flex-1 min-h-0 p-1.5">
        {dragging && (
          <div className="absolute inset-1.5 z-10 flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-cyan-400/80 bg-[#0a0d14]/85 text-cyan-200 text-sm pointer-events-none">
            <ImagePlus className="w-6 h-6" />
            <span>วางไฟล์เพื่อแนบให้ {tab.name}</span>
            <span className="text-[11px] text-slate-400">รูปหรือ PDF จะถูกบันทึกใน .superai/attachments ของโปรเจกต์</span>
          </div>
        )}
        {notice && (
          <div
            role={notice.kind === 'error' ? 'alert' : 'status'}
            aria-label="สถานะการแนบไฟล์"
            className={`absolute right-3 top-3 z-10 max-w-[min(360px,calc(100%-24px))] flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] shadow-lg ${
              notice.kind === 'error' ? 'border-rose-500/60 bg-[#2a1118] text-rose-100' : 'border-cyan-500/50 bg-[#0e1a26] text-slate-200'
            }`}
          >
            {notice.thumb ? (
              <img src={notice.thumb} alt="" className="w-9 h-9 rounded object-cover shrink-0 border border-white/10" />
            ) : notice.kind === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-300" />
            ) : (
              <ImagePlus className="w-4 h-4 shrink-0 text-cyan-300" />
            )}
            <div className="min-w-0">
              <div className="font-medium">{notice.text}</div>
              {notice.detail && <div className="text-slate-400 break-words">{notice.detail}</div>}
            </div>
            {notice.kind !== 'busy' && (
              <button onClick={() => showNotice(null)} className="ml-1 p-0.5 text-slate-500 hover:text-slate-200 rounded shrink-0" title="ปิดข้อความ" aria-label="ปิดข้อความ">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {tab.sessionId && reading && (
          <div
            ref={readerRef}
            tabIndex={0}
            aria-label={`ข้อความใน ${tab.name}`}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeReader();
              }
            }}
            className="terminal-reader absolute inset-1.5 z-[5] overflow-auto rounded-md bg-[#0a0d14] px-4 pt-3 pb-14 outline-none"
          >
            <div className="mb-2 text-[11px] text-slate-500 select-none">โหมดอ่าน · CLI ยังทำงานอยู่ · กด Esc หรือปุ่มมุมขวาล่างเพื่อกลับไปพิมพ์</div>
            {readerText || <span className="text-slate-500">ยังไม่มีข้อความ</span>}
          </div>
        )}
        {tab.sessionId && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              if (reading) closeReader();
              else setReading(true);
            }}
            className={`absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] shadow ${
              reading ? 'border-cyan-500/60 bg-[#0e1a26] text-cyan-200' : 'border-[#1f293d] bg-[#0e131f]/90 text-slate-400 opacity-70 hover:opacity-100 hover:text-slate-200'
            }`}
            title={reading ? 'กลับไปพิมพ์ใน terminal (Esc)' : 'อ่านข้อความใน terminal แบบตัวหนังสือปกติ สระและวรรณยุกต์ไม่เพี้ยน'}
            aria-pressed={reading}
          >
            {reading ? <TerminalIcon className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
            <span>{reading ? 'กลับไปพิมพ์' : 'อ่านแบบข้อความ'}</span>
          </button>
        )}
        {tab.sessionId ? (
          <div ref={containerRef} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
            {tab.status === 'error' ? 'เปิด terminal ไม่สำเร็จ' : 'กำลังเปิด terminal…'}
          </div>
        )}
      </div>
    </div>
  );
};
