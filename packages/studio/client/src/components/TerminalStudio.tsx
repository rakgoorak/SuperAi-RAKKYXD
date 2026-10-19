import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Plus, 
  Send, 
  LayoutGrid, 
  Rows3, 
  Bot, 
  Sparkles, 
  Terminal as TerminalIcon, 
  ChevronDown,
  Maximize2,
  ExternalLink,
  MoreHorizontal,
  Circle,
  Play
} from 'lucide-react';
import { AgentThread } from './WorkspaceSidebar.js';
import { TerminalPane, TerminalTab, tabIcon } from './TerminalPane.js';
import { PixelAvatar } from './PixelAvatar.js';
import { VoiceControl } from './VoiceControl.js';

interface TerminalStudioProps {
  activeThread?: AgentThread;
  currentWorkspaceId: string;
  workspaceName?: string;
  newTerminalSignal: number;
  onOpenNewSessionModal?: () => void;
  externalLaunchRequest?: { count: number; agentType: string; sessionNames: string[] } | null;
}

const AGENT_SUGGESTIONS: Record<string, string> = {
  Emma: 'refactor Blue light.mat',
  James: 'how do I log an error?',
  Olivia: 'refactor InventoryBar.cs',
  Michael: 'how does Inventory.cs work?',
  Grace: 'fix typecheck errors',
  Daniel: 'create a util logging.py that rotates',
};

const DEFAULT_AGENTS = ['Emma', 'James', 'Olivia', 'Michael', 'Grace', 'Daniel'];

export const TerminalStudio: React.FC<TerminalStudioProps> = ({
  activeThread,
  currentWorkspaceId,
  workspaceName = 'vibecodingsimulator',
  newTerminalSignal,
  onOpenNewSessionModal,
  externalLaunchRequest,
}) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [layout, setLayout] = useState<'grid' | 'tabs'>('grid');
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
      const id = opts.threadId ? `thread-${opts.threadId}` : `tab-${opts.name.toLowerCase()}-${Date.now()}`;
      if (spawnedRef.current.has(id)) {
        setActiveTabId(id);
        return;
      }
      spawnedRef.current.add(id);

      const tab: TerminalTab = {
        id,
        name: opts.name,
        type: opts.type,
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
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  sessionId: data.id,
                  status: data.status === 'error' ? 'error' : 'running',
                }
              : t
          )
        );
      } catch {
        setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'error' } : t)));
      }
    },
    [currentWorkspaceId]
  );

  // Initialize with the 6 agent sessions matching Screenshot 2!
  const launchSixSessions = useCallback(() => {
    DEFAULT_AGENTS.forEach((name) => {
      spawnTerminal({ type: 'claude-code', name });
    });
  }, [spawnTerminal]);

  useEffect(() => {
    if (spawnedRef.current.size === 0) {
      launchSixSessions();
    }
  }, [launchSixSessions]);

  // Handle launch request from NewSessionModal
  useEffect(() => {
    if (externalLaunchRequest) {
      const { sessionNames, agentType } = externalLaunchRequest;
      sessionNames.forEach((name) => {
        spawnTerminal({ type: agentType, name });
      });
    }
  }, [externalLaunchRequest, spawnTerminal]);

  // Header "+ Terminal" button
  useEffect(() => {
    if (newTerminalSignal > 0) {
      const nextName = `Agent ${tabs.length + 1}`;
      spawnTerminal({ type: 'claude-code', name: nextName });
    }
  }, [newTerminalSignal, spawnTerminal, tabs.length]);

  const closeTab = (id: string) => {
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
    setTabs((prev) =>
      prev.map((t) => (t.id === id && t.status === 'running' ? { ...t, status: 'exited' } : t))
    );

  const sendPromptToTarget = (text: string, targetId: string) => {
    if (!text.trim()) return;
    const sender = sendersRef.current.get(targetId);
    if (sender) {
      sender(text + '\r');
    }
    history.current.unshift(text);
    historyIdx.current = -1;
  };

  const sendPrompt = () => {
    if (!inputVal.trim()) return;
    sendPromptToTarget(inputVal, activeTabId);
    setInputVal('');
  };

  const sendToAll = () => {
    if (!inputVal.trim()) return;
    sendersRef.current.forEach((sender) => sender(inputVal + '\r'));
    history.current.unshift(inputVal);
    setInputVal('');
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const gridCols = tabs.length <= 1 ? 1 : tabs.length <= 4 ? 2 : 3;
  const gridRows = Math.max(1, Math.ceil(tabs.length / gridCols));

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[#0a0d14] overflow-hidden">
      {/* Top Controls Bar */}
      <div className="h-10 bg-[#0e131f] border-b border-[#1f293d] flex items-center justify-between px-3 select-none shrink-0">
        <div className="flex items-center space-x-2 overflow-x-auto flex-1 min-w-0">
          <span className="text-xs font-semibold text-slate-300 truncate">
            {workspaceName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/40 font-mono">
            {tabs.length} sessions
          </span>

          {/* Quick tab pills */}
          <div className="flex items-center space-x-1 pl-2">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center space-x-1 transition-all ${
                    isActive
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#141a29]'
                  }`}
                >
                  <Circle
                    className={`w-1.5 h-1.5 ${
                      tab.status === 'running'
                        ? 'fill-emerald-400 text-emerald-400'
                        : 'fill-slate-500 text-slate-500'
                    }`}
                  />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          {onOpenNewSessionModal && (
            <button
              onClick={onOpenNewSessionModal}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
              title="Configure and launch parallel agent presets"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Session</span>
            </button>
          )}

          {/* Grid vs Tabs layout */}
          <div className="flex items-center bg-[#141a29] p-0.5 rounded-md border border-[#1f293d]">
            <button
              onClick={() => setLayout('grid')}
              className={`p-1 rounded ${
                layout === 'grid' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="2x3 Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayout('tabs')}
              className={`p-1 rounded ${
                layout === 'tabs' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Single Tab View"
            >
              <Rows3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2x3 Grid of Agent Terminal Cards (Screenshot 2 Match) */}
      <div
        className={`flex-1 min-h-0 p-2 overflow-y-auto ${
          layout === 'grid' && tabs.length > 0 ? 'grid gap-2' : 'flex flex-col'
        }`}
        style={
          layout === 'grid'
            ? {
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
              }
            : undefined
        }
      >
        {tabs.map((tab, idx) => {
          const isFocused = tab.id === activeTabId;
          const suggestion = AGENT_SUGGESTIONS[tab.name] || 'refactor code';

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex flex-col min-h-0 min-w-0 bg-[#0c101a] rounded-xl border transition-all ${
                isFocused
                  ? 'border-cyan-500/80 shadow-[0_0_15px_rgba(0,210,255,0.12)]'
                  : 'border-[#1b2336] hover:border-slate-700'
              } overflow-hidden`}
            >
              {/* Tile Header */}
              <div className="h-7 px-2.5 bg-[#0f1422] border-b border-[#1c2438] flex items-center justify-between text-xs select-none shrink-0">
                <div className="flex items-center space-x-1.5 truncate">
                  <span className="text-xs">💥</span>
                  <span className={`font-semibold text-[12px] truncate ${isFocused ? 'text-cyan-300' : 'text-slate-300'}`}>
                    {tab.name}
                  </span>
                  <Circle className="w-1.5 h-1.5 fill-emerald-400 text-emerald-400 animate-pulse ml-1" />
                </div>

                <div className="flex items-center space-x-1 text-slate-400">
                  <button className="p-0.5 hover:text-white rounded" title="Options">
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                  <button className="p-0.5 hover:text-white rounded" title="Popout">
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="p-0.5 hover:text-rose-400 rounded"
                    title="Close"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Character Avatar Banner (Screenshot 2 Match) */}
              <div className="px-3 py-2 bg-[#0d121e] border-b border-[#182033] flex items-center space-x-3 select-none shrink-0">
                <PixelAvatar size={34} color="#e07a5f" />
                <div className="text-[10px] leading-tight font-mono truncate">
                  <div className="font-bold text-slate-200 truncate">Claude Code v2.1.294</div>
                  <div className="text-slate-400 truncate">Opus 5.5 with xhigh ...</div>
                  <div className="text-slate-500 truncate">Claude Max</div>
                  <div className="text-slate-500 truncate">.../{workspaceName}</div>
                </div>
              </div>

              {/* Terminal Output Body */}
              <div className="flex-1 min-h-[100px] p-1 bg-[#0a0d14] overflow-hidden">
                <TerminalPane
                  tab={tab}
                  visible={true}
                  focused={isFocused}
                  showHeader={false}
                  onFocus={() => setActiveTabId(tab.id)}
                  onClose={() => closeTab(tab.id)}
                  onExit={() => markExited(tab.id)}
                  registerSender={registerSender}
                />
              </div>

              {/* Tile Footer (Screenshot 2 Match) */}
              <div className="p-2 bg-[#0c101a] border-t border-[#182033] space-y-1 select-none shrink-0">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
                    <span>xhigh</span>
                    <span className="text-slate-600">/ effort</span>
                  </span>
                </div>

                {/* Quick Suggestion Prompt Button */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    sendPromptToTarget(`"${suggestion}"`, tab.id);
                  }}
                  className="px-2 py-1 rounded bg-[#131929] hover:bg-[#1a233a] border border-[#1f283d] text-[11px] font-mono text-slate-300 truncate cursor-pointer transition-colors"
                >
                  <span className="text-cyan-400 font-bold">&gt;</span> Try{' '}
                  <span className="text-cyan-300">"{suggestion}"</span>
                </div>

                {/* Auto Mode Indicator */}
                <div className="text-[10px] text-amber-400/90 font-mono flex items-center space-x-1">
                  <span className="font-bold">&gt;&gt;</span>
                  <span>auto mode on</span>
                  <span className="text-slate-500">(shift+tab to ...)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Bottom Prompt & Voice Control Bar */}
      <div className="p-3 bg-[#0e131f] border-t border-[#1f293d] select-none shrink-0 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-2">
            <span>
              Target: <span className="text-cyan-300 font-semibold">{activeTab?.name || 'All'}</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              Enter = Active Terminal · Ctrl+Enter = Broadcast to All
            </span>
          </div>

          {/* Thai & English Voice Control Integration */}
          <VoiceControl
            onTranscript={(text) => setInputVal(text)}
            onExecute={sendPrompt}
            onBroadcast={sendToAll}
            onInterrupt={() => sendersRef.current.get(activeTabId)?.('\x03')}
            onClear={() => sendersRef.current.get(activeTabId)?.('clear\r')}
            onLaunchSix={launchSixSessions}
          />
        </div>

        {/* Input Bar */}
        <div className="flex items-center bg-[#141a29] border border-[#24314c] focus-within:border-cyan-500 rounded-lg px-3 py-1.5 shadow-inner transition-colors">
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
            placeholder="Type instructions or use voice command (e.g. 'Build login system', 'refactor code')..."
            className="flex-1 bg-transparent text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none font-mono"
          />

          <button
            onClick={sendToAll}
            className="ml-2 px-2.5 py-1 rounded bg-[#1e2738] hover:bg-[#28354c] text-slate-300 text-xs border border-[#2b3952] transition-colors"
            title="Broadcast prompt to all 6 sessions simultaneously"
          >
            All
          </button>
          <button
            onClick={sendPrompt}
            className="ml-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1 transition-colors shadow-sm"
          >
            <span>Send</span>
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
