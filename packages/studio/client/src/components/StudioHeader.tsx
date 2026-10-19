import React from 'react';
import { 
  Bot, 
  Code2, 
  MessageSquare, 
  Globe, 
  Zap, 
  LayoutGrid, 
  Bell, 
  ShieldCheck, 
  Terminal,
  Sparkles
} from 'lucide-react';

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
  authSummary = {},
}) => {
  const loggedInCount = Object.values(authSummary).filter(Boolean).length;
  const isDesktop = Boolean(window.bridgemind?.isDesktop);

  return (
    <header
      className="app-drag h-12 bg-[#0a0d14] border-b border-[#1a2337] flex items-center justify-between px-4 select-none shrink-0"
      style={isDesktop ? { paddingRight: 150 } : undefined}
    >
      {/* Brand: RakkyXD */}
      <div className="flex items-center space-x-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20 font-black text-xs tracking-tighter">
          RX
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="font-bold text-sm tracking-wider text-white">RakkyXD</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono font-semibold">
            STUDIO
          </span>
        </div>
      </div>

      {/* Center Studio Modes: [Agent] [Code] [Thread] (Matching Screenshot 1 & 2) */}
      <div className="flex items-center bg-[#111624] p-0.5 rounded-lg border border-[#1d273b]">
        <button
          onClick={() => setActiveTab('agent')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'agent'
              ? 'bg-[#1e293b] text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161e30]'
          }`}
        >
          <span>Agent</span>
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'code'
              ? 'bg-[#1e293b] text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161e30]'
          }`}
        >
          <span>Code</span>
        </button>

        <button
          onClick={() => setActiveTab('thread')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'thread'
              ? 'bg-[#1e293b] text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161e30]'
          }`}
        >
          <span>Thread</span>
        </button>
      </div>

      {/* Right Controls: Resource Stats, Browser Login, Preview Toggle */}
      <div className="flex items-center space-x-2.5">
        {/* App Launcher Grid Icon */}
        <button
          className="p-1 text-slate-400 hover:text-white hover:bg-[#141a29] rounded"
          title="Apps & MCP"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>

        {/* Resource Badge (Matching * 7d 87% from Screenshot 1 & 2) */}
        <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-[#131929] border border-[#1f283d] text-[11px] text-slate-300 font-mono">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>7d 87%</span>
        </div>

        {/* Browser Login Button */}
        <button
          onClick={onOpenLogin}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#131b2e] hover:bg-[#1a253e] text-cyan-300 border border-cyan-800/40 text-xs font-medium transition-all group"
          title="Browser Session Login (No API Keys)"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>Login</span>
          {loggedInCount > 0 && (
            <span className="flex items-center text-[10px] bg-emerald-950 text-emerald-400 px-1 rounded border border-emerald-800/50">
              <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
              <span>{loggedInCount}</span>
            </span>
          )}
        </button>

        {/* Live Preview Toggle */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${
            showPreview
              ? 'bg-blue-900/40 border-blue-500/50 text-blue-300'
              : 'bg-[#141a29] border-[#1f293d] text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Webview Preview"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Preview</span>
        </button>

        {/* User Avatar Circle */}
        <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px] shadow-sm">
          M
        </div>
      </div>
    </header>
  );
};
