import React, { useState } from 'react';
import { 
  X, 
  Folder, 
  Check, 
  Sparkles, 
  Bot, 
  Terminal, 
  Play, 
  Plus, 
  Download, 
  Cpu, 
  Compass, 
  Flame, 
  Layers,
  Circle
} from 'lucide-react';

interface NewSessionModalProps {
  isOpen: boolean;
  workspaceName: string;
  onClose: () => void;
  onLaunchSessions: (count: number, agentType: string, sessionNames: string[]) => void;
}

const DEFAULT_NAMES = ['Emma', 'James', 'Olivia', 'Michael', 'Grace', 'Daniel'];

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  workspaceName = 'vibecodingsimulator',
  onClose,
  onLaunchSessions,
}) => {
  const [selectedAgent, setSelectedAgent] = useState('claude-code');
  const [sessionCount, setSessionCount] = useState(6);
  const [selectedPreset, setSelectedPreset] = useState<'cursor' | 'main' | null>('main');

  if (!isOpen) return null;

  const agents = [
    { id: 'claude-code', name: 'Claude Code', icon: '💥', isPopular: true },
    { id: 'codex', name: 'Codex', icon: '✨' },
    { id: 'cursor', name: 'Cursor Agent', icon: '🎯' },
    { id: 'gemini', name: 'Gemini CLI', icon: '✦' },
    { id: 'droid', name: 'Droid', icon: '🤖' },
    { id: 'opencode', name: 'OpenCode', icon: '📂' },
    { id: 'deepseek', name: 'DeepSeek Harness', icon: '🌊' },
    { id: 'grok', name: 'Grok Build', icon: '⚡' },
    { id: 'kimi', name: 'Kimi Code', icon: '🪐' },
    { id: 'antigravity', name: 'Antigravity', icon: '🔺' },
    { id: 'muse', name: 'Muse Code', icon: '📜' },
    { id: 'terminal', name: 'Terminal', icon: '💻' },
  ];

  const handleSelectPreset = (preset: 'cursor' | 'main') => {
    setSelectedPreset(preset);
    if (preset === 'cursor') {
      setSelectedAgent('cursor');
      setSessionCount(3);
    } else if (preset === 'main') {
      setSelectedAgent('claude-code');
      setSessionCount(6);
    }
  };

  const handleLaunch = () => {
    const names = DEFAULT_NAMES.slice(0, sessionCount);
    onLaunchSessions(sessionCount, selectedAgent, names);
    onClose();
  };

  const currentAgentObj = agents.find((a) => a.id === selectedAgent) || agents[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-2xl bg-[#0f131d] border border-[#232b3d] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="h-12 px-5 border-b border-[#1f2738] flex items-center justify-between bg-[#111724]">
          <div className="flex items-center space-x-2.5 text-xs">
            <Folder className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-200">{workspaceName}</span>
            <span className="text-slate-500 font-normal">New session</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-[#1a2233] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* PRESET SECTION */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">
              PRESET
            </div>
            <div className="grid grid-cols-3 gap-3">
              {/* Preset 1 */}
              <div
                onClick={() => handleSelectPreset('cursor')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedPreset === 'cursor'
                    ? 'bg-[#151c2c] border-cyan-500/80 shadow-[0_0_12px_rgba(0,210,255,0.15)]'
                    : 'bg-[#121622] border-[#202738] hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span className="flex items-center space-x-1">
                    <span>📌 Cursor</span>
                  </span>
                  <span className="text-slate-400 font-mono">3</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Cursor Agent ×3</div>
              </div>

              {/* Preset 2 */}
              <div
                onClick={() => handleSelectPreset('main')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedPreset === 'main'
                    ? 'bg-[#151c2c] border-cyan-500/80 shadow-[0_0_12px_rgba(0,210,255,0.15)]'
                    : 'bg-[#121622] border-[#202738] hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span className="flex items-center space-x-1">
                    <span>📌 Main</span>
                  </span>
                  <span className="text-slate-400 font-mono">6</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Claude Code ×3 · Codex ×3</div>
              </div>

              {/* Preset 3 */}
              <div className="p-3 rounded-xl border border-dashed border-[#263147] hover:border-slate-500 bg-[#121622] text-slate-400 cursor-pointer transition-colors flex flex-col justify-between">
                <div className="text-xs font-medium text-slate-300 flex items-center space-x-1">
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>New preset</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Save this lineup, or build one seat by seat.
                </div>
              </div>
            </div>
          </div>

          {/* AGENT GRID SECTION */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">
              AGENT
            </div>
            <div className="grid grid-cols-3 gap-2">
              {agents.map((agent) => {
                const isSelected = selectedAgent === agent.id;
                return (
                  <div
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgent(agent.id);
                      setSelectedPreset(null);
                    }}
                    className={`px-3 py-2.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-[#182236] border-cyan-500 text-white font-semibold shadow-sm'
                        : 'bg-[#121724] border-[#1f283d] text-slate-300 hover:bg-[#161c2b] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-sm">{agent.icon}</span>
                      <span className="text-xs truncate">{agent.name}</span>
                    </div>
                    {isSelected ? (
                      <div className="w-4 h-4 rounded-full bg-cyan-500 flex items-center justify-center text-black">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Not installed yet row */}
            <div className="mt-3 flex items-center space-x-2 text-[11px] text-slate-400">
              <span>Not installed yet:</span>
              <button className="flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-[10px]">
                <Download className="w-2.5 h-2.5" />
                <span>Install</span>
              </button>
              <button className="flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-[10px]">
                <Download className="w-2.5 h-2.5" />
                <span>Install</span>
              </button>
              <button className="flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-[10px]">
                <Download className="w-2.5 h-2.5" />
                <span>Install</span>
              </button>
            </div>
          </div>

          {/* HOW MANY SECTION */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">
              HOW MANY
            </div>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  onClick={() => setSessionCount(num)}
                  className={`w-9 h-8 rounded-lg font-mono text-xs font-semibold transition-all ${
                    sessionCount === num
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/40 border border-blue-400'
                      : 'bg-[#141a29] text-slate-300 border border-[#222c42] hover:bg-[#1b2336]'
                  }`}
                >
                  {num}
                </button>
              ))}
              <span className="text-xs text-slate-400 ml-2">parallel sessions</span>
            </div>
          </div>

          {/* WILL LAUNCH SECTION */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">
              WILL LAUNCH
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: sessionCount }).map((_, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 rounded-lg bg-[#121622] border border-[#1f283d] flex items-center space-x-2 text-xs"
                >
                  <span className="text-slate-500 font-mono text-[11px]">{idx + 1}</span>
                  <span className="text-xs">{currentAgentObj.icon}</span>
                  <span className="text-slate-200 font-medium truncate">
                    {DEFAULT_NAMES[idx] || `Agent ${idx + 1}`} ({currentAgentObj.name})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="p-4 bg-[#111622] border-t border-[#1f2738] flex items-center justify-between text-xs">
          <span className="text-slate-400">
            {sessionCount} sessions in <span className="text-slate-200 font-semibold">{workspaceName}</span>
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#1a2233] hover:bg-[#232d42] text-slate-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLaunch}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-md shadow-blue-600/30"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Launch {sessionCount} sessions</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
