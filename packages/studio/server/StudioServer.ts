import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express, { Express, Request, Response } from "express";
import type { ErrorRequestHandler } from "express";
import { listClis, listOpenCodeModels } from "./CliCatalog.js";
import { AgentRunManager } from "./AgentRunManager.js";
import { WebSocketServer, WebSocket } from "ws";
import { TerminalSessionManager } from "./TerminalSessionManager.js";
import { WorkspaceRegistry } from "./WorkspaceRegistry.js";

export class StudioServer {
  private agentRuns: AgentRunManager;
  private dictations: { id: number; text: string }[] = [];
  private app: Express;
  private server: http.Server;
  private wss: WebSocketServer;
  private terminalManager: TerminalSessionManager;
  private workspaceRegistry: WorkspaceRegistry;
  private port: number = 3888;

  constructor(options?: { port?: number; customWorkspacePath?: string }) {
    this.agentRuns = new AgentRunManager(
      options?.customWorkspacePath
        ? path.join(
            path.dirname(options.customWorkspacePath),
            "conversations.json",
          )
        : undefined,
    );
    if (options?.port !== undefined) this.port = options.port;
    this.terminalManager = new TerminalSessionManager();
    this.workspaceRegistry = new WorkspaceRegistry(
      options?.customWorkspacePath,
    );

    this.app = express();
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      const host = req.headers.host?.split(":")[0];
      if (host && !["localhost", "127.0.0.1", "["].includes(host))
        return res
          .status(403)
          .json({ error: "อนุญาตเฉพาะการเชื่อมต่อในเครื่อง" });
      if (origin && !this.allowedOrigin(origin))
        return res.status(403).json({ error: "ไม่อนุญาตต้นทางนี้" });
      next();
    });
    this.app.use(express.json({limit:'1mb'}));
    this.app.use((req, res, next) => {
      if (
        req.body?.openCodeModel !== undefined &&
        (typeof req.body.openCodeModel !== "string" ||
          req.body.openCodeModel.length > 160 ||
          !/^[-\w./:]*$/.test(req.body.openCodeModel))
      )
        return res.status(400).json({ error: "ชื่อรุ่น OpenCode ไม่ถูกต้อง" });
      next();
    });

    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({
      server: this.server,
      verifyClient: (info: { origin: string }) =>
        !info.origin || this.allowedOrigin(info.origin),
    });

    this.setupRoutes();
    this.setupWebSockets();
  }

  private allowedOrigin(origin: string): boolean {
    return [
      `http://localhost:${this.port}`,
      `http://127.0.0.1:${this.port}`,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ].includes(origin);
  }

  private setupRoutes(): void {
    this.app.get("/api/clis", (_req, res) => res.json(listClis()));
    this.app.get("/api/opencode/models", async (_req, res) => {
      try {
        res.json({ models: await listOpenCodeModels() });
      } catch {
        res
          .status(503)
          .json({
            error:
              "ตรวจรุ่น OpenCode ไม่สำเร็จ ตรวจการติดตั้งหรืออินเทอร์เน็ต แล้วลองใหม่",
          });
      }
    });
    this.app.get("/api/ollama/models", async (_req, res) => {
      try {
        const response = await fetch("http://127.0.0.1:11434/api/tags", {
          signal: AbortSignal.timeout(4000),
        });
        if (!response.ok) throw new Error(`Ollama ${response.status}`);
        const data = await response.json();
        res.json({ models: data.models?.map((m: any) => m.name) || [] });
      } catch {
        res
          .status(503)
          .json({
            error:
              "ยังเชื่อมต่อ Ollama ไม่ได้ กรุณาเปิด Ollama และดาวน์โหลด model ด้วย ollama pull qwen2.5-coder:7b",
          });
      }
    });
    this.app.get("/api/conversations/:wsId", (req, res) =>
      res.json(this.agentRuns.list(String(req.params.wsId))),
    );
    this.app.post("/api/conversations/:wsId", (req, res) => {
      try {
        const workspace = this.workspaceRegistry.getWorkspace(
          String(req.params.wsId),
        );
        if (!workspace) return res.status(404).json({ error: "ไม่พบโปรเจกต์" });
        const run = this.agentRuns.start(
          workspace.id,
          String(req.body.prompt || ""),
          String(req.body.model || ""),
          workspace.rootPath,
          req.body.mode === "assistant" ? "assistant" : "chat",
          req.body.allowTools === true,
          req.body.openCodeModel || "",
        );
        res.json(run);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });
    this.app.delete("/api/conversations/:wsId", (req, res) => {
      try {
        this.agentRuns.clear(String(req.params.wsId));
        res.json({ success: true });
      } catch (err: any) {
        res.status(409).json({ error: err.message });
      }
    });
    this.app.post("/api/runs/:id/cancel", (req, res) =>
      res.json({ success: this.agentRuns.cancel(String(req.params.id)) }),
    );
    this.app.post("/api/dictation", (req, res) => {
      const text = req.body.text;
      if (typeof text !== "string" || !text.trim() || text.length > 50000)
        return res.status(400).json({ error: "ข้อความเสียงไม่ถูกต้อง" });
      this.dictations.push({
        id: Math.max(Date.now(), (this.dictations.at(-1)?.id || 0) + 1),
        text,
      });
      this.dictations = this.dictations.slice(-20);
      res.json({ success: true });
    });
    this.app.get("/api/dictation", (req, res) =>
      res.json(
        this.dictations.filter((d) => d.id > Number(req.query.after || 0)),
      ),
    );
    this.app.patch("/api/workspaces/:wsId", (req, res) => {
      try {
        const result = this.workspaceRegistry.updateWorkspace(
          String(req.params.wsId),
          { name: req.body.name, rootPath: req.body.rootPath },
        );
        if (!result) return res.status(404).json({ error: "ไม่พบโปรเจกต์" });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });
    this.app.delete("/api/workspaces/:wsId", (req, res) => {
      const id = String(req.params.wsId);
      for (const s of this.terminalManager.listSessions())
        if (s.wsId === id) this.terminalManager.killSession(s.id);
      for (const r of this.agentRuns.list(id))
        if (r.status === "running") this.agentRuns.cancel(r.id);
      res.json({ success: this.workspaceRegistry.deleteWorkspace(id) });
    });
    // Health / info
    this.app.get("/api/health", (_req: Request, res: Response) => {
      res.json({
        product: "SuperAi & RAKKYXD",
        status: "ok",
        time: Date.now(),
        pty: this.terminalManager.ptyAvailable,
      });
    });

    // Workspaces
    this.app.get("/api/workspaces", (_req: Request, res: Response) => {
      res.json(this.workspaceRegistry.getWorkspaces());
    });

    this.app.post("/api/workspaces", (req: Request, res: Response) => {
      const { name, rootPath } = req.body;
      if (typeof name !== "string" || !name.trim())
        return res.status(400).json({ error: "กรุณาระบุชื่อโปรเจกต์" });
      if (
        typeof rootPath !== "string" ||
        !fs.existsSync(rootPath) ||
        !fs.statSync(rootPath).isDirectory()
      )
        return res.status(400).json({ error: "ไม่พบโฟลเดอร์โปรเจกต์" });
      const ws = this.workspaceRegistry.createWorkspace(
        name,
        rootPath || process.cwd(),
      );
      res.json(ws);
    });

    this.app.post(
      "/api/workspaces/:wsId/threads",
      (req: Request, res: Response) => {
        const wsId = String(req.params.wsId);
        try {
          const thread = this.workspaceRegistry.addThread(wsId, req.body);
          res.json(thread);
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      },
    );

    this.app.patch(
      "/api/workspaces/:wsId/threads/:thId",
      (req: Request, res: Response) => {
        const wsId = String(req.params.wsId);
        const thId = String(req.params.thId);
        const updated = this.workspaceRegistry.updateThread(
          wsId,
          thId,
          req.body,
        );
        if (!updated)
          return res.status(404).json({ error: "Thread not found" });
        res.json(updated);
      },
    );

    this.app.post(
      "/api/workspaces/:wsId/select",
      (req: Request, res: Response) => {
        const wsId = String(req.params.wsId);
        const { threadId } = req.body;
        this.workspaceRegistry.setActiveThread(wsId, String(threadId));
        res.json({ success: true, activeThreadId: threadId });
      },
    );

    this.app.delete(
      "/api/workspaces/:wsId/threads/:thId",
      (req: Request, res: Response) => {
        const wsId = String(req.params.wsId);
        const thId = String(req.params.thId);
        const ok = this.workspaceRegistry.deleteThread(wsId, thId);
        res.json({ success: ok });
      },
    );

    // Terminals
    this.app.get("/api/terminals", (_req: Request, res: Response) => {
      for (const session of this.terminalManager.listSessions()) {
        if (session.wsId && session.threadId)
          this.workspaceRegistry.updateThread(session.wsId, session.threadId, {
            status:
              session.status === "running"
                ? "running"
                : session.status === "error"
                  ? "failed"
                  : "completed",
          });
      }
      res.json(this.terminalManager.listSessions());
    });

    this.app.post("/api/terminals/spawn", (req: Request, res: Response) => {
      try {
        const {
          command,
          args,
          cwd,
          name,
          threadId,
          wsId,
          cols,
          rows,
          agentType,
        } = req.body;
        const workspace = wsId
          ? this.workspaceRegistry.getWorkspace(String(wsId))
          : undefined;
        if (wsId && !workspace)
          return res.status(404).json({ error: "ไม่พบโปรเจกต์" });
        const workingDir =
          cwd ||
          (workspace?.rootPath && fs.existsSync(workspace.rootPath)
            ? workspace.rootPath
            : undefined);

        if (
          workingDir &&
          (!fs.existsSync(workingDir) || !fs.statSync(workingDir).isDirectory())
        )
          return res.status(400).json({ error: "ไม่พบโฟลเดอร์ทำงาน" });
        const session = this.terminalManager.spawnSession({
          agentType,
          wsId,
          threadId,
          name,
          openCodeModel: req.body.openCodeModel,
          forcePipe: req.body.forcePipe === true,
          command,
          args,
          cwd: workingDir,
          cols: Number(cols) || undefined,
          rows: Number(rows) || undefined,
        });

        // Link to thread if provided
        if (wsId && threadId) {
          this.workspaceRegistry.updateThread(String(wsId), String(threadId), {
            sessionId: session.id,
            status: "running",
          });
        }

        res.json({
          id: session.id,
          name: session.name,
          command: session.command,
          cwd: session.cwd,
          mode: session.mode,
          status: session.status,
          agentType: session.agentType,
          wsId: session.wsId,
        });
      } catch (err: any) {
        res
          .status(/1 session/.test(err.message) ? 409 : 400)
          .json({ error: err.message });
      }
    });

    this.app.post("/api/terminals/:id/kill", (req: Request, res: Response) => {
      const id = String(req.params.id);
      const killed = this.terminalManager.killSession(id);
      res.json({ success: killed });
    });

    this.app.post("/api/terminals/:id/input", (req: Request, res: Response) => {
      const id = String(req.params.id);
      const { input } = req.body;
      const ok = this.terminalManager.writeInput(id, input || "");
      res.json({ success: ok });
    });

    const errors:ErrorRequestHandler=(error,_req,res,next)=>{
      if(res.headersSent)return next(error);
      res.status(error.status||500).json({error:error.status===413?'คำขอยาวเกินไป กรุณาลดข้อความแล้วลองใหม่':error.message||'ระบบทำรายการไม่สำเร็จ กรุณาลองใหม่'});
    };
    this.app.use(errors);
    this.app.use("/api", (_req, res) =>
      res.status(404).json({ error: "ไม่พบ API นี้" }),
    );

    // Serve the built UI (packages/studio/client/dist), resolved relative to this
    // file so it works no matter which folder the app is launched from.
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const clientDist = [
      path.resolve(moduleDir, "../client/dist"),
      path.join(process.cwd(), "packages", "studio", "client", "dist"),
    ].find((p) => fs.existsSync(path.join(p, "index.html")));
    if (clientDist) {
      console.log(
        `[StudioServer] Serving static client dist from: ${clientDist}`,
      );
      this.app.use(express.static(clientDist));
      this.app.get("*", (_req: Request, res: Response) => {
        res.sendFile(path.join(clientDist, "index.html"));
      });
    } else {
      console.warn(`[StudioServer] WARNING: client dist index.html not found!`);
    }
  }

  private setupWebSockets(): void {
    // Errors (e.g. port in use) are surfaced through start(); don't crash here.
    this.wss.on("error", () => {});

    this.wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
      const url = new URL(req.url || "/", `http://localhost:${this.port}`);
      const pathname = url.pathname;

      if (pathname.startsWith("/ws/terminal/")) {
        const sessionId = pathname.replace("/ws/terminal/", "");
        const session = this.terminalManager.getSession(sessionId);

        if (!session) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Terminal session ${sessionId} not found`,
            }),
          );
          ws.close();
          return;
        }

        // Subscribe to terminal output
        const unsubscribe = this.terminalManager.subscribe(
          sessionId,
          (chunk: string) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "output", data: chunk }));
            }
          },
        );

        // Handle keyboard input and terminal resize
        ws.on("message", (message: string) => {
          try {
            const data = JSON.parse(message.toString());
            if (data.type === "input" && typeof data.data === "string") {
              this.terminalManager.writeInput(sessionId, data.data);
            } else if (data.type === "resize") {
              this.terminalManager.resize(
                sessionId,
                Number(data.cols),
                Number(data.rows),
              );
            }
          } catch {
            // raw string fallback
            this.terminalManager.writeInput(sessionId, message.toString());
          }
        });

        ws.on("close", () => {
          unsubscribe();
        });
      } else {
        // Generic event listener
        ws.send(JSON.stringify({ type: "connected", time: Date.now() }));
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
        this.server.off("listening", onListening);
        reject(err);
      };
      const onListening = () => {
        this.server.off("error", onError);
        const address = this.server.address();
        if (address && typeof address === "object") this.port = address.port;
        resolve();
      };
      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(this.port, "127.0.0.1");
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.agentRuns.stop();
      this.terminalManager.killAll();
      for (const client of this.wss.clients) client.terminate();
      this.wss.close(() => {
        this.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }
}
