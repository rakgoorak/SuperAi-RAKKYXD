import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
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
      res.json({ status: 'ok', time: Date.now(), pty: this.terminalManager.ptyAvailable });
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
      const wsId = String(req.params.wsId);
      try {
        const thread = this.workspaceRegistry.addThread(wsId, req.body);
        res.json(thread);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    this.app.patch('/api/workspaces/:wsId/threads/:thId', (req: Request, res: Response) => {
      const wsId = String(req.params.wsId);
      const thId = String(req.params.thId);
      const updated = this.workspaceRegistry.updateThread(wsId, thId, req.body);
      if (!updated) return res.status(404).json({ error: 'Thread not found' });
      res.json(updated);
    });

    this.app.post('/api/workspaces/:wsId/select', (req: Request, res: Response) => {
      const wsId = String(req.params.wsId);
      const { threadId } = req.body;
      this.workspaceRegistry.setActiveThread(wsId, String(threadId));
      res.json({ success: true, activeThreadId: threadId });
    });

    this.app.delete('/api/workspaces/:wsId/threads/:thId', (req: Request, res: Response) => {
      const wsId = String(req.params.wsId);
      const thId = String(req.params.thId);
      const ok = this.workspaceRegistry.deleteThread(wsId, thId);
      res.json({ success: ok });
    });

    // Terminals
    this.app.get('/api/terminals', (_req: Request, res: Response) => {
      res.json(this.terminalManager.listSessions());
    });

    this.app.post('/api/terminals/spawn', (req: Request, res: Response) => {
      const { command, args, cwd, name, threadId, wsId, cols, rows } = req.body;
      const workspace = wsId ? this.workspaceRegistry.getWorkspace(String(wsId)) : undefined;
      const workingDir =
        cwd || (workspace?.rootPath && fs.existsSync(workspace.rootPath) ? workspace.rootPath : undefined);

      const session = this.terminalManager.spawnSession({
        name,
        command,
        args,
        cwd: workingDir,
        cols: Number(cols) || undefined,
        rows: Number(rows) || undefined
      });

      // Link to thread if provided
      if (wsId && threadId) {
        this.workspaceRegistry.updateThread(String(wsId), String(threadId), {
          sessionId: session.id,
          status: 'running'
        });
      }

      res.json({
        id: session.id,
        name: session.name,
        command: session.command,
        cwd: session.cwd,
        mode: session.mode,
        status: session.status
      });
    });

    this.app.post('/api/terminals/:id/kill', (req: Request, res: Response) => {
      const id = String(req.params.id);
      const killed = this.terminalManager.killSession(id);
      res.json({ success: killed });
    });

    this.app.post('/api/terminals/:id/input', (req: Request, res: Response) => {
      const id = String(req.params.id);
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
        const result = await loginManager.login(service as any);
        if (result.success && result.token) {
          res.json({
            success: true,
            service,
            token: result.token.slice(0, 10) + '...',
            details: result.details
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error || 'Failed to authenticate via browser'
          });
        }
      } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Serve the built UI (packages/studio/client/dist), resolved relative to this
    // file so it works no matter which folder the app is launched from.
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const clientDist = [
      path.resolve(moduleDir, '../client/dist'),
      path.join(process.cwd(), 'packages', 'studio', 'client', 'dist')
    ].find((p) => fs.existsSync(path.join(p, 'index.html')));
    if (clientDist) {
      this.app.use(express.static(clientDist));
      this.app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(clientDist, 'index.html'));
      });
    }
  }

  private setupWebSockets(): void {
    // Errors (e.g. port in use) are surfaced through start(); don't crash here.
    this.wss.on('error', () => {});

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

        // Handle keyboard input and terminal resize
        ws.on('message', (message: string) => {
          try {
            const data = JSON.parse(message.toString());
            if (data.type === 'input' && typeof data.data === 'string') {
              this.terminalManager.writeInput(sessionId, data.data);
            } else if (data.type === 'resize') {
              this.terminalManager.resize(sessionId, Number(data.cols), Number(data.rows));
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

  public getPort(): number {
    return this.port;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        this.server.off('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        this.server.off('error', onError);
        resolve();
      };
      this.server.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen(this.port);
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
