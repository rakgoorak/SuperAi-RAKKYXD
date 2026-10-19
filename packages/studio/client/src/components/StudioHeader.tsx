import React from 'react';
import { Layers, Bot, Code2, MessageSquare, Globe, Plus, Sparkles, Terminal, ShieldCheck } from 'lucide-react';

interface StudioHeaderProps {
  activeTab: 'agent' | 'code' | 'thread';
  setActiveTab: (tab: 'agent' | 'code' | 'thread') => void;
  onOpenLogin: () => void;
  onNewTerminal: () => void;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  authSummary?: Record<string, boolean>;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenLogin,
  onNewTerminal,
  showPreview,
  setShowPreview,
  authSummary = {}
}) => {
  const loggedInCount = Object.values(authSummary).filter(Boolean).length;

  return (
    <header className="h-12 bg-[#0e131f] border-b border-[#1f293d] flex items-center justify-between px-4 select-none shrink-0">
      {/* Brand & Workspace Name */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20">
          <Layers className="w-4 h-4" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="font-semibold text-sm tracking-wide text-white">BridgeMind</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
            STUDIO
          </span>
        </div>
      </div>

      {/* Center Studio Modes: [Agent] [Code] [Thread] */}
      <div className="flex items-center bg-[#141a29] p-0.5 rounded-lg border border-[#1f293d]">
        <button
          onClick={() => setActiveTab('agent')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'agent'
              ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a2337]'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Agent</span>
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'code'
              ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a2337]'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Code</span>
        </button>

        <button
          onClick={() => setActiveTab('thread')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'thread'
              ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a2337]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Thread</span>
        </button>
      </div>

      {/* Right Controls: Browser Login, New Terminal, Live Preview Toggle */}
      <div className="flex items-center space-x-2">
        {/* Browser Login Button */}
        <button
          onClick={onOpenLogin}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#162033] hover:bg-[#1c2a44] text-cyan-300 border border-cyan-800/40 text-xs font-medium transition-all group"
          title="Log in via browser without API keys"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-12 transition-transform" />
          <span>Browser Login</span>
          {loggedInCount > 0 ? (
            <span className="flex items-center space-x-1 text-[10px] bg-emerald-950 text-emerald-400 px-1 rounded border border-emerald-800/50">
              <ShieldCheck className="w-2.5 h-2.5" />
              <span>{loggedInCount}</span>
            </span>
          ) : (
            <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1 rounded border border-amber-800/40">
              1-Click
            </span>
          )}
        </button>

        {/* Spawn New Terminal */}
        <button
          onClick={onNewTerminal}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-[#1a2235] hover:bg-[#232e47] text-slate-200 border border-[#2a3854] text-xs font-medium transition-all"
          title="Open new terminal session"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400" />
          <Terminal className="w-3.5 h-3.5" />
          <span>Terminal</span>
        </button>

        {/* Live Preview Toggle */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${
            showPreview
              ? 'bg-blue-900/40 border-blue-500/50 text-blue-300'
              : 'bg-[#141a29] border-[#1f293d] text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle live browser preview panel"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Preview</span>
        </button>
      </div>
    </header>
  );
};
