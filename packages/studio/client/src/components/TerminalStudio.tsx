import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal as TerminalIcon, 
  X, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Send, 
  RotateCcw, 
  Slash, 
  Play, 
  CheckCircle2, 
  Clock, 
  Bot,
  Layers
} from 'lucide-react';
import { AnsiUp } from 'ansi_up';
import { AgentThread } from './WorkspaceSidebar.js';

interface TerminalTab {
  id: string;
  name: string;
  sessionId?: string;
  type: string;
}

interface TerminalStudioProps {
  activeThread?: AgentThread;
  currentWorkspaceId: string;
}

const ansiUp = new AnsiUp();

export const TerminalStudio: React.FC<TerminalStudioProps> = ({
  activeThread,
  currentWorkspaceId
}) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'tab-1', name: 'Claude Code', type: 'claude-code' },
    { id: 'tab-2', name: 'PowerShell', type: 'terminal' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [outputLines, setOutputLines] = useState<Record<string, string>>({
    'tab-1': `\x1b[36mBridgeMind Studio v1.0 [Multi-Agent Terminal Multiplexer]\x1b[0m\r\n\x1b[32m✔ Connected to Agent Engine\x1b[0m\r\n\x1b[90mSession ID: session-claude-01 | Model: Claude 3.7 Sonnet\x1b[0m\r\n\r\nWelcome! Type instructions to command Claude Code or switch tabs to launch parallel agents.\r\n\r\n> `,
    'tab-2': `Windows PowerShell\r\nCopyright (C) Microsoft Corporation. All rights reserved.\r\n\r\nPS D:\\Agent> `
  });
  const [thoughtExpanded, setThoughtExpanded] = useState<boolean>(true);
  const [inputVal, setInputVal] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('Claude 3.7 Sonnet');
  const [executionMode, setExecutionMode] = useState<'agent' | 'raw'>('agent');
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Sync active thread with tabs
  useEffect(() => {
    if (activeThread) {
      setTabs(prev => {
        const exists = prev.find(t => t.id === activeThread.id);
        if (!exists) {
          return [...prev, {
            id: activeThread.id,
            name: activeThread.title,
            sessionId: activeThread.sessionId,
            type: activeThread.type
          }];
        }
        return prev;
      });
      setActiveTabId(activeThread.id);
    }
  }, [activeThread]);

  // Connect WebSocket when tab changes if session exists
  useEffect(() => {
    const curTab = tabs.find(t => t.id === activeTabId);
    if (!curTab?.sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/terminal/${curTab.sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          setOutputLines(prev => ({
            ...prev,
            [activeTabId]: (prev[activeTabId] || '') + msg.data
          }));
        }
      } catch {
        setOutputLines(prev => ({
          ...prev,
          [activeTabId]: (prev[activeTabId] || '') + event.data
        }));
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [activeTabId, tabs]);

  // Auto-scroll
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [outputLines, activeTabId]);

  const handleSpawnNewTab = async (type: string = 'terminal', name?: string) => {
    const newId = `tab-${Date.now()}`;
    const tabName = name || (type === 'claude-code' ? 'Claude Code' : `Terminal #${tabs.length + 1}`);

    try {
      // Spawn real backend session
      const res = await fetch('/api/terminals/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tabName,
          cwd: process.cwd()
        })
      });
      const data = await res.json();
      
      const newTab: TerminalTab = {
        id: newId,
        name: tabName,
        sessionId: data.id,
        type
      };

      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newId);
      setOutputLines(prev => ({
        ...prev,
        [newId]: `\x1b[32m✔ Spawned new session: ${tabName} (PID / Session: ${data.id})\x1b[0m\r\n\r\n`
      }));
    } catch {
      // Offline fallback
      setTabs(prev => [...prev, { id: newId, name: tabName, type }]);
      setActiveTabId(newId);
    }
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter(t => t.id !== id);
    setTabs(nextTabs);
    if (activeTabId === id) {
      setActiveTabId(nextTabs[0].id);
    }
  };

  const handleSendInput = () => {
    if (!inputVal.trim()) return;
    const line = inputVal;
    setInputVal('');

    const curTab = tabs.find(t => t.id === activeTabId);
    if (curTab?.sessionId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: line + '\r\n' }));
    } else {
      // Local simulated response with BridgeMind reasoning
      setOutputLines(prev => ({
        ...prev,
        [activeTabId]: (prev[activeTabId] || '') + line + '\r\n\x1b[36m[Agent]: Processing command with ' + selectedModel + '...\x1b[0m\r\n\x1b[32m✔ Task acknowledged.\x1b[0m\r\n> '
      }));
    }
  };

  const handleInterrupt = () => {
    const curTab = tabs.find(t => t.id === activeTabId);
    if (curTab?.sessionId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: '\x03' }));
    }
    setOutputLines(prev => ({
      ...prev,
      [activeTabId]: (prev[activeTabId] || '') + '^C\r\n> '
    }));
  };

  const currentOutput = outputLines[activeTabId] || '';
  const htmlOutput = ansiUp.ansi_to_html(currentOutput);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0d14] overflow-hidden">
      {/* Top Tab Bar for Concurrent Terminals */}
      <div className="h-10 bg-[#0e131f] border-b border-[#1f293d] flex items-center px-2 space-x-1 overflow-x-auto select-none shrink-0">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group flex items-center space-x-2 px-3 py-1.5 rounded-t-md text-xs font-medium cursor-pointer border-t-2 transition-all ${
                isActive
                  ? 'bg-[#0a0d14] text-cyan-300 border-cyan-500 shadow-sm'
                  : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-[#141a29]'
              }`}
            >
              <TerminalIcon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span className="truncate max-w-[120px]">{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => handleSpawnNewTab('terminal')}
          className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-[#141a29] rounded transition-colors"
          title="Open another terminal"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* BridgeMind Deep Reasoning Thought Card */}
      <div className="px-4 pt-3 pb-1 select-none">
        <div className="bg-[#121826] border border-[#1f293d] rounded-lg p-2.5 text-xs transition-all shadow-sm">
          <div
            onClick={() => setThoughtExpanded(!thoughtExpanded)}
            className="flex items-center justify-between cursor-pointer text-slate-300 hover:text-white"
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="font-semibold text-slate-200">
                Thought for 11s, 495 tokens
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                Active Reasoning
              </span>
            </div>
            {thoughtExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {thoughtExpanded && (
            <div className="mt-2.5 pt-2 border-t border-[#1f293d] text-slate-400 space-y-1.5 font-mono text-[11px] leading-relaxed">
              <p className="text-slate-300">
                1. Inspecting workspace configuration and active terminal processes...
              </p>
              <p className="text-slate-400">
                2. Multi-terminal multiplexer ready: standard shell streaming via WebSockets.
              </p>
              <p className="text-slate-400">
                3. Browser authentication cookies cached for 1-click execution.
              </p>
              <div className="flex items-center space-x-3 text-[10px] text-slate-500 pt-1">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>Latency: 42ms</span>
                </span>
                <span className="flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Safety Guard: Strict</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Terminal Output Pane */}
      <div className="flex-1 p-4 overflow-y-auto terminal-scroll bg-[#0a0d14] text-slate-200 text-xs font-mono leading-relaxed select-text">
        <div
          dangerouslySetInnerHTML={{ __html: htmlOutput }}
          className="whitespace-pre-wrap break-all"
        />
        <div ref={terminalEndRef} />
      </div>

      {/* Bottom Prompt Bar with Model Selector & Execution Controls */}
      <div className="p-3 bg-[#0e131f] border-t border-[#1f293d] select-none shrink-0 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          {/* Model selector dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-500 font-medium">Model:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-[#141a29] border border-[#232f48] rounded px-2 py-0.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 cursor-pointer font-medium"
            >
              <option value="Claude 3.7 Sonnet">Claude 3.7 Sonnet (Hybrid Reasoning)</option>
              <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
              <option value="GPT-4o">OpenAI GPT-4o</option>
              <option value="Gemini 2.5 Pro">Google Gemini 2.5 Pro</option>
              <option value="DeepSeek V3">DeepSeek V3 / R1</option>
              <option value="Ollama Local">Local Ollama (Offline)</option>
            </select>
          </div>

          {/* Mode Switch & Fast Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setExecutionMode(executionMode === 'agent' ? 'raw' : 'agent')}
              className={`px-2 py-0.5 rounded text-[11px] border font-medium transition-all ${
                executionMode === 'agent'
                  ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              Mode: {executionMode === 'agent' ? 'AI Agent' : 'Raw Shell'}
            </button>
            <button
              onClick={handleInterrupt}
              className="px-2 py-0.5 rounded bg-[#1e2738] hover:bg-rose-950 hover:text-rose-400 text-slate-400 text-[11px] border border-[#2b3952] transition-colors"
              title="Send Ctrl+C"
            >
              Ctrl+C
            </button>
            <button
              onClick={() => setOutputLines(prev => ({ ...prev, [activeTabId]: '' }))}
              className="px-2 py-0.5 rounded bg-[#1e2738] hover:bg-[#28354c] text-slate-400 text-[11px] border border-[#2b3952] transition-colors"
              title="Clear Terminal Output"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Prompt Input Box */}
        <div className="flex items-center bg-[#141a29] border border-[#24314c] focus-within:border-cyan-500 rounded-lg px-3 py-1.5 shadow-inner transition-colors">
          <span className="text-cyan-400 font-mono text-sm mr-2 select-none">&gt;</span>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSendInput();
              }
            }}
            placeholder={
              executionMode === 'agent'
                ? "Send prompt to agent (e.g. 'Build a React dashboard', 'Refactor auth', 'Run test suite')..."
                : "Type terminal command (e.g. 'npm test', 'git status', 'cargo build')..."
            }
            className="flex-1 bg-transparent text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none font-mono"
          />
          <button
            onClick={handleSendInput}
            className="ml-2 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center space-x-1 transition-colors shadow-sm"
          >
            <span>Send</span>
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
