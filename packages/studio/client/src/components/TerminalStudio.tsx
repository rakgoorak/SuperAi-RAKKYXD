import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Send, LayoutGrid, Rows3, Bot, Sparkles, Terminal as TerminalIcon, ChevronDown } from 'lucide-react';
import { AgentThread } from './WorkspaceSidebar.js';
import { TerminalPane, TerminalTab, tabIcon } from './TerminalPane.js';

interface TerminalStudioProps {
  activeThread?: AgentThread;
  currentWorkspaceId: string;
  /** Incremented by the header "+ Terminal" button to open a new shell. */
  newTerminalSignal: number;
}

/** CLI typed into the shell for agent threads. Others just open a shell. */
const AGENT_COMMANDS: Record<string, string | undefined> = {
  'claude-code': 'claude',
  codex: 'codex',
};

const NEW_TERMINAL_OPTIONS: Array<{ type: string; label: string; icon: React.ReactNode }> = [
  { type: 'terminal', label: 'PowerShell', icon: <TerminalIcon className="w-3.5 h-3.5 text-slate-400" /> },
  { type: 'claude-code', label: 'Claude Code', icon: <Bot className="w-3.5 h-3.5 text-cyan-400" /> },
  { type: 'codex', label: 'Codex', icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" /> },
];

let tabCounter = 0;

export const TerminalStudio: React.FC<TerminalStudioProps> = ({
  activeThread,
  currentWorkspaceId,
  newTerminalSignal,
}) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [layout, setLayout] = useState<'tabs' | 'grid'>('grid');
  const [inputVal, setInputVal] = useState('');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const sendersRef = useRef<Map<string, (data: string) => void>>(new Map());
  const spawnedRef = useRef<Set<string>>(new Set());
  const history = useRef<string[]>([]);
  const historyIdx = useRef<number>(-1);

  const registerSender = useCallback((id: string, sender: ((data: string) => void) | null) => {
    if (sender) sendersRef.current.set(id, sender);
    else sendersRef.current.delete(id);
  }, []);

  const spawnTerminal = useCallback(
    async (opts: { type: string; name: string; threadId?: string }) => {
      const id = opts.threadId ? `thread-${opts.threadId}` : `tab-${Date.now()}-${++tabCounter}`;
      if (spawnedRef.current.has(id)) {
        setActiveTabId(id);
        return;
      }
      spawnedRef.current.add(id);

      const tab: TerminalTab = {
        id,
        name: opts.name,
        type: opts.type,
        autoCommand: AGENT_COMMANDS[opts.type],
        status: 'connecting',
      };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(id);

      try {
        const res = await fetch('/api/terminals/spawn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: opts.name,
            wsId: currentWorkspaceId,
            threadId: opts.threadId,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.id) throw new Error(data.error || 'spawn failed');
        setTabs((prev) =>
          prev.map((t) => (t.id === id ? { ...t, sessionId: data.id, status: data.status === 'error' ? 'error' : 'running' } : t))
        );
      } catch {
        setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'error' } : t)));
      }
    },
    [currentWorkspaceId]
  );

  // First terminal on launch.
  useEffect(() => {
    if (spawnedRef.current.size === 0) {
      spawnTerminal({ type: 'terminal', name: 'PowerShell' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selecting a thread in the sidebar opens (or focuses) its terminal.
  useEffect(() => {
    if (activeThread) {
      spawnTerminal({ type: activeThread.type, name: activeThread.title, threadId: activeThread.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.id]);

  // Header "+ Terminal" button.
  useEffect(() => {
    if (newTerminalSignal > 0) {
      spawnTerminal({ type: 'terminal', name: `PowerShell ${tabCounter + 1}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newTerminalSignal]);

  const closeTab = async (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab?.sessionId) {
      fetch(`/api/terminals/${tab.sessionId}/kill`, { method: 'POST' }).catch(() => {});
    }
    spawnedRef.current.delete(id);
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    if (activeTabId === id) setActiveTabId(next[next.length - 1]?.id || '');
  };

  const markExited = (id: string) =>
    setTabs((prev) => prev.map((t) => (t.id === id && t.status === 'running' ? { ...t, status: 'exited' } : t)));

  const sendPrompt = () => {
    const text = inputVal;
    if (!text.trim()) return;
    const sender = sendersRef.current.get(activeTabId);
    if (!sender) return;
    sender(text + '\r');
    history.current.unshift(text);
    historyIdx.current = -1;
    setInputVal('');
  };

  const sendToAll = () => {
    const text = inputVal;
    if (!text.trim()) return;
    sendersRef.current.forEach((sender) => sender(text + '\r'));
    history.current.unshift(text);
    setInputVal('');
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const gridCols = tabs.length <= 1 ? 1 : tabs.length <= 4 ? 2 : 3;
  const gridRows = Math.max(1, Math.ceil(tabs.length / gridCols));

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[#0a0d14] overflow-hidden">
      {/* Tab bar */}
      <div className="h-10 bg-[#0e131f] border-b border-[#1f293d] flex items-center px-2 gap-1 select-none shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                  isActive ? 'bg-[#162033] text-cyan-300' : 'text-slate-400 hover:text-slate-200 hover:bg-[#141a29]'
                }`}
              >
                {tabIcon(tab.type)}
                <span className="truncate max-w-[130px]">{tab.name}</span>
                {tab.status === 'exited' && <span className="text-[10px] text-slate-500">exited</span>}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded transition-opacity"
                  title="Close terminal"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          <div className="relative shrink-0">
            <button
              onClick={() => setShowNewMenu((v) => !v)}
              className="flex items-center p-1 text-slate-400 hover:text-cyan-400 hover:bg-[#141a29] rounded transition-colors"
              title="Open another terminal"
            >
              <Plus className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </button>
            {showNewMenu && (
              <div className="fixed z-40 mt-1 w-44 bg-[#141a29] border border-[#27354f] rounded-lg shadow-xl p-1 text-xs">
                {NEW_TERMINAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => {
                      setShowNewMenu(false);
                      spawnTerminal({ type: opt.type, name: `${opt.label} ${tabCounter + 1}` });
                    }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1f293d] flex items-center gap-2 text-slate-200"
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Layout switch */}
        <div className="flex items-center bg-[#141a29] p-0.5 rounded-md border border-[#1f293d] shrink-0">
          <button
            onClick={() => setLayout('grid')}
            className={`p-1 rounded ${layout === 'grid' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="Show all terminals side by side"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLayout('tabs')}
            className={`p-1 rounded ${layout === 'tabs' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            title="One terminal at a time"
          >
            <Rows3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminals */}
      <div
        className={`flex-1 min-h-0 ${layout === 'grid' && tabs.length > 0 ? 'grid gap-2 p-2' : ''}`}
        style={
          layout === 'grid'
            ? { gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {tabs.map((tab) => (
          <TerminalPane
            key={tab.id}
            tab={tab}
            visible={layout === 'grid' || tab.id === activeTabId}
            focused={tab.id === activeTabId}
            showHeader={layout === 'grid'}
            onFocus={() => setActiveTabId(tab.id)}
            onClose={() => closeTab(tab.id)}
            onExit={() => markExited(tab.id)}
            registerSender={registerSender}
          />
        ))}
        {tabs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-3">
            <TerminalIcon className="w-8 h-8" />
            <span>No terminals open</span>
            <button
              onClick={() => spawnTerminal({ type: 'terminal', name: 'PowerShell' })}
              className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
            >
              Open terminal
            </button>
          </div>
        )}
      </div>

      {/* Prompt bar — sends to the focused terminal (or all) */}
      <div className="p-3 bg-[#0e131f] border-t border-[#1f293d] select-none shrink-0">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
          <span>
            Sending to:{' '}
            <span className="text-cyan-300 font-medium">{activeTab ? activeTab.name : '—'}</span>
            <span className="ml-2">· click a terminal to type directly into it</span>
          </span>
          <button
            onClick={() => sendersRef.current.get(activeTabId)?.('\x03')}
            className="px-2 py-0.5 rounded bg-[#1e2738] hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-[#2b3952] transition-colors"
            title="Send Ctrl+C to the focused terminal"
          >
            Ctrl+C
          </button>
        </div>
        <div className="flex items-center bg-[#141a29] border border-[#24314c] focus-within:border-cyan-500 rounded-lg px-3 py-1.5 transition-colors">
          <span className="text-cyan-400 font-mono text-sm mr-2">&gt;</span>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.ctrlKey) sendToAll();
                else sendPrompt();
              } else if (e.key === 'ArrowUp' && history.current.length) {
                historyIdx.current = Math.min(historyIdx.current + 1, history.current.length - 1);
                setInputVal(history.current[historyIdx.current]);
                e.preventDefault();
              } else if (e.key === 'ArrowDown') {
                historyIdx.current = Math.max(historyIdx.current - 1, -1);
                setInputVal(historyIdx.current >= 0 ? history.current[historyIdx.current] : '');
                e.preventDefault();
              }
            }}
            placeholder="Type a prompt or command… (Enter = focused terminal, Ctrl+Enter = all terminals)"
            className="flex-1 bg-transparent text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none font-mono"
          />
          <button
            onClick={sendToAll}
            className="ml-2 px-2.5 py-1 rounded bg-[#1e2738] hover:bg-[#28354c] text-slate-300 text-xs border border-[#2b3952] transition-colors"
            title="Send to every open terminal"
          >
            All
          </button>
          <button
            onClick={sendPrompt}
            className="ml-2 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <span>Send</span>
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
