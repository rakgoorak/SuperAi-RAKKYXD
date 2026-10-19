import React, { useState } from 'react';
import { 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  ExternalLink, 
  Plus, 
  X, 
  LayoutDashboard, 
  CheckSquare, 
  MessageSquareQuote,
  Music,
  CheckCircle2,
  Circle,
  Sparkles,
  Bot,
  Zap,
  Play,
  Pause,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { sound } from '../utils/sound.js';

interface BrowserPreviewProps {
  onClose: () => void;
  onSelectPrompt?: (prompt: string) => void;
}

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  icon?: string;
}

interface TaskItem {
  id: string;
  agent: string;
  title: string;
  done: boolean;
  tag: string;
}

const INITIAL_TASKS: TaskItem[] = [
  { id: '1', agent: 'Emma', title: 'Refactor Blue light material shader', done: true, tag: 'Shader' },
  { id: '2', agent: 'James', title: 'Implement rotating file logger utility', done: true, tag: 'Core' },
  { id: '3', agent: 'Olivia', title: 'Refactor InventoryBar UI component', done: false, tag: 'UI' },
  { id: '4', agent: 'Michael', title: 'Profile memory usage and cache sync', done: false, tag: 'Perf' },
  { id: '5', agent: 'Grace', title: 'Fix strict TypeScript typecheck errors', done: true, tag: 'Types' },
  { id: '6', agent: 'Daniel', title: 'End-to-end multi-agent test coverage', done: false, tag: 'Test' },
];

const PROMPT_CATEGORIES = [
  {
    category: '⚡ Vibe Coding Prompts',
    items: [
      { text: 'refactor Blue light.mat', agent: 'Emma', desc: 'Shader material update' },
      { text: 'how do I log an error?', agent: 'James', desc: 'Architecture query' },
      { text: 'refactor InventoryBar.cs', agent: 'Olivia', desc: 'UI bar improvement' },
      { text: 'how does Inventory.cs work?', agent: 'Michael', desc: 'Codebase understanding' },
    ],
  },
  {
    category: '🛠️ Code Quality & Tests',
    items: [
      { text: 'fix typecheck errors', agent: 'Grace', desc: 'Resolve strict TS/compiler errors' },
      { text: 'create a util logging.py that rotates', agent: 'Daniel', desc: 'Python logger module' },
      { text: 'run all tests and fix failing cases', agent: 'All', desc: 'Complete test suite run' },
    ],
  },
  {
    category: '🔒 Security & Reverse-Skill',
    items: [
      { text: 'audit code for OWASP top vulnerabilities', agent: 'All', desc: 'Security code audit' },
      { text: 'analyze session cookie storage and CSRF', agent: 'Security', desc: 'Auth verification' },
      { text: 'generate architecture diagram of this repo', agent: 'Diagram', desc: 'Mermaid flowchart' },
    ],
  },
];

export const BrowserPreview: React.FC<BrowserPreviewProps> = ({ onClose, onSelectPrompt }) => {
  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: 'tab-dash', title: 'Dashboard', url: 'app://dashboard' },
    { id: 'tab-tasks', title: 'Tasks', url: 'app://tasks' },
    { id: 'tab-prompts', title: 'Prompts', url: 'app://prompts' },
    {
      id: 'tab-yt',
      title: 'TRON LEGACY Daft P...',
      url: 'https://youtube.com/watch',
      icon: '🔴',
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-tasks');
  const [urlInput, setUrlInput] = useState('app://tasks');
  const [isLoading, setIsLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let target = urlInput.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('app://')) {
      target = 'http://' + target;
    }
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, url: target } : t))
    );
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 400);
  };

  const handleRefresh = () => {
    sound.playBlip(750, 0.03);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 400);
  };

  const handleSelectTab = (tab: BrowserTab) => {
    sound.playBlip(550, 0.03);
    setActiveTabId(tab.id);
    setUrlInput(tab.url);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const next = tabs.filter((t) => t.id !== tabId);
    setTabs(next);
    if (activeTabId === tabId) {
      setActiveTabId(next[0].id);
      setUrlInput(next[0].url);
    }
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextDone = !t.done;
          if (nextDone) sound.playTaskComplete();
          else sound.playBlip(400, 0.03);
          return { ...t, done: nextDone };
        }
        return t;
      })
    );
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    const newItem: TaskItem = {
      id: String(Date.now()),
      agent: 'Active',
      title: newTaskInput.trim(),
      done: false,
      tag: 'Custom',
    };
    setTasks((prev) => [...prev, newItem]);
    setNewTaskInput('');
    sound.playBlip(800, 0.05);
  };

  const handlePickPrompt = (text: string) => {
    sound.playBlip(680, 0.04);
    if (onSelectPrompt) {
      onSelectPrompt(text);
    }
  };

  const completedCount = tasks.filter((t) => t.done).length;

  return (
    <aside className="w-[450px] lg:w-[500px] bg-[#0c0f18] border-l border-[#1a2337] flex flex-col h-full select-none shrink-0 transition-all">
      {/* Tab Navigation Header (Dashboard, Tasks, Prompts, Video) */}
      <div className="h-9 px-2 bg-[#090c14] border-b border-[#1a2337] flex items-center space-x-1 overflow-x-auto text-xs shrink-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => handleSelectTab(tab)}
              className={`group flex items-center space-x-1.5 px-2.5 py-1 rounded-t-md font-medium cursor-pointer transition-all border-t-2 ${
                isActive
                  ? 'bg-[#111726] text-cyan-300 border-cyan-500 font-semibold'
                  : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-[#111624]'
              }`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span className="truncate max-w-[120px]">{tab.title}</span>
              {tab.id === 'tab-tasks' && (
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-blue-900/60 text-blue-300 font-mono">
                  {completedCount}/{tasks.length}
                </span>
              )}
              {tabs.length > 1 && tab.id !== 'tab-tasks' && tab.id !== 'tab-dash' && (
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded ml-1"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => {
            const newId = `tab-${Date.now()}`;
            setTabs((prev) => [
              ...prev,
              { id: newId, title: 'Webview', url: 'http://localhost:5173' },
            ]);
            setActiveTabId(newId);
            setUrlInput('http://localhost:5173');
          }}
          className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-[#141a29] rounded"
          title="New Localhost / URL Tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1" />

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-[#141a29] rounded"
          title="Close Companion Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Address & Navigation Bar */}
      <div className="p-2 border-b border-[#1a2337] bg-[#0c101a] flex items-center space-x-1.5 text-xs shrink-0">
        <button
          onClick={handleRefresh}
          className={`p-1 text-slate-400 hover:text-cyan-400 hover:bg-[#141a29] rounded ${
            isLoading ? 'animate-spin text-cyan-400' : ''
          }`}
          title="Refresh view"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <form onSubmit={handleNavigate} className="flex-1 flex items-center">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-[#121726] border border-[#202a40] focus:border-cyan-500 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
            placeholder="app://tasks or http://localhost:5173..."
          />
        </form>

        <a
          href={activeTab.url.startsWith('http') ? activeTab.url : 'http://localhost:3888'}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-[#141a29] rounded"
          title="Open in default browser"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Tab Views Content */}
      <div className="flex-1 bg-[#070a12] overflow-y-auto">
        {/* 1. Dashboard View */}
        {activeTabId === 'tab-dash' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                <LayoutDashboard className="w-3.5 h-3.5 text-cyan-400" />
                <span>Multi-Agent Cockpit Health</span>
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                ● 6 Seats Active
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-[#0f1422] border border-[#1d273d]">
                <div className="text-[10px] text-slate-400">ENGINE MODEL</div>
                <div className="text-cyan-400 font-bold font-mono mt-1">Claude 3.5 Sonnet / Opus</div>
                <div className="text-[10px] text-slate-500 mt-1">v2.1.303 CLI PTY</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0f1422] border border-[#1d273d]">
                <div className="text-[10px] text-slate-400">VOICE CONTROL</div>
                <div className="text-emerald-400 font-bold font-mono mt-1">Dual 🇹🇭 TH / 🇺🇸 EN</div>
                <div className="text-[10px] text-slate-500 mt-1">Web Speech Synthesis</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0f1422] border border-[#1d273d] space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                ACTIVE AGENT SPRINT SEATS
              </div>
              <div className="space-y-1.5">
                {[
                  { name: 'Emma', role: 'Architect & Lead', color: 'text-orange-400' },
                  { name: 'James', role: 'Backend & Systems', color: 'text-cyan-400' },
                  { name: 'Olivia', role: 'Frontend & UI', color: 'text-purple-400' },
                  { name: 'Michael', role: 'Database & Sync', color: 'text-emerald-400' },
                  { name: 'Grace', role: 'Typecheck & Security', color: 'text-rose-400' },
                  { name: 'Daniel', role: 'Testing & Release', color: 'text-yellow-400' },
                ].map((ag) => (
                  <div
                    key={ag.name}
                    className="flex items-center justify-between p-1.5 rounded bg-[#131929] text-[11px]"
                  >
                    <span className={`font-semibold ${ag.color}`}>@{ag.name}</span>
                    <span className="text-slate-400">{ag.role}</span>
                    <span className="text-[10px] font-mono text-emerald-400">RUNNING</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. Tasks View (Real-time Checklist) */}
        {activeTabId === 'tab-tasks' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sprint Task Orchestrator</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {completedCount} of {tasks.length} done
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-[#141b2c] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                style={{ width: `${(completedCount / Math.max(1, tasks.length)) * 100}%` }}
              />
            </div>

            {/* Add Task Form */}
            <form onSubmit={addTask} className="flex items-center space-x-1.5 pt-1">
              <input
                type="text"
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                placeholder="+ Add task for agents..."
                className="flex-1 bg-[#101626] border border-[#1e2a42] focus:border-cyan-500 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
              >
                Add
              </button>
            </form>

            {/* Task list items */}
            <div className="space-y-1.5 pt-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    task.done
                      ? 'bg-[#0d121e]/60 border-[#172033] text-slate-500 line-through'
                      : 'bg-[#111728] border-[#1e2b45] text-slate-200 hover:border-cyan-600/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    {task.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span className="text-xs truncate font-medium">{task.title}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0 pl-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#172036] text-cyan-300 font-mono font-medium">
                      @{task.agent}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1c2740] text-slate-400 font-mono">
                      {task.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Prompts Library View (1-Click Prompt Library) */}
        {activeTabId === 'tab-prompts' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                <MessageSquareQuote className="w-3.5 h-3.5 text-cyan-400" />
                <span>BridgeMind Prompts Library</span>
              </h3>
              <span className="text-[10px] text-cyan-400 font-mono">Click to inject</span>
            </div>

            {PROMPT_CATEGORIES.map((cat) => (
              <div key={cat.category} className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {cat.category}
                </div>
                <div className="space-y-1.5">
                  {cat.items.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handlePickPrompt(item.text)}
                      className="p-2 rounded-lg bg-[#111728] hover:bg-[#18223b] border border-[#1d2944] hover:border-cyan-500/80 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-mono text-cyan-300 font-medium group-hover:text-white truncate">
                          "{item.text}"
                        </div>
                        <div className="text-[10px] text-slate-500">{item.desc}</div>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a233b] text-slate-400 shrink-0">
                        @{item.agent}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 4. Music & Synthwave Stream View (TRON Daft Punk) */}
        {activeTabId === 'tab-yt' && (
          <div className="flex-1 flex flex-col bg-[#05070d] text-slate-300">
            <div className="w-full aspect-video bg-black flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent z-10" />
              <img
                src="https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80"
                alt="Tron Synthwave"
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute z-20 flex flex-col items-center justify-center space-y-2">
                <button
                  onClick={() => {
                    setIsPlayingMusic(!isPlayingMusic);
                    sound.playExecute();
                  }}
                  className="w-14 h-14 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black flex items-center justify-center shadow-lg shadow-cyan-500/50 cursor-pointer transition-transform hover:scale-110"
                >
                  {isPlayingMusic ? (
                    <Pause className="w-6 h-6 fill-black" />
                  ) : (
                    <Play className="w-6 h-6 ml-0.5 fill-black" />
                  )}
                </button>
                <span className="text-xs font-mono font-bold text-white bg-black/70 px-2 py-0.5 rounded border border-cyan-800/40">
                  {isPlayingMusic ? 'Now Playing Synthwave Stream' : 'TRON LEGACY Daft Punk (Slowed)'}
                </span>
              </div>
            </div>

            <div className="p-3 space-y-2 bg-[#0c101a] border-b border-[#1a2337]">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-semibold text-white">TRON LEGACY Daft Punk End Of Line Slowed</h4>
                  <p className="text-[11px] text-slate-400">2.4M views · Vibe Coding Audio</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-mono">
                  LIVE STREAM
                </span>
              </div>
              <div className="pt-2 border-t border-[#1a2337] flex items-center justify-between text-[11px] text-slate-400">
                <span className="text-cyan-400 font-mono">⚡ RakkyXD Ambient</span>
                <span>relax & vibe code with 6 parallel agents</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. Generic Localhost / Webview */}
        {!['tab-dash', 'tab-tasks', 'tab-prompts', 'tab-yt'].includes(activeTabId) && (
          <iframe
            src={activeTab.url}
            className="w-full h-full border-0 bg-white"
            title="Browser Webview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </aside>
  );
};
