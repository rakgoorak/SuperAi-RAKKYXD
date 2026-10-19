import React, { useState, useEffect } from 'react';
import { StudioHeader } from './components/StudioHeader.js';
import { WorkspaceSidebar, Workspace, AgentThread } from './components/WorkspaceSidebar.js';
import { TerminalStudio } from './components/TerminalStudio.js';
import { BrowserPreview } from './components/BrowserPreview.js';
import { BrowserLoginModal } from './components/BrowserLoginModal.js';

export function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-bridgemind');
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'agent' | 'code' | 'thread'>('agent');
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [authSummary, setAuthSummary] = useState<Record<string, boolean>>({});
  const [newTerminalSignal, setNewTerminalSignal] = useState<number>(0);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setWorkspaces(data);
        if (!activeWorkspaceId || !data.some(w => w.id === activeWorkspaceId)) {
          setActiveWorkspaceId(data[0].id);
        }
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
    const ws = workspaces.find(w => w.id === wsId);
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
        body: JSON.stringify({ threadId: thId })
      });
      fetchWorkspaces();
    } catch {}
  };

  const handleNewThread = async (wsId: string, type: AgentThread['type'], title: string) => {
    try {
      const res = await fetch(`/api/workspaces/${wsId}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title })
      });
      const newThread = await res.json();
      await fetchWorkspaces();
      setActiveThreadId(newThread.id);
    } catch {}
  };

  const handleDeleteThread = async (wsId: string, thId: string) => {
    try {
      await fetch(`/api/workspaces/${wsId}/threads/${thId}`, {
        method: 'DELETE'
      });
      await fetchWorkspaces();
    } catch {}
  };

  const handleSpawnTopTerminal = () => {
    setNewTerminalSignal((n) => n + 1);
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
        body: JSON.stringify({ name, rootPath })
      });
      const ws = await res.json();
      await fetchWorkspaces();
      if (ws?.id) {
        setActiveWorkspaceId(ws.id);
        handleNewThread(ws.id, 'terminal', 'PowerShell');
      }
    } catch {}
  };

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const activeThread = activeWorkspace?.threads.find(t => t.id === activeThreadId);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0d14] text-slate-100">
      {/* Top Studio Header */}
      <StudioHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLogin={() => setShowLoginModal(true)}
        onNewTerminal={handleSpawnTopTerminal}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        authSummary={authSummary}
      />

      {/* Main 3-Column BridgeMind Studio Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Workspaces & Threads Tree */}
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

        {/* Center Column: Terminal & Agent Studio */}
        <TerminalStudio
          activeThread={activeThread}
          currentWorkspaceId={activeWorkspaceId}
          newTerminalSignal={newTerminalSignal}
        />

        {/* Right Column: Live Webview Preview (Collapsible) */}
        {showPreview && (
          <BrowserPreview onClose={() => setShowPreview(false)} />
        )}
      </div>

      {/* 1-Click Browser Authentication Modal */}
      <BrowserLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onAuthUpdated={fetchAuthStatus}
      />
    </div>
  );
}
