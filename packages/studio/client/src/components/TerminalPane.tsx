import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { X, Terminal as TerminalIcon, Bot, Sparkles, Cpu, Circle } from 'lucide-react';

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

  // Create xterm + websocket once per session.
  useEffect(() => {
    if (!containerRef.current || !tab.sessionId) return;

    const term = new Terminal({
      theme: THEME,
      fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.15,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    termRef.current = term;
    fitRef.current = fit;

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
      window.clearTimeout(autoTimer);
      observer.disconnect();
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

  return (
    <div
      onMouseDown={onFocus}
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
      <div className="flex-1 min-h-0 p-1.5">
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
