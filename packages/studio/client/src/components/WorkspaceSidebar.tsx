import React, { useState } from 'react';
import { 
  FolderGit2, 
  ChevronDown, 
  ChevronRight, 
  Bot, 
  Terminal, 
  Sparkles, 
  Plus, 
  Trash2, 
  Folder,
  Circle
} from 'lucide-react';
import { BombWidget } from './BombWidget.js';

export interface AgentThread {
  id: string;
  title: string;
  type: 'claude-code' | 'codex' | 'antigravity' | 'opencode-multi' | 'terminal';
  status: 'idle' | 'running' | 'completed' | 'failed';
  unreadCount: number;
  sessionId?: string;
  createdAt: number;
  lastActiveAt: number;
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
  onNewWorkspace: () => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  workspaces,
  activeWorkspaceId,
  activeThreadId,
  onSelectWorkspace,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onOpenLogin,
  onNewWorkspace,
}) => {
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({
    'ws-vibecoding': true,
    [activeWorkspaceId]: true,
  });

  const toggleExpand = (wsId: string) => {
    setExpandedWorkspaces((prev) => ({
      ...prev,
      [wsId]: !prev[wsId],
    }));
  };

  return (
    <aside className="w-56 bg-[#0a0d14] border-r border-[#1a2337] flex flex-col h-full select-none shrink-0 text-slate-300">
      {/* Header */}
      <div className="h-10 px-3 border-b border-[#1a2337] flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 tracking-wider">
          Workspaces
        </span>
        <button
          onClick={onNewWorkspace}
          className="text-slate-400 hover:text-cyan-400 p-1 hover:bg-[#141a29] rounded transition-colors"
          title="Add workspace"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Workspaces List matching Screenshots */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {workspaces.map((ws) => {
          const isExpanded = expandedWorkspaces[ws.id] ?? true;
          const isSelected = activeWorkspaceId === ws.id;

          return (
            <div key={ws.id} className="space-y-0.5">
              {/* Workspace item */}
              <div
                onClick={() => {
                  onSelectWorkspace(ws.id);
                  toggleExpand(ws.id);
                }}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-xs font-medium transition-colors ${
                  isSelected
                    ? 'text-white bg-[#141a29]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1422]'
                }`}
              >
                <div className="flex items-center space-x-1.5 truncate">
                  {ws.threads.length > 0 ? (
                    isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )
                  ) : (
                    <span className="w-3.5" />
                  )}
                  <span className="truncate">{ws.name}</span>
                </div>

                {ws.threads.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#1b2336] text-slate-400 font-mono">
                    {ws.threads.length}
                  </span>
                )}
              </div>

              {/* Sub-threads (e.g. Claude Code x6) */}
              {isExpanded && ws.threads.length > 0 && (
                <div className="pl-4 pr-1 py-0.5 space-y-0.5 border-l border-[#1a2337] ml-3">
                  {ws.threads.map((th) => {
                    const isThreadActive = activeWorkspaceId === ws.id && activeThreadId === th.id;
                    return (
                      <div
                        key={th.id}
                        onClick={() => onSelectThread(ws.id, th.id)}
                        className={`group flex items-center justify-between px-2 py-1 rounded-md cursor-pointer text-xs transition-colors ${
                          isThreadActive
                            ? 'bg-[#18233a] text-cyan-300 font-medium'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#121726]'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                          <span className="truncate">{th.title}</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e293b] text-slate-400">
                          6
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bomb Widget at the bottom (Matching Screenshot 1 & 2) */}
      <BombWidget />
    </aside>
  );
};
