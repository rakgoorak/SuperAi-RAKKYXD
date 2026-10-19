import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { Workspace, AgentThread } from './types.js';

export class WorkspaceRegistry {
  private storagePath: string;
  private workspaces: Map<string, Workspace> = new Map();

  constructor(customPath?: string) {
    if (customPath) {
      this.storagePath = customPath;
    } else {
      const configDir = path.join(os.homedir(), '.opencode-multi');
      if (!fs.existsSync(configDir)) {
        try {
          fs.mkdirSync(configDir, { recursive: true });
        } catch {}
      }
      this.storagePath = path.join(configDir, 'studio-workspaces.json');
    }

    this.load();
    if (this.workspaces.size === 0) {
      this.initDefaults();
    }
  }

  private initDefaults(): void {
    const cwd = process.cwd();
    const defaultWorkspaces: Workspace[] = [
      {
        id: 'ws-bridgemind',
        name: 'bridgemind',
        rootPath: cwd,
        threads: [
          {
            id: 'th-1',
            title: 'Claude Code',
            type: 'claude-code',
            status: 'running',
            unreadCount: 3,
            createdAt: Date.now() - 3600000,
            lastActiveAt: Date.now(),
            thoughts: [
              {
                id: 't-1',
                duration: '11s',
                tokens: 495,
                preview: 'Thinking Process: 1. Analyze the project layout 2. Configure multi-agent threads'
              }
            ]
          },
          {
            id: 'th-2',
            title: 'Codex Agent',
            type: 'codex',
            status: 'idle',
            unreadCount: 0,
            createdAt: Date.now() - 7200000,
            lastActiveAt: Date.now() - 1800000
          },
          {
            id: 'th-3',
            title: 'Antigravity Studio',
            type: 'antigravity',
            status: 'running',
            unreadCount: 1,
            createdAt: Date.now() - 10800000,
            lastActiveAt: Date.now()
          },
          {
            id: 'th-4',
            title: 'OpenCode Multi-Agent',
            type: 'opencode-multi',
            status: 'idle',
            unreadCount: 0,
            createdAt: Date.now() - 14400000,
            lastActiveAt: Date.now() - 3600000
          }
        ],
        activeThreadId: 'th-1'
      },
      {
        id: 'ws-bridgebench',
        name: 'bridgebench',
        rootPath: cwd,
        threads: [
          {
            id: 'th-bb-1',
            title: 'Benchmark Runner',
            type: 'terminal',
            status: 'idle',
            unreadCount: 0,
            createdAt: Date.now(),
            lastActiveAt: Date.now()
          }
        ],
        activeThreadId: 'th-bb-1'
      },
      {
        id: 'ws-gemini-4',
        name: 'gemini-4',
        rootPath: cwd,
        threads: [
          {
            id: 'th-g4-1',
            title: 'Gemini Research Agent',
            type: 'opencode-multi',
            status: 'idle',
            unreadCount: 0,
            createdAt: Date.now(),
            lastActiveAt: Date.now()
          }
        ],
        activeThreadId: 'th-g4-1'
      }
    ];

    for (const ws of defaultWorkspaces) {
      this.workspaces.set(ws.id, ws);
    }
    this.save();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        const list: Workspace[] = JSON.parse(data);
        for (const ws of list) {
          this.workspaces.set(ws.id, ws);
        }
      }
    } catch {
      // fallback to in-memory if invalid
    }
  }

  private save(): void {
    try {
      const list = Array.from(this.workspaces.values());
      const tempPath = `${this.storagePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(list, null, 2), 'utf8');
      fs.renameSync(tempPath, this.storagePath);
    } catch {}
  }

  public getWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  public getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  public createWorkspace(name: string, rootPath: string): Workspace {
    const ws: Workspace = {
      id: `ws-${Date.now()}-${randomUUID().slice(0, 4)}`,
      name,
      rootPath,
      threads: []
    };
    this.workspaces.set(ws.id, ws);
    this.save();
    return ws;
  }

  public addThread(workspaceId: string, threadData: Partial<AgentThread>): AgentThread {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const thread: AgentThread = {
      id: `th-${Date.now()}-${randomUUID().slice(0, 4)}`,
      title: threadData.title || 'New Thread',
      type: threadData.type || 'terminal',
      status: threadData.status || 'idle',
      unreadCount: 0,
      sessionId: threadData.sessionId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      thoughts: threadData.thoughts || []
    };

    ws.threads.push(thread);
    if (!ws.activeThreadId) {
      ws.activeThreadId = thread.id;
    }
    this.save();
    return thread;
  }

  public updateThread(workspaceId: string, threadId: string, updates: Partial<AgentThread>): AgentThread | undefined {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return undefined;

    const thread = ws.threads.find(t => t.id === threadId);
    if (!thread) return undefined;

    Object.assign(thread, updates, { lastActiveAt: Date.now() });
    this.save();
    return thread;
  }

  public setActiveThread(workspaceId: string, threadId: string): void {
    const ws = this.workspaces.get(workspaceId);
    if (ws && ws.threads.some(t => t.id === threadId)) {
      ws.activeThreadId = threadId;
      // Clear unread count when activated
      const th = ws.threads.find(t => t.id === threadId);
      if (th) th.unreadCount = 0;
      this.save();
    }
  }

  public deleteThread(workspaceId: string, threadId: string): boolean {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return false;

    const index = ws.threads.findIndex(t => t.id === threadId);
    if (index === -1) return false;

    ws.threads.splice(index, 1);
    if (ws.activeThreadId === threadId) {
      ws.activeThreadId = ws.threads[0]?.id;
    }
    this.save();
    return true;
  }
}
