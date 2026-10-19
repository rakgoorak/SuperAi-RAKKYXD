import React, { useState } from 'react';
import { 
  FolderGit2, 
  ChevronDown, 
  ChevronRight, 
  MessageSquare, 
  Bot, 
  Terminal, 
  Sparkles, 
  Plus, 
  Trash2, 
  DollarSign, 
  KeyRound, 
  Cpu,
  Circle
} from 'lucide-react';

export interface AgentThread {
  id: string;
  title: string;
  type: 'claude-code' | 'codex' | 'antigravity' | 'opencode-multi' | 'terminal';
  status: 'idle' | 'running' | 'completed' | 'failed';
  unreadCount: number;
  sessionId?: string;
  createdAt: number;
  lastActiveAt: number;
  thoughts?: Array<{
    id: string;
    duration: string;
    tokens: number;
    preview: string;
  }>;
}

export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  threads: AgentThread[];
  activeThreadId?: string;
}

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeThreadId?: string;
  onSelectWorkspace: (wsId: string) => void;
  onSelectThread: (wsId: string, thId: string) => void;
  onNewThread: (wsId: string, type: AgentThread['type'], title: string) => void;
  onDeleteThread: (wsId: string, thId: string) => void;
  onOpenLogin: () => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  workspaces,
  activeWorkspaceId,
  activeThreadId,
  onSelectWorkspace,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onOpenLogin
}) => {
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({
    [activeWorkspaceId]: true
  });
  const [showThreadMenu, setShowThreadMenu] = useState(false);

  const toggleExpand = (wsId: string) => {
    setExpandedWorkspaces(prev => ({
      ...prev,
      [wsId]: !prev[wsId]
    }));
  };

  const getThreadIcon = (type: AgentThread['type']) => {
    switch (type) {
      case 'claude-code':
        return <Bot className="w-3.5 h-3.5 text-cyan-400" />;
      case 'codex':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case 'antigravity':
        return <Cpu className="w-3.5 h-3.5 text-indigo-400" />;
      case 'opencode-multi':
        return <Bot className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <aside className="w-64 bg-[#0e131f] border-r border-[#1f293d] flex flex-col h-full select-none shrink-0 text-slate-300">
      {/* Header / Workspace label */}
      <div className="p-3 border-b border-[#1f293d] flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
          Workspaces
        </span>
        <button
          onClick={() => {
            const name = prompt('Enter new workspace name:');
            if (name) {
              // Add workspace logic handled by parent or default
            }
          }}
          className="text-slate-400 hover:text-cyan-400 p-1 hover:bg-[#1a2337] rounded"
          title="Add Workspace"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Workspaces & Threads Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {workspaces.map((ws) => {
          const isExpanded = expandedWorkspaces[ws.id] ?? true;
          const isSelected = activeWorkspaceId === ws.id;

          return (
            <div key={ws.id} className="space-y-0.5">
              {/* Workspace Item */}
              <div
                onClick={() => {
                  onSelectWorkspace(ws.id);
                  toggleExpand(ws.id);
                }}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-xs font-medium transition-colors ${
                  isSelected
                    ? 'text-white bg-[#162033]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#131929]'
                }`}
              >
                <div className="flex items-center space-x-1.5 truncate">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                  <FolderGit2 className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-500'} shrink-0`} />
                  <span className="truncate">{ws.name}</span>
                </div>
                <span className="text-[10px] px-1 py-0.2 rounded bg-[#1e293b] text-slate-400">
                  {ws.threads.length}
                </span>
              </div>

              {/* Threads list under this workspace */}
              {isExpanded && (
                <div className="pl-4 pr-1 py-0.5 space-y-0.5 border-l border-[#1f293d] ml-3">
                  {ws.threads.map((th) => {
                    const isThreadActive = activeWorkspaceId === ws.id && activeThreadId === th.id;

                    return (
                      <div
                        key={th.id}
                        onClick={() => onSelectThread(ws.id, th.id)}
                        className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
                          isThreadActive
                            ? 'bg-cyan-950/60 text-cyan-300 font-medium border border-cyan-800/50'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#141a29]'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          {getThreadIcon(th.type)}
                          <span className="truncate">{th.title}</span>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {th.status === 'running' && (
                            <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400 animate-pulse" />
                          )}
                          {th.unreadCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-600 text-white">
                              {th.unreadCount}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteThread(ws.id, th.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400 transition-opacity"
                            title="Delete thread"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Thread Button */}
                  <div className="pt-1 relative">
                    <button
                      onClick={() => setShowThreadMenu(!showThreadMenu)}
                      className="w-full flex items-center justify-center space-x-1 py-1 rounded text-[11px] text-cyan-400 hover:bg-[#141c2e] border border-dashed border-[#1f293d] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Thread</span>
                    </button>

                    {showThreadMenu && (
                      <div className="absolute left-0 bottom-8 z-30 w-48 bg-[#141a29] border border-[#27354f] rounded-lg shadow-xl p-1 text-xs space-y-0.5">
                        <button
                          onClick={() => {
                            onNewThread(ws.id, 'claude-code', 'Claude Code');
                            setShowThreadMenu(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1f293d] flex items-center space-x-2"
                        >
                          <Bot className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Claude Code</span>
                        </button>
                        <button
                          onClick={() => {
                            onNewThread(ws.id, 'codex', 'Codex Agent');
                            setShowThreadMenu(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1f293d] flex items-center space-x-2"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>Codex Agent</span>
                        </button>
                        <button
                          onClick={() => {
                            onNewThread(ws.id, 'opencode-multi', 'Multi-Agent Team');
                            setShowThreadMenu(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1f293d] flex items-center space-x-2"
                        >
                          <Bot className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Multi-Agent Team</span>
                        </button>
                        <button
                          onClick={() => {
                            onNewThread(ws.id, 'terminal', 'Terminal Session');
                            setShowThreadMenu(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-[#1f293d] flex items-center space-x-2"
                        >
                          <Terminal className="w-3.5 h-3.5 text-slate-400" />
                          <span>PowerShell / Bash</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Profile / Credits / 1-Click Browser Login Badge */}
      <div className="p-3 border-t border-[#1f293d] bg-[#0c101a] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Credits left:</span>
          </div>
          <span className="font-semibold text-emerald-400">$5.00</span>
        </div>

        <button
          onClick={onOpenLogin}
          className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-md bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/40 hover:to-blue-600/40 border border-cyan-700/50 text-cyan-300 text-xs font-medium transition-all shadow-sm"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Browser Login (No API Keys)</span>
        </button>
      </div>
    </aside>
  );
};
