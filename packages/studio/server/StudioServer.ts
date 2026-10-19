import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { TerminalSessionManager } from './TerminalSessionManager.js';
import { WorkspaceRegistry } from './WorkspaceRegistry.js';
import { BrowserLoginManager, loadStoredAuth } from '@opencode-multi/core';

export class StudioServer {
  private app: Express;
  private server: http.Server;
  private wss: WebSocketServer;
  private terminalManager: TerminalSessionManager;
  private workspaceRegistry: WorkspaceRegistry;
  private port: number = 3888;

  constructor(options?: { port?: number; customWorkspacePath?: string }) {
    if (options?.port) this.port = options.port;
    this.terminalManager = new TerminalSessionManager();
    this.workspaceRegistry = new WorkspaceRegistry(options?.customWorkspacePath);

    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());

    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupRoutes();
    this.setupWebSockets();
  }

  private setupRoutes(): void {
    // Health / info
    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', time: Date.now() });
    });

    // Workspaces
    this.app.get('/api/workspaces', (_req: Request, res: Response) => {
      res.json(this.workspaceRegistry.getWorkspaces());
    });

    this.app.post('/api/workspaces', (req: Request, res: Response) => {
      const { name, rootPath } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });
      const ws = this.workspaceRegistry.createWorkspace(name, rootPath || process.cwd());
      res.json(ws);
    });

    this.app.post('/api/workspaces/:wsId/threads', (req: Request, res: Response) => {
      const { wsId } = req.params;
      try {
        const thread = this.workspaceRegistry.addThread(wsId, req.body);
        res.json(thread);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    this.app.patch('/api/workspaces/:wsId/threads/:thId', (req: Request, res: Response) => {
      const { wsId, thId } = req.params;
      const updated = this.workspaceRegistry.updateThread(wsId, thId, req.body);
      if (!updated) return res.status(404).json({ error: 'Thread not found' });
      res.json(updated);
    });

    this.app.post('/api/workspaces/:wsId/select', (req: Request, res: Response) => {
      const { wsId } = req.params;
      const { threadId } = req.body;
      this.workspaceRegistry.setActiveThread(wsId, threadId);
      res.json({ success: true, activeThreadId: threadId });
    });

    this.app.delete('/api/workspaces/:wsId/threads/:thId', (req: Request, res: Response) => {
      const { wsId, thId } = req.params;
      const ok = this.workspaceRegistry.deleteThread(wsId, thId);
      res.json({ success: ok });
    });

    // Terminals
    this.app.get('/api/terminals', (_req: Request, res: Response) => {
      res.json(this.terminalManager.listSessions());
    });

    this.app.post('/api/terminals/spawn', (req: Request, res: Response) => {
      const { command, args, cwd, name, threadId, wsId } = req.body;
      const session = this.terminalManager.spawnSession({
        name,
        command,
        args,
        cwd
      });

      // Link to thread if provided
      if (wsId && threadId) {
        this.workspaceRegistry.updateThread(wsId, threadId, {
          sessionId: session.id,
          status: 'running'
        });
      }

      res.json({
        id: session.id,
        name: session.name,
        command: session.command,
        cwd: session.cwd,
        status: session.status
      });
    });

    this.app.post('/api/terminals/:id/kill', (req: Request, res: Response) => {
      const { id } = req.params;
      const killed = this.terminalManager.killSession(id);
      res.json({ success: killed });
    });

    this.app.post('/api/terminals/:id/input', (req: Request, res: Response) => {
      const { id } = req.params;
      const { input } = req.body;
      const ok = this.terminalManager.writeInput(id, input || '');
      res.json({ success: ok });
    });

    // Auth & Browser Login
    this.app.get('/api/auth/status', (_req: Request, res: Response) => {
      const auth = loadStoredAuth();
      const summary: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(auth)) {
        summary[k] = Boolean(v && v.length > 5);
      }
      res.json({ auth: summary });
    });

    this.app.post('/api/auth/browser-login', async (req: Request, res: Response) => {
      const { service } = req.body;
      if (!service) {
        return res.status(400).json({ error: 'Service is required (chatgpt, claude, gemini, deepseek)' });
      }

      try {
        const loginManager = new BrowserLoginManager();
        const token = await loginManager.login(service);
        res.json({ success: true, service, token: token.slice(0, 10) + '...' });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Serve static client if dist folder exists
    const clientDist = path.join(process.cwd(), 'packages', 'studio', 'client', 'dist');
    if (fs.existsSync(clientDist)) {
      this.app.use(express.static(clientDist));
      this.app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(clientDist, 'index.html'));
      });
    }
  }

  private setupWebSockets(): void {
    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      const url = new URL(req.url || '/', `http://localhost:${this.port}`);
      const pathname = url.pathname;

      if (pathname.startsWith('/ws/terminal/')) {
        const sessionId = pathname.replace('/ws/terminal/', '');
        const session = this.terminalManager.getSession(sessionId);

        if (!session) {
          ws.send(JSON.stringify({ type: 'error', message: `Terminal session ${sessionId} not found` }));
          ws.close();
          return;
        }

        // Subscribe to terminal output
        const unsubscribe = this.terminalManager.subscribe(sessionId, (chunk: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: chunk }));
          }
        });

        // Handle user keyboard input
        ws.on('message', (message: string) => {
          try {
            const data = JSON.parse(message.toString());
            if (data.type === 'input' && typeof data.data === 'string') {
              this.terminalManager.writeInput(sessionId, data.data);
            }
          } catch {
            // raw string fallback
            this.terminalManager.writeInput(sessionId, message.toString());
          }
        });

        ws.on('close', () => {
          unsubscribe();
        });
      } else {
        // Generic event listener
        ws.send(JSON.stringify({ type: 'connected', time: Date.now() }));
      }
    });
  }

  public getTerminalManager(): TerminalSessionManager {
    return this.terminalManager;
  }

  public getWorkspaceRegistry(): WorkspaceRegistry {
    return this.workspaceRegistry;
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.terminalManager.killAll();
      this.wss.close(() => {
        this.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }
}
