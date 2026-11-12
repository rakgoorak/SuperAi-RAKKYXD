import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { Workspace, AgentThread } from "./types.js";
import { tr } from './i18n.js';

export class WorkspaceRegistry {
  private storagePath: string;
  private workspaces: Map<string, Workspace> = new Map();
  private lastSaved = "";

  constructor(customPath?: string) {
    if (customPath) {
      this.storagePath = customPath;
    } else {
      const configDir = path.join(os.homedir(), ".opencode-multi");
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      this.storagePath = path.join(configDir, "studio-workspaces.json");
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
        id: "ws-default",
        name: path.basename(cwd) || tr("โปรเจกต์ของฉัน"),
        rootPath: cwd,
        threads: [],
      },
    ];

    for (const ws of defaultWorkspaces) {
      this.workspaces.set(ws.id, ws);
    }
    this.save();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, "utf8");
        const list: Workspace[] = JSON.parse(data);
        if(!Array.isArray(list)||list.some(ws=>typeof ws.id!=="string"||typeof ws.name!=="string"||typeof ws.rootPath!=="string"||!Array.isArray(ws.threads)))throw new Error(tr("รูปแบบข้อมูลไม่ถูกต้อง"));
        for (const ws of list) {
          this.workspaces.set(ws.id, ws);
        }
        this.lastSaved=JSON.stringify(list);
      }
    } catch {
      throw new Error(tr`อ่านข้อมูลโปรเจกต์ไม่ได้: ${this.storagePath} ไฟล์เดิมยังไม่ถูกแก้ไข กรุณาตรวจรูปแบบ JSON และสิทธิ์อ่าน`);
    }
  }

  private save(): void {
    try {
      const list = Array.from(this.workspaces.values());
      const tempPath = `${this.storagePath}.tmp`;
      const content=JSON.stringify(list, null, 2);
      fs.writeFileSync(tempPath, content, "utf8");
      fs.renameSync(tempPath, this.storagePath);
      this.lastSaved=content;
    } catch {
      if(this.lastSaved)this.workspaces=new Map((JSON.parse(this.lastSaved) as Workspace[]).map(ws=>[ws.id,ws]));
      throw new Error(tr`บันทึกข้อมูลโปรเจกต์ไม่ได้: ${this.storagePath} กรุณาตรวจสิทธิ์เขียนและพื้นที่ว่าง`);
    }
  }

  public getWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  public getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  public createWorkspace(name: string, rootPath: string, instructions?: string, pinnedFiles?: string[]): Workspace {
    const ws: Workspace = {
      id: `ws-${Date.now()}-${randomUUID().slice(0, 4)}`,
      name,
      rootPath,
      instructions: instructions?.trim(),
      pinnedFiles: Array.isArray(pinnedFiles) ? pinnedFiles : [],
      threads: [],
    };
    this.workspaces.set(ws.id, ws);
    this.save();
    return ws;
  }

  public updateWorkspace(
    id: string,
    updates: { name?: string; rootPath?: string; instructions?: string; pinnedFiles?: string[]; favorite?: boolean },
  ): Workspace | undefined {
    const ws = this.workspaces.get(id);
    if (!ws) return undefined;
    if (updates.favorite !== undefined && typeof updates.favorite !== 'boolean') throw new Error(tr("สถานะโปรเจกต์โปรดไม่ถูกต้อง"));
    if (updates.name !== undefined) {
      if (!updates.name.trim()) throw new Error(tr("กรุณาระบุชื่อโปรเจกต์"));
      ws.name = updates.name.trim();
    }
    if (updates.rootPath !== undefined) {
      if (
        !fs.existsSync(updates.rootPath) ||
        !fs.statSync(updates.rootPath).isDirectory()
      )
        throw new Error(tr("ไม่พบโฟลเดอร์โปรเจกต์"));
      ws.rootPath = path.resolve(updates.rootPath);
    }
    if (updates.instructions !== undefined) {
      ws.instructions = updates.instructions.trim();
    }
    if (updates.pinnedFiles !== undefined) {
      ws.pinnedFiles = Array.isArray(updates.pinnedFiles) ? [...new Set(updates.pinnedFiles)] : [];
    }
    if (updates.favorite !== undefined) ws.favorite = updates.favorite;
    this.save();
    return ws;
  }

  public deleteWorkspace(id: string): boolean {
    const removed = this.workspaces.delete(id);
    if (removed) this.save();
    return removed;
  }

  public addThread(
    workspaceId: string,
    threadData: Partial<AgentThread>,
  ): AgentThread {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const thread: AgentThread = {
      id: `th-${Date.now()}-${randomUUID().slice(0, 4)}`,
      title: threadData.title || "New Thread",
      type: threadData.type || "terminal",
      status: threadData.status || "idle",
      unreadCount: 0,
      sessionId: threadData.sessionId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      thoughts: threadData.thoughts || [],
    };

    ws.threads.push(thread);
    if (!ws.activeThreadId) {
      ws.activeThreadId = thread.id;
    }
    this.save();
    return thread;
  }

  public updateThread(
    workspaceId: string,
    threadId: string,
    updates: Partial<AgentThread>,
  ): AgentThread | undefined {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return undefined;

    const thread = ws.threads.find((t) => t.id === threadId);
    if (!thread) return undefined;

    const { title, status, unreadCount, sessionId, thoughts } = updates;
    Object.assign(
      thread,
      Object.fromEntries(
        Object.entries({
          title,
          status,
          unreadCount,
          sessionId,
          thoughts,
        }).filter(([, value]) => value !== undefined),
      ),
      { lastActiveAt: Date.now() },
    );
    this.save();
    return thread;
  }

  public setActiveThread(workspaceId: string, threadId: string): void {
    const ws = this.workspaces.get(workspaceId);
    if (ws && ws.threads.some((t) => t.id === threadId)) {
      ws.activeThreadId = threadId;
      // Clear unread count when activated
      const th = ws.threads.find((t) => t.id === threadId);
      if (th) th.unreadCount = 0;
      this.save();
    }
  }

  public deleteThread(workspaceId: string, threadId: string): boolean {
    const ws = this.workspaces.get(workspaceId);
    if (!ws) return false;

    const index = ws.threads.findIndex((t) => t.id === threadId);
    if (index === -1) return false;

    ws.threads.splice(index, 1);
    if (ws.activeThreadId === threadId) {
      ws.activeThreadId = ws.threads[0]?.id;
    }
    this.save();
    return true;
  }
}
