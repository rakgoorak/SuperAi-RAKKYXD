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
  Play,
  Volume2,
  Users,
  AtSign,
  Radio,
  Check
} from 'lucide-react';
import { AgentThread } from './WorkspaceSidebar.js';
import { TerminalPane, TerminalTab, tabIcon } from './TerminalPane.js';
import { PixelAvatar } from './PixelAvatar.js';
import { VoiceControl } from './VoiceControl.js';
import { sound } from '../utils/sound.js';

interface TerminalStudioProps {
  activeThread?: AgentThread;
  currentWorkspaceId: string;
  workspaceName?: string;
  newTerminalSignal: number;
  onOpenNewSessionModal?: () => void;
  externalLaunchRequest?: { count: number; agentType: string; sessionNames: string[] } | null;
  injectedPrompt?: string;
  onPromptConsumed?: () => void;
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
  injectedPrompt,
  onPromptConsumed,
}) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [layout, setLayout] = useState<'grid' | 'tabs'>('grid');
  const [inputVal, setInputVal] = useState('');
  const [targetAgent, setTargetAgent] = useState<'all' | string>('all');
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [autoModes, setAutoModes] = useState<Record<string, boolean>>({});

  const sendersRef = useRef<Map<string, (data: string) => void>>(new Map());
  const spawnedRef = useRef<Set<string>>(new Set());
  const history = useRef<string[]>([]);
  const historyIdx = useRef<number>(-1);

  // Consume injected prompt from BrowserPreview
  useEffect(() => {
    if (injectedPrompt) {
      setInputVal(injectedPrompt);
      sound.playBlip(700, 0.04);
      if (onPromptConsumed) onPromptConsumed();
    }
  }, [injectedPrompt, onPromptConsumed]);

  const registerSender = useCallback((id: string, sender: ((data: string) => void) | null) => {
    if (sender) sendersRef.current.set(id, sender);
    else sendersRef.current.delete(id);
  }, []);

  const spawnTerminal = useCallback(
    async (opts: { type: string; name: string; threadId?: string; autoCommand?: string }) => {
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

  // Initialize with the 6 agent sessions matching BridgeMind Screenshot 2
  const launchSixSessions = useCallback(() => {
    DEFAULT_AGENTS.forEach((name) => {
      spawnTerminal({ type: 'claude-code', name });
    });
    sound.playBroadcast();
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
      sound.playBroadcast();
    }
  }, [externalLaunchRequest, spawnTerminal]);

  // Header "+ Terminal" button
  useEffect(() => {
    if (newTerminalSignal > 0) {
      const nextName = `Agent ${tabs.length + 1}`;
      spawnTerminal({ type: 'claude-code', name: nextName });
      sound.playBlip(650, 0.04);
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
    sound.playBlip(350, 0.03);
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

  // Smart Prompt Sender: Parse @mention or route according to target selector
  const executePrompt = (overrideText?: string, isBroadcast = false) => {
    const raw = (overrideText ?? inputVal).trim();
    if (!raw) return;

    // Check for @mention prefix e.g. "@Emma: check shader" or "@all: build"
    const matchMention = raw.match(/^@([a-zA-Z0-9_-]+)[:\s]+([\s\S]*)$/);

    if (matchMention) {
      const targetName = matchMention[1].toLowerCase();
      const actualCommand = matchMention[2].trim();

      if (targetName === 'all' || isBroadcast) {
        // Broadcast
        sendersRef.current.forEach((sender) => sender(actualCommand + '\r'));
        sound.playBroadcast();
      } else {
        // Find matching agent tab by name
        const found = tabs.find((t) => t.name.toLowerCase() === targetName);
        if (found) {
          const sender = sendersRef.current.get(found.id);
          if (sender) sender(actualCommand + '\r');
          sound.playExecute();
        } else {
          // Fallback to active tab
          const sender = sendersRef.current.get(activeTabId);
          if (sender) sender(raw + '\r');
          sound.playExecute();
        }
      }
    } else if (isBroadcast || targetAgent === 'all') {
      sendersRef.current.forEach((sender) => sender(raw + '\r'));
      sound.playBroadcast();
    } else {
      // Send to specific target or active tab
      const targetId = targetAgent === 'active' || !targetAgent ? activeTabId : targetAgent;
      const sender = sendersRef.current.get(targetId);
      if (sender) sender(raw + '\r');
      sound.playExecute();
    }

    history.current.unshift(raw);
    historyIdx.current = -1;
    setInputVal('');
  };

  const launchClaudeInSession = (tabId: string) => {
    const sender = sendersRef.current.get(tabId);
    if (sender) {
      const isAuto = autoModes[tabId] ?? true;
      const cmd = isAuto ? 'claude --dangerously-skip-permissions\r' : 'claude\r';
      sender(cmd);
      sound.playExecute();
    }
  };

  const startAllClaude = () => {
    sendersRef.current.forEach((sender) => {
      sender('claude --dangerously-skip-permissions\r');
    });
    sound.playBroadcast();
  };

  const toggleAutoMode = (tabId: string) => {
    setAutoModes((prev) => ({
      ...prev,
      [tabId]: !prev[tabId],
    }));
    sound.playBlip(600, 0.03);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const gridCols = tabs.length <= 1 ? 1 : tabs.length <= 4 ? 2 : 3;

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[#0a0d14] overflow-hidden select-none">
      {/* Top Controls Bar */}
      <div className="h-10 bg-[#0e131f] border-b border-[#1f293d] flex items-center justify-between px-3 shrink-0">
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
                  onClick={() => {
                    setActiveTabId(tab.id);
                    sound.playBlip(500, 0.02);
                  }}
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
          {/* 1-Click Start All Claude Code Agents */}
          <button
            onClick={startAllClaude}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-all"
            title="Start Claude Code CLI on all 6 seats in parallel"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Start 6 Claude</span>
          </button>

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
              onClick={() => {
                setLayout('grid');
                sound.playBlip(550, 0.02);
              }}
              className={`p-1 rounded ${
                layout === 'grid' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="2x3 Grid Cockpit"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setLayout('tabs');
                sound.playBlip(550, 0.02);
              }}
              className={`p-1 rounded ${
                layout === 'tabs' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Single Full Tab"
            >
              <Rows3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Cockpit Content Area */}
      <div className="flex-1 p-2 overflow-hidden bg-[#07090e]">
        {layout === 'tabs' && activeTab ? (
          <div className="h-full rounded-xl border border-[#1b2336] bg-[#0c101a] overflow-hidden flex flex-col">
            <div className="flex-1 p-1">
              <TerminalPane
                tab={activeTab}
                visible={true}
                focused={true}
                showHeader={false}
                onFocus={() => {}}
                onClose={() => closeTab(activeTab.id)}
                onExit={() => markExited(activeTab.id)}
                registerSender={registerSender}
              />
            </div>
          </div>
        ) : (
          <div
            className="grid gap-2 h-full w-full"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${Math.max(1, Math.ceil(tabs.length / gridCols))}, minmax(0, 1fr))`,
            }}
          >
            {tabs.map((tab) => {
              const isFocused = tab.id === activeTabId;
              const suggestion = AGENT_SUGGESTIONS[tab.name] || 'refactor code';
              const isAutoOn = autoModes[tab.id] ?? true;

              return (
                <div
                  key={tab.id}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    sound.playBlip(480, 0.02);
                  }}
                  className={`flex flex-col min-h-0 min-w-0 bg-[#0c101a] rounded-xl border transition-all ${
                    isFocused
                      ? 'border-cyan-500/80 shadow-[0_0_15px_rgba(0,210,255,0.12)]'
                      : 'border-[#1b2336] hover:border-slate-700'
                  } overflow-hidden`}
                >
                  {/* Card Header (Matching BridgeMind Screenshot 2) */}
                  <div className="h-7 px-2.5 bg-[#0f1422] border-b border-[#1c2438] flex items-center justify-between text-xs shrink-0">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="text-xs">💥</span>
                      <span className={`font-semibold text-[12px] truncate ${isFocused ? 'text-cyan-300' : 'text-slate-300'}`}>
                        {tab.name}
                      </span>
                      <Circle className="w-1.5 h-1.5 fill-emerald-400 text-emerald-400 animate-pulse ml-1" />
                    </div>

                    <div className="flex items-center space-x-1.5 text-slate-400">
                      {/* 1-Click Launch Claude Code CLI */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          launchClaudeInSession(tab.id);
                        }}
                        className="px-1.5 py-0.5 rounded bg-blue-950/80 hover:bg-blue-900 border border-blue-700/60 text-blue-300 text-[10px] font-mono flex items-center space-x-1"
                        title="Start Claude Code CLI in this seat"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Claude</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.id);
                        }}
                        className="p-0.5 hover:text-rose-400 rounded"
                        title="Close Seat"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Retro Pixel Avatar Character Banner (Screenshot 2 Match) */}
                  <div className="px-3 py-2 bg-[#0d121e] border-b border-[#182033] flex items-center space-x-3 shrink-0">
                    <PixelAvatar size={34} color="#e07a5f" />
                    <div className="text-[10px] leading-tight font-mono truncate">
                      <div className="font-bold text-slate-200 truncate">Claude Code v2.1.303</div>
                      <div className="text-slate-400 truncate">Opus 5.5 with xhigh ...</div>
                      <div className="text-slate-500 truncate">Claude Max</div>
                      <div className="text-slate-500 truncate">.../{workspaceName}</div>
                    </div>
                  </div>

                  {/* Terminal Output */}
                  <div className="flex-1 min-h-[90px] p-1 bg-[#0a0d14] overflow-hidden">
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

                  {/* Card Footer: Suggestions & Auto Mode */}
                  <div className="p-2 bg-[#0c101a] border-t border-[#182033] space-y-1 shrink-0">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span className="flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
                        <span>xhigh</span>
                        <span className="text-slate-600">/ effort</span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAutoMode(tab.id);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                          isAutoOn
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            : 'bg-[#141a29] text-slate-500 border border-slate-700'
                        }`}
                      >
                        {isAutoOn ? 'AUTO ON' : 'AUTO OFF'}
                      </button>
                    </div>

                    {/* Quick Suggestion Prompt Chip */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        sendPromptToTarget(`"${suggestion}"`, tab.id);
                        sound.playExecute();
                      }}
                      className="px-2 py-1 rounded bg-[#131929] hover:bg-[#1a233a] border border-[#1f283d] text-[11px] font-mono text-slate-300 truncate cursor-pointer transition-colors"
                      title="Click to run suggestion"
                    >
                      <span className="text-cyan-400 font-bold">&gt;</span> Try{' '}
                      <span className="text-cyan-300">"{suggestion}"</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Bottom Prompt & Voice Control Bar (Unified Broadcast Cockpit) */}
      <div className="p-2.5 bg-[#0e131f] border-t border-[#1f293d] shrink-0 space-y-1.5 relative">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-2">
            {/* Target Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowTargetDropdown(!showTargetDropdown)}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#141b2c] hover:bg-[#1c2740] border border-cyan-800/50 text-cyan-300 text-xs font-semibold transition-colors"
              >
                {targetAgent === 'all' ? (
                  <>
                    <Users className="w-3 h-3 text-cyan-400" />
                    <span>@All (Broadcast)</span>
                  </>
                ) : (
                  <>
                    <AtSign className="w-3 h-3 text-orange-400" />
                    <span>
                      {tabs.find((t) => t.id === targetAgent)?.name || activeTab?.name || 'Active'}
                    </span>
                  </>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showTargetDropdown && (
                <div className="absolute bottom-8 left-0 z-50 bg-[#0d1322] border border-[#23314f] rounded-xl shadow-2xl p-1.5 min-w-[180px] space-y-1 animate-in fade-in zoom-in-95">
                  <div
                    onClick={() => {
                      setTargetAgent('all');
                      setShowTargetDropdown(false);
                      sound.playBlip(700, 0.03);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      targetAgent === 'all'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : 'text-slate-300 hover:bg-[#17223b]'
                    }`}
                  >
                    <span className="flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span>@All (Broadcast 6 seats)</span>
                    </span>
                    {targetAgent === 'all' && <Check className="w-3 h-3 text-cyan-400" />}
                  </div>

                  <div className="h-px bg-[#1d273d] my-1" />

                  {tabs.map((t) => {
                    const isSelected = targetAgent === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          setTargetAgent(t.id);
                          setShowTargetDropdown(false);
                          sound.playBlip(600, 0.03);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#1b253d] text-cyan-300 border border-cyan-800'
                            : 'text-slate-300 hover:bg-[#17223b]'
                        }`}
                      >
                        <span className="flex items-center space-x-1.5">
                          <AtSign className="w-3 h-3 text-orange-400" />
                          <span>@{t.name}</span>
                        </span>
                        {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <span className="text-slate-600">|</span>
            <span className="text-slate-400 text-[10px]">
              Type <code className="text-cyan-400 font-mono">@Emma: prompt</code> or <code className="text-cyan-400 font-mono">@all: prompt</code>
            </span>
          </div>

          {/* Thai & English Voice Recognition HUD */}
          <VoiceControl
            onTranscript={(text) => setInputVal(text)}
            onExecute={() => executePrompt(undefined, false)}
            onBroadcast={() => executePrompt(undefined, true)}
            onInterrupt={() => sendersRef.current.get(activeTabId)?.('\x03')}
            onClear={() => sendersRef.current.get(activeTabId)?.('clear\r')}
            onLaunchSix={launchSixSessions}
            onStartClaudeAll={startAllClaude}
          />
        </div>

        {/* Global Input Bar */}
        <div className="flex items-center bg-[#141a29] border border-[#24314c] focus-within:border-cyan-500 rounded-lg px-3 py-1.5 shadow-inner transition-colors">
          <span className="text-cyan-400 font-mono text-sm mr-2">&gt;</span>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.ctrlKey) executePrompt(undefined, true);
                else executePrompt(undefined, false);
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
            placeholder="Type command or voice dictate (e.g. '@Emma: refactor shader', '@all: check build')..."
            className="flex-1 bg-transparent text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none font-mono"
          />

          <button
            onClick={() => executePrompt(undefined, true)}
            className="ml-2 px-2.5 py-1 rounded bg-[#1e2738] hover:bg-[#28354c] text-cyan-300 text-xs font-semibold border border-[#2b3952] transition-colors"
            title="Broadcast prompt to all 6 agent seats (Ctrl+Enter)"
          >
            Broadcast All
          </button>
          <button
            onClick={() => executePrompt(undefined, false)}
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
