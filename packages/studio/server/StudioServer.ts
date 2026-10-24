import { projectChanges, projectFile } from "./ProjectChanges.js";
import { readPreviewFile } from './PreviewFiles.js';
import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import express, { Express, Request, Response } from "express";
import type { ErrorRequestHandler } from "express";
import { listClis, listOpenCodeModels, getNodeStatus, findExecutable, cliLaunch, getCliDefinition } from "./CliCatalog.js";
import { cliAuth, LOGIN_ARGS } from "./CliAuth.js";
import { chatSkills } from "./ChatSkills.js";
import { getGitStatus } from "./GitInstaller.js";
import { AgentRunManager, ollamaBase } from "./AgentRunManager.js";
import { CliInstallManager } from "./CliInstallManager.js";
import { WebSocketServer, WebSocket } from "ws";
import { TerminalSessionManager } from "./TerminalSessionManager.js";
import { WorkspaceRegistry } from "./WorkspaceRegistry.js";
import { listModels, modelEffortArgs, PROVIDER_PROFILES } from "./Providers.js";
import { SkillManager } from "./SkillManager.js";
import { UsageManager, USAGE_PROVIDERS } from "./UsageManager.js";
import { trustFolder, repairCodexConfigFile } from "./FolderTrust.js";
import { CliVersionManager, VERSIONED_CLIS } from "./CliVersions.js";
import { AttachmentError, MAX_ATTACHMENT_BYTES, resolveAttachments, saveAttachment } from "./AttachmentStore.js";
import { CliChatManager, CHAT_CLIS, CHAT_PERMISSIONS } from "./CliChat.js";

export class StudioServer {
  private agentRuns: AgentRunManager;
  private cliInstalls = new CliInstallManager();
  private skills = new SkillManager();
  private usage = new UsageManager();
  private versions = new CliVersionManager();
  private chats: CliChatManager;
  /** Sessions kept across app restarts (with their chat view state); written only once started. */
  private sessionsFile: string;
  private sessionsLoaded = false;
  private saveTimer?: NodeJS.Timeout;
  private views = new Map<string, "chat" | "terminal">();
  private app: Express;
  private server: http.Server;
  private wss: WebSocketServer;
  private terminalManager: TerminalSessionManager;
  private workspaceRegistry: WorkspaceRegistry;
  private port: number = 3888;
  /** Open tabs saved right before an in-app update, reopened on the next start. */
  private restoreFile: string;

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
    this.restoreFile = options?.customWorkspacePath
      ? path.join(path.dirname(options.customWorkspacePath), "restore.json")
      : path.join(os.homedir(), ".opencode-multi", "superai-restore.json");
    const dataDir = options?.customWorkspacePath ? path.dirname(options.customWorkspacePath) : path.join(os.homedir(), ".opencode-multi");
    this.sessionsFile = path.join(dataDir, "superai-sessions.json");
    this.chats = new CliChatManager(undefined, path.join(dataDir, "superai-chats"));
    this.chats.onChange = () => this.saveSessions();
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
      const referer = req.headers.referer;
      if (referer) {
        try {
          const refOrigin = new URL(referer).origin;
          if (!this.allowedOrigin(refOrigin))
            return res.status(403).json({ error: "ไม่อนุญาตการเรียกจากแหล่งที่มานี้" });
        } catch {}
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
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
      verifyClient: (info: { origin: string; req: http.IncomingMessage }) => {
        if (info.origin) return this.allowedOrigin(info.origin);
        const host = info.req.headers.host?.split(":")[0];
        return !host || ["localhost", "127.0.0.1", "::1", "["].includes(host);
      },
    });

    // Undo the duplicate [projects] table SuperAi 1.0.2 could add to Codex's config on macOS.
    repairCodexConfigFile();
    this.setupRoutes();
    this.setupWebSockets();
  }

  private viewOf(id: string): "chat" | "terminal" {
    return this.views.get(id) || "terminal";
  }

  /** Write the session list (chat sessions resume their chat's conversation). */
  private saveSessions() {
    if (!this.sessionsLoaded) return;
    const sessions = this.terminalManager.records().map((r) => {
      const view = this.viewOf(r.id);
      return { ...r, view, resume: (view === "chat" && this.chats.conversationId(r.id)) || r.resume };
    });
    try {
      fs.mkdirSync(path.dirname(this.sessionsFile), { recursive: true });
      fs.writeFileSync(this.sessionsFile, JSON.stringify({ savedAt: Date.now(), sessions }));
    } catch {
      // the list is saved again on the next change
    }
  }

  /** Bring back the saved sessions without starting their CLIs. */
  private loadSessions() {
    this.sessionsLoaded = true;
    try {
      const saved = JSON.parse(fs.readFileSync(this.sessionsFile, "utf8"));
      for (const entry of Array.isArray(saved?.sessions) ? saved.sessions : []) {
        if (typeof entry?.id !== "string" || !entry.options || typeof entry.options !== "object") continue;
        this.terminalManager.addDormant({
          id: entry.id,
          options: entry.options,
          createdAt: Number(entry.createdAt) || undefined,
          resume: typeof entry.resume === "string" && entry.resume ? entry.resume : undefined,
        });
        this.views.set(entry.id, entry.view === "chat" ? "chat" : "terminal");
      }
    } catch {
      // first start, or an unreadable file: start with no sessions
    }
  }

  /** Validated model/effort for a Code-mode CLI session ("" keeps the CLI default). */
  private sessionModel(agentType: unknown, model: unknown, effort: unknown) {
    const id = typeof agentType === "string" ? agentType : "";
    const m = typeof model === "string" ? model.trim() : "";
    const e = typeof effort === "string" ? effort.trim() : "";
    if (m && (m.length > 200 || !/^[\w.:/@+-]+$/.test(m) || m.startsWith("-"))) throw new Error("ชื่อรุ่นไม่ถูกต้อง");
    if (e && !PROVIDER_PROFILES[id]?.efforts.includes(e)) throw new Error("ระดับ effort ไม่ถูกต้องสำหรับ CLI นี้");
    if ((m || e) && !modelEffortArgs(id, m, e, true).length) return {};
    return { model: m, effort: e };
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
    this.app.get("/api/clis/:id/auth", async (req, res) => {
      try { res.json(await cliAuth.get(String(req.params.id), req.query.refresh === "1")); }
      catch (error: any) { res.status(400).json({ error: error.message }); }
    });
    this.app.post("/api/clis/:id/login", (req, res) => {
      try {
        const id = String(req.params.id);
        if (!(id in LOGIN_ARGS)) throw new Error("ไม่รู้จักผู้ให้บริการนี้");
        const context = req.body?.sessionId ? this.terminalManager.getSession(String(req.body.sessionId)) : undefined;
        if (req.body?.sessionId && (!context || context.agentType !== id)) throw new Error("ไม่พบ session ของผู้ให้บริการนี้");
        const workspace = this.workspaceRegistry.getWorkspace(String(context?.wsId || req.body?.wsId || ""));
        if (!context && !workspace) throw new Error("กรุณาเลือกโปรเจกต์ก่อนเข้าสู่ระบบ");
        const existing = this.terminalManager.listSessions().find((s) => s.agentType === id && s.status === "running" && (this.terminalManager.getSession(s.id)?.restart?.authOnly || id === "freebuff"));
        if (existing) return res.json({ id: existing.id });
        const launch = cliLaunch(id, LOGIN_ARGS[id]);
        const session = this.terminalManager.spawnSession({ agentType: id, ...launch, authOnly: true,
          name: `${getCliDefinition(id).name} · เข้าสู่ระบบ`, cwd: context?.cwd || workspace!.rootPath, wsId: context?.wsId || workspace?.id });
        this.views.set(session.id, "terminal");
        res.json({ id: session.id });
      } catch (error: any) { res.status(400).json({ error: error.message }); }
    });
    this.app.get('/api/cli-installs', (_req,res)=>res.json(this.cliInstalls.list()));
    this.app.get('/api/node/status', (_req, res) => res.json(getNodeStatus()));
    this.app.post('/api/node/install', (_req, res) => {
      try {
        res.json(this.cliInstalls.start('node'));
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });
    this.app.get('/api/git/status', (_req, res) => res.json(getGitStatus(findExecutable)));
    this.app.post('/api/git/install', (_req, res) => {
      try {
        if (process.platform !== 'win32') return res.status(400).json({ error: 'บน macOS ให้ติดตั้ง Git ด้วย xcode-select --install' });
        if (getGitStatus(findExecutable).installed) return res.status(409).json({ error: 'มี Git พร้อมใช้งานแล้ว' });
        res.json(this.cliInstalls.start('git'));
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });
    this.app.post('/api/clis/:id/install', (req,res)=> {
      try {
        const id=String(req.params.id);
        if(id !== 'node' && (this.terminalManager.listSessions().some(s=>s.agentType===id && ['running','stopping'].includes(s.status)) || this.agentRuns.usesCli(id))) return res.status(409).json({error:'CLI นี้กำลังใช้งานอยู่ กรุณาปิด session/หยุดทีมก่อนติดตั้ง'});
        res.json(this.cliInstalls.start(id));
      } catch(error:any) {res.status(400).json({error:error.message});}
    });
    this.app.post('/api/cli-installs/:id/cancel',(req,res)=>res.json({success:this.cliInstalls.cancel(String(req.params.id))}));
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
        const response = await fetch(`${ollamaBase()}/api/tags`, {
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
    this.app.get('/api/workspaces/:wsId/changes', async (req, res) => {
      const ws = this.workspaceRegistry.getWorkspace(String(req.params.wsId));
      if (!ws) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
      try { res.json(await projectChanges(ws.rootPath)); }
      catch { res.status(400).json({ error: 'อ่าน Git ไม่สำเร็จ ตรวจว่าติดตั้ง Git และโปรเจกต์เป็น Git repository' }); }
    });
    this.app.get('/api/workspaces/:wsId/changed-file', async (req, res) => {
      const ws = this.workspaceRegistry.getWorkspace(String(req.params.wsId));
      if (!ws) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
      try { res.json(await projectFile(ws.rootPath, String(req.query.path || ''))); }
      catch (error) { res.status(400).json({ error: (error as Error).message }); }
    });
    this.app.get('/api/workspaces/:wsId/preview-file', async (req, res) => {
      const workspace = this.workspaceRegistry.getWorkspace(String(req.params.wsId));
      if (!workspace) return res.status(404).json({ error: 'ไม่พบโปรเจกต์สำหรับเปิดไฟล์นี้' });
      try {
        const file = await readPreviewFile(workspace.rootPath, String(req.query.path || ''));
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox; style-src 'unsafe-inline'");
        res.setHeader('Cache-Control', 'no-store');
        res.send(file.content);
      } catch (error) {
        const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
        res.status(missing ? 404 : 400).json({ error: missing ? 'ไม่พบไฟล์นี้แล้ว ตรวจที่อยู่ไฟล์หรือให้ AI สร้างไฟล์ใหม่' : (error as Error).message });
      }
    });
    this.app.get("/api/conversations/:wsId", (req, res) =>
      res.json(this.agentRuns.list(String(req.params.wsId))),
    );
    this.app.post("/api/conversations/:wsId", (req, res) => {
      try {
        const workspace = this.workspaceRegistry.getWorkspace(String(req.params.wsId));
        if (!workspace) return res.status(404).json({ error: "ไม่พบโปรเจกต์" });
        const attachments = resolveAttachments(workspace.rootPath, req.body.attachments);
        const body = { ...req.body, prompt: String(req.body.prompt || ""), attachments };
        res.json(
          req.body.mode === "agent"
            ? this.agentRuns.startAgent(workspace.id, workspace.rootPath, body)
            : this.agentRuns.startChat(workspace.id, workspace.rootPath, body),
        );
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });
    this.app.get("/api/providers/:id/models", async (req, res) => {
      try {
        res.json(await listModels(String(req.params.id)));
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });
    this.app.get("/api/workspaces/:wsId/chat-skills/:provider", (req, res) => {
      const workspace = this.workspaceRegistry.getWorkspace(String(req.params.wsId));
      if (!workspace) return res.status(404).json({ error: "ไม่พบโปรเจกต์" });
      res.json(chatSkills(workspace.rootPath, String(req.params.provider)));
    });
    this.app.get("/api/cli-versions", async (req, res) => {
      res.json(await this.versions.all(req.query.refresh === "1"));
    });
    this.app.get("/api/cli-updates", (_req, res) => res.json(this.versions.list()));
    this.app.post("/api/cli-versions/:id/update", (req, res) => {
      const id = String(req.params.id);
      if (!VERSIONED_CLIS.includes(id)) return res.status(404).json({ error: "ไม่รู้จัก CLI นี้" });
      try {
        const inUse = (cli: string) =>
          this.terminalManager.listSessions().some((s) => s.agentType === cli && ["running", "stopping"].includes(s.status)) || this.agentRuns.usesCli(cli);
        res.json(this.versions.startUpdate(id, inUse));
      } catch (err: any) {
        res.status(409).json({ error: err.message });
      }
    });
    this.app.get("/api/usage", async (req, res) => {
      res.json(await this.usage.all(req.query.refresh === "1"));
    });
    this.app.get("/api/usage/:id", async (req, res) => {
      const id = String(req.params.id);
      if (!USAGE_PROVIDERS.includes(id)) return res.status(404).json({ error: "ไม่รู้จักผู้ให้บริการนี้" });
      res.json(await this.usage.get(id, req.query.refresh === "1"));
    });
    this.app.get("/api/skills/search", async (req, res) => {
      try {
        const q = String(req.query.q || "").trim();
        res.json(await this.skills.search(q));
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
    this.app.get("/api/skills/catalog", async (req, res) => {
      try {
        res.json(await this.skills.catalog(req.query.refresh === "1"));
      } catch (err: any) {
        res.status(503).json({ error: err.message });
      }
    });
    const skillWorkspace = (req: Request, res: Response) => {
      const workspace = this.workspaceRegistry.getWorkspace(String(req.params.wsId));
      if (!workspace) res.status(404).json({ error: "ไม่พบโปรเจกต์" });
      return workspace;
    };
    this.app.get("/api/workspaces/:wsId/skills", (req, res) => {
      const workspace = skillWorkspace(req, res);
      if (workspace) res.json(this.skills.installed(workspace.rootPath));
    });
    this.app.post("/api/workspaces/:wsId/skills", async (req, res) => {
      const workspace = skillWorkspace(req, res);
      if (!workspace) return;
      try {
        res.json(await this.skills.install(workspace.rootPath, String(req.body.source || ""), String(req.body.name || ""), {
          repo: req.body.repo,
          branch: req.body.branch,
          prefix: req.body.prefix,
          files: req.body.files,
        }));
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });
    this.app.delete("/api/workspaces/:wsId/skills/:name", (req, res) => {
      const workspace = skillWorkspace(req, res);
      if (!workspace) return;
      try {
        res.json(this.skills.uninstall(workspace.rootPath, String(req.params.name)));
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });
    this.app.post("/api/workspaces/:wsId/skills/recommend", async (req, res) => {
      const workspace = skillWorkspace(req, res);
      if (!workspace) return;
      const controller = new AbortController();
      res.on("close", () => { if (!res.writableEnded) controller.abort(); });
      try {
        res.json(await this.skills.recommend(workspace.rootPath, req.body.seat, String(req.body.goal || ""), controller.signal));
      } catch (err: any) {
        if (!res.headersSent) res.status(400).json({ error: err.message });
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
      res.json(this.terminalManager.listSessions().map((s) => ({ ...s, view: this.viewOf(s.id) })));
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
        // Skip the CLI's "trust this folder?" prompt for the user's own project folder.
        if (req.body.trustFolder === true && workspace?.rootPath && workingDir === workspace.rootPath && typeof agentType === "string")
          trustFolder(agentType, workspace.rootPath);
        const spawnOptions = {
          agentType,
          wsId,
          threadId,
          name,
          openCodeModel: req.body.openCodeModel,
          ...this.sessionModel(agentType, req.body.model, req.body.effort),
          forcePipe: req.body.forcePipe === true,
          command,
          args,
          cwd: workingDir,
          cols: Number(cols) || undefined,
          rows: Number(rows) || undefined,
        };
        // CLIs with a chat view open as a chat: no terminal process until the user switches to it.
        const chat = !command && CHAT_CLIS.includes(agentType) && req.body.view !== "terminal";
        const session = chat
          ? this.terminalManager.addDormant({ id: randomUUID(), options: { ...spawnOptions, cwd: workingDir || process.cwd() } })
          : this.terminalManager.spawnSession(spawnOptions);
        this.views.set(session.id, chat ? "chat" : "terminal");
        this.saveSessions();

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
          dormant: !!session.dormant,
          view: this.viewOf(session.id),
        });
      } catch (err: any) {
        res
          .status(/1 session/.test(err.message) ? 409 : 400)
          .json({ error: err.message });
      }
    });

    this.app.post("/api/terminals/:id/kill", (req: Request, res: Response) => {
      const id = String(req.params.id);
      // Closing deletes the session: its saved entry and its chat history go too.
      const killed = this.terminalManager.killSession(id);
      this.chats.drop(id);
      this.views.delete(id);
      this.saveSessions();
      res.json({ success: killed });
    });

    // Switch a session between its chat and its terminal; both continue the same conversation.
    this.app.post("/api/terminals/:id/view", async (req: Request, res: Response) => {
      const id = String(req.params.id);
      const session = this.terminalManager.getSession(id);
      if (!session) return res.status(404).json({ error: "ไม่พบ session นี้แล้ว" });
      const view = req.body?.view === "terminal" ? "terminal" : "chat";
      if (view === "chat" && session.restart?.authOnly) return res.status(400).json({ error: "แท็บนี้ใช้เข้าสู่ระบบ กรุณากลับไปแท็บแชตเดิมแล้วกดตรวจบัญชีอีกครั้ง" });
      if (view === "chat" && !CHAT_CLIS.includes(session.agentType || "")) return res.status(400).json({ error: "CLI นี้ยังไม่รองรับมุมมองแชต" });
      if ((session.sleeping || session.status === "stopping") && !(view === "chat" && session.sleeping && session.exitObserved && session.terminationConfirmed)) return res.status(409).json({ error: "Terminal กำลังปิด กรุณารอให้ปิดเสร็จก่อน" });
      try {
        if (view === "terminal") {
          if (this.chats.isRunning(id)) return res.status(409).json({ error: "รอให้แชตตอบเสร็จหรือกดหยุดก่อน แล้วค่อยสลับไป Terminal" });
          if (session.status !== "running" && session.status !== "stopping") this.terminalManager.restartSession(id, this.chats.conversationId(id));
        } else if (session.status === "running") {
          // Carry on in the chat from where the terminal got to, then stop the TUI so only one writes.
          const conversation = this.terminalManager.conversationOf(id);
          if (conversation) this.chats.setConversation(id, conversation);
          await this.terminalManager.sleepSession(id);
        } else {
          await this.terminalManager.sleepSession(id);
        }
        if (this.terminalManager.getSession(id) !== session) return res.status(409).json({ error: "session เปลี่ยนไปแล้ว กรุณาลองใหม่" });
        this.views.set(id, view);
        this.saveSessions();
        res.json({ success: true, view });
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    // Chat view of a Code session: the same CLI, model and folder, driven through its JSON stream.
    this.app.get("/api/terminals/:id/chat/settings", (req, res) => {
      const session = this.terminalManager.getSession(String(req.params.id));
      if (!session) return res.status(404).json({ error: "ไม่พบ session นี้แล้ว" });
      res.json({ agent: session.agentType, model: session.restart?.model || session.restart?.openCodeModel || "", effort: session.restart?.effort || "",
        skills: chatSkills(session.cwd, session.agentType || "") });
    });
    this.app.get("/api/terminals/:id/chat", (req: Request, res: Response) => {
      res.json(this.chats.snapshot(String(req.params.id)));
    });
    this.app.post("/api/terminals/:id/chat", async (req: Request, res: Response) => {
      const id = String(req.params.id);
      const session = this.terminalManager.getSession(id);
      if (!session) return res.status(404).json({ error: "ไม่พบ session นี้แล้ว กรุณาเปิด session ใหม่" });
      const agent = session.agentType || "";
      if (!CHAT_CLIS.includes(agent)) return res.status(400).json({ error: "CLI นี้ยังไม่รองรับมุมมองแชต กรุณาใช้ terminal" });
      // One writer per conversation: while its terminal is open, the chat waits.
      if (this.viewOf(id) !== "chat") return res.status(409).json({ error: "session นี้เปิดอยู่ในโหมด Terminal กรุณาสลับเป็นแชตก่อน" });
      if (session.sleeping || ["running", "stopping"].includes(session.status)) return res.status(409).json({ error: "Terminal ยังปิดไม่เสร็จ กรุณารอก่อนส่งข้อความ" });
      const files: unknown[] = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
      const attachments = files.filter((f): f is string => typeof f === "string" && path.isAbsolute(f) && fs.existsSync(f));
      try {
        if (typeof req.body?.text !== "string" || !req.body.text.trim()) throw new Error("กรุณาพิมพ์ข้อความ");
        const chosen = this.sessionModel(agent,
          req.body.model === undefined ? session.restart?.model || (agent === "opencode" ? session.restart?.openCodeModel : "") : req.body.model,
          req.body.effort === undefined ? session.restart?.effort : req.body.effort);
        if (req.body.skillId !== undefined && (typeof req.body.skillId !== "string" || !/^[a-f0-9]{20}$/.test(req.body.skillId))) throw new Error("skill ไม่ถูกต้อง");
        if (req.body.permission !== undefined && !CHAT_PERMISSIONS.includes(req.body.permission)) throw new Error("สิทธิ์ของแชตไม่ถูกต้อง");
        await cliAuth.requireReady(agent);
        if (this.terminalManager.getSession(id) !== session || this.viewOf(id) !== "chat") return res.status(409).json({ error: "session เปลี่ยนไปแล้ว กรุณาลองใหม่" });
        if (session.sleeping || ["running", "stopping"].includes(session.status)) return res.status(409).json({ error: "Terminal ยังปิดไม่เสร็จ กรุณารอก่อนส่งข้อความ" });
        const outcome = this.chats.send(id, {
          agent,
          cwd: session.cwd,
          text: typeof req.body?.text === "string" ? req.body.text : "",
          ...chosen,
          skillId: req.body.skillId,
          permission: req.body.permission,
          attachments,
        }, { queue: req.body.queue === true });
        session.restart = { ...session.restart, ...chosen };
        this.saveSessions();
        res.json({ success: true, queued: outcome === "queued" });
      } catch (err: any) {
        res.status(/ยังตอบ/.test(err.message) ? 409 : 400).json({ error: err.message });
      }
    });
    this.app.post("/api/terminals/:id/chat/cancel", (req: Request, res: Response) => {
      res.json({ success: this.chats.cancel(String(req.params.id)) });
    });
    // Queued messages (Ctrl+Enter): send one now, or take it back.
    this.app.post("/api/terminals/:id/chat/queue/:queued/send", (req: Request, res: Response) => {
      res.json({ success: this.chats.sendNext(String(req.params.id), String(req.params.queued)) });
    });
    this.app.post("/api/terminals/:id/chat/queue/:queued/remove", (req: Request, res: Response) => {
      res.json({ success: this.chats.unqueue(String(req.params.id), String(req.params.queued)) });
    });

    this.app.post("/api/terminals/:id/restart", (req: Request, res: Response) => {
      try {
        const id = String(req.params.id);
        if (this.chats.isRunning(id)) return res.status(409).json({ error: "แชตยังตอบข้อความก่อนหน้าอยู่ กรุณารอให้เสร็จก่อนเปิด Terminal" });
        const session = this.terminalManager.restartSession(id, this.viewOf(id) === "chat" ? this.chats.conversationId(id) : undefined);
        this.saveSessions();
        res.json({ id: session.id, status: session.status, name: session.name, agentType: session.agentType });
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    });

    this.app.post("/api/terminals/:id/input", (req: Request, res: Response) => {
      const id = String(req.params.id);
      const { input } = req.body;
      const ok = this.terminalManager.submitInput(id, typeof input === "string" ? input : "");
      res.json({ success: ok });
    });

    // Pasted / dropped images and PDFs are saved into the project folder so the
    // CLI working there can read them by path.
    const attachmentUpload = (folder: (req: Request) => string | undefined, missing: string) => [
      express.raw({ type: () => true, limit: MAX_ATTACHMENT_BYTES }),
      (req: Request, res: Response) => {
        const root = folder(req);
        if (!root) return res.status(404).json({ error: missing });
        try {
          res.json(saveAttachment(root, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)));
        } catch (error: any) {
          res.status(error instanceof AttachmentError ? error.status : 500).json({ error: error.message });
        }
      },
    ];
    this.app.post(
      "/api/terminals/:id/attachments",
      ...attachmentUpload(
        (req) => this.terminalManager.getSession(String(req.params.id))?.cwd,
        "ไม่พบ session นี้แล้ว กรุณาเปิด session ใหม่แล้วแนบไฟล์อีกครั้ง",
      ),
    );
    this.app.post(
      "/api/workspaces/:wsId/attachments",
      ...attachmentUpload((req) => {
        const root = this.workspaceRegistry.getWorkspace(String(req.params.wsId))?.rootPath;
        return root && fs.existsSync(root) ? root : undefined;
      }, "ไม่พบโฟลเดอร์โปรเจกต์ กรุณาตรวจโฟลเดอร์ในการตั้งค่าโปรเจกต์"),
    );

    const errors:ErrorRequestHandler=(error,_req,res,next)=>{
      if(res.headersSent)return next(error);
      res.status(error.status||500).json({error:error.status===413?(_req.path.endsWith('/attachments')?'ไฟล์ใหญ่เกิน 20 MB กรุณาย่อรูปหรือแยกไฟล์ PDF ให้เล็กลงแล้วลองใหม่':'คำขอยาวเกินไป กรุณาลดข้อความแล้วลองใหม่'):error.message||'ระบบทำรายการไม่สำเร็จ กรุณาลองใหม่'});
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
      } else if (pathname.startsWith("/ws/chat/")) {
        const unsubscribe = this.chats.subscribe(pathname.replace("/ws/chat/", ""), (message) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
        });
        ws.on("close", unsubscribe);
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
        this.loadSessions();
        this.restoreSessions();
        // A terminal's conversation id is only known once its CLI has written it: save now and then.
        this.saveTimer = setInterval(() => this.saveSessions(), 60_000);
        this.saveTimer.unref();
        resolve();
      };
      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(this.port, "127.0.0.1");
    });
  }

  /** What an update would interrupt right now: running Agent/Chat work and CLIs still answering. */
  public busy(): string[] {
    const chats = this.chats.running().map((id) => `แชตของ ${this.terminalManager.getSession(id)?.name || "session"}`);
    return [...(this.agentRuns.running() ? ["งานใน Agent/Chat"] : []), ...this.terminalManager.activeSessions(), ...chats];
  }

  /** Save the open tabs so the next start reopens them on the same conversations. */
  public saveRestore(): number {
    const sessions = this.terminalManager.snapshot();
    fs.mkdirSync(path.dirname(this.restoreFile), { recursive: true });
    fs.writeFileSync(this.restoreFile, JSON.stringify({ savedAt: Date.now(), sessions }));
    return sessions.length;
  }

  public discardRestore() {
    fs.rmSync(this.restoreFile, { force: true });
  }

  private restoreSessions() {
    try {
      if (!fs.existsSync(this.restoreFile)) return;
      const saved = JSON.parse(fs.readFileSync(this.restoreFile, "utf8"));
      fs.rmSync(this.restoreFile, { force: true });
      // Only right after an update: an old file (the update never finished) is ignored.
      if (Date.now() - Number(saved?.savedAt) > 30 * 60_000 || !Array.isArray(saved?.sessions)) return;
      this.terminalManager.restore(saved.sessions);
    } catch {
      // a broken file must not stop the app from starting
    }
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      clearInterval(this.saveTimer);
      this.saveSessions();
      this.agentRuns.stop();
      this.chats.stopAll();
      this.cliInstalls.stop();
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
