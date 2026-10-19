import React, { useState, useEffect } from 'react';
import { StudioHeader } from './components/StudioHeader.js';
import { WorkspaceSidebar, Workspace, AgentThread } from './components/WorkspaceSidebar.js';
import { TerminalStudio } from './components/TerminalStudio.js';
import { BrowserPreview } from './components/BrowserPreview.js';
import { BrowserLoginModal } from './components/BrowserLoginModal.js';
import { NewSessionModal } from './components/NewSessionModal.js';

const DEFAULT_WORKSPACES: Workspace[] = [
  { id: 'ws-bridgemrr', name: 'bridgemrr', rootPath: '', threads: [] },
  {
    id: 'ws-vibecoding',
    name: 'vibecodingsimulator',
    rootPath: '',
    threads: [
      {
        id: 'th-claude-6',
        title: 'Claude Code',
        type: 'claude-code',
        status: 'running',
        unreadCount: 0,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      },
    ],
    activeThreadId: 'th-claude-6',
  },
  { id: 'ws-bridgemind', name: 'bridgemind', rootPath: '', threads: [] },
  { id: 'ws-bridgebench', name: 'bridgebench', rootPath: '', threads: [] },
  { id: 'ws-bridgegame', name: 'bridgegame', rootPath: '', threads: [] },
  { id: 'ws-obs', name: 'obs', rootPath: '', threads: [] },
  { id: 'ws-bridgevideo', name: 'bridgevideo', rootPath: '', threads: [] },
];

export function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-vibecoding');
  const [activeThreadId, setActiveThreadId] = useState<string>('th-claude-6');
  const [activeTab, setActiveTab] = useState<'agent' | 'code' | 'thread'>('code');
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showNewSessionModal, setShowNewSessionModal] = useState<boolean>(false);
  const [authSummary, setAuthSummary] = useState<Record<string, boolean>>({});
  const [newTerminalSignal, setNewTerminalSignal] = useState<number>(0);
  const [launchRequest, setLaunchRequest] = useState<{
    count: number;
    agentType: string;
    sessionNames: string[];
  } | null>(null);
  const [injectedPrompt, setInjectedPrompt] = useState<string>('');

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Merge server workspaces while preserving screenshot defaults
        setWorkspaces(data);
      }
    } catch {}
  };

  const fetchAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (data.auth) {
        setAuthSummary(data.auth);
      }
    } catch {}
  };

  useEffect(() => {
    fetchWorkspaces();
    fetchAuthStatus();
  }, []);

  const handleSelectWorkspace = (wsId: string) => {
    setActiveWorkspaceId(wsId);
    const ws = workspaces.find((w) => w.id === wsId);
    if (ws && ws.threads.length > 0) {
      setActiveThreadId(ws.activeThreadId || ws.threads[0].id);
    }
  };

  const handleSelectThread = async (wsId: string, thId: string) => {
    setActiveWorkspaceId(wsId);
    setActiveThreadId(thId);
    try {
      await fetch(`/api/workspaces/${wsId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: thId }),
      });
      fetchWorkspaces();
    } catch {}
  };

  const handleNewThread = async (wsId: string, type: AgentThread['type'], title: string) => {
    try {
      const res = await fetch(`/api/workspaces/${wsId}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title }),
      });
      const newThread = await res.json();
      await fetchWorkspaces();
      setActiveThreadId(newThread.id);
    } catch {}
  };

  const handleDeleteThread = async (wsId: string, thId: string) => {
    try {
      await fetch(`/api/workspaces/${wsId}/threads/${thId}`, {
        method: 'DELETE',
      });
      await fetchWorkspaces();
    } catch {}
  };

  const handleNewWorkspace = async () => {
    let rootPath: string | null = null;
    if (window.bridgemind?.pickFolder) {
      rootPath = await window.bridgemind.pickFolder();
    } else {
      rootPath = window.prompt('Project folder path for the new workspace:');
    }
    if (!rootPath) return;
    const name = rootPath.split(/[\\/]/).filter(Boolean).pop() || rootPath;
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rootPath }),
      });
      const ws = await res.json();
      await fetchWorkspaces();
      if (ws?.id) {
        setActiveWorkspaceId(ws.id);
      }
    } catch {}
  };

  const handleLaunchSessionsFromModal = (
    count: number,
    agentType: string,
    sessionNames: string[]
  ) => {
    setLaunchRequest({ count, agentType, sessionNames });
  };

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[1] || workspaces[0];
  const activeThread = activeWorkspace?.threads.find((t) => t.id === activeThreadId);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070a10] text-slate-100">
      {/* Top Studio Header with RakkyXD branding */}
      <StudioHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLogin={() => setShowLoginModal(true)}
        onNewTerminal={() => setNewTerminalSignal((n) => n + 1)}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        authSummary={authSummary}
      />

      {/* Main 3-Column Cockpit Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Workspaces Tree & Bomb Countdown Widget */}
        <WorkspaceSidebar
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          activeThreadId={activeThreadId}
          onSelectWorkspace={handleSelectWorkspace}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
          onDeleteThread={handleDeleteThread}
          onOpenLogin={() => setShowLoginModal(true)}
          onNewWorkspace={handleNewWorkspace}
        />

        {/* Center Column: 2x3 Terminal Cockpit Grid with Voice Control */}
        <TerminalStudio
          activeThread={activeThread}
          currentWorkspaceId={activeWorkspaceId}
          workspaceName={activeWorkspace?.name || 'vibecodingsimulator'}
          newTerminalSignal={newTerminalSignal}
          onOpenNewSessionModal={() => setShowNewSessionModal(true)}
          externalLaunchRequest={launchRequest}
          injectedPrompt={injectedPrompt}
          onPromptConsumed={() => setInjectedPrompt('')}
        />

        {/* Right Column: Live Webview & Companion Tabs Preview */}
        {showPreview && (
          <BrowserPreview
            onClose={() => setShowPreview(false)}
            onSelectPrompt={(text) => setInjectedPrompt(text)}
          />
        )}
      </div>

      {/* 1-Click Browser Authentication Modal */}
      <BrowserLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onAuthUpdated={fetchAuthStatus}
      />

      {/* New Session Config & Launcher Modal (Matching Screenshot 1) */}
      <NewSessionModal
        isOpen={showNewSessionModal}
        workspaceName={activeWorkspace?.name || 'vibecodingsimulator'}
        onClose={() => setShowNewSessionModal(false)}
        onLaunchSessions={handleLaunchSessionsFromModal}
      />
    </div>
  );
}
