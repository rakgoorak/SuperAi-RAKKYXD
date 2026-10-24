import { recoveryHint } from "./recovery";
import { ChangesPanel } from "./components/ChangesPanel";
import { HistoryPanel, type HistoryEntry } from "./components/HistoryPanel";
import { RunActions } from "./components/RunActions";
import { SlashMenu, type SlashMenuHandle } from "./components/SlashMenu";
import { MentionMenu, type MentionMenuHandle } from "./components/MentionMenu";
import { CommandPalette } from "./components/CommandPalette";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Folder,
  FolderPlus,
  Plus,
  ChevronRight,
  ChevronDown,
  Terminal,
  MessageSquare,
  Bot,
  Settings,
  Globe,
  LayoutGrid,
  Rows2,
  Activity,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  PanelTop,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Square,
  Sparkles,
  Pin,
  X,
  Check,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  LoaderCircle,
  RefreshCw,
  AlertCircle,
  Code2,
  ShieldCheck,
  Layers,
  Rocket,
  Puzzle,
  Download,
  Users,
} from "lucide-react";
import { api, post, loginProvider, Workspace, Cli, Session, Run, Seat, togglePinnedFile } from "./api";
import { paneView } from "./paneView";
import { chatPrefs, sendChatCommand, setChatPrefs } from "./chatControls";
import { SessionChatControls } from "./components/SessionChatControls";
import { SessionCanvas, type CanvasLayout } from "./components/SessionCanvas";
import { RightDock, type DockView } from "./components/RightDock";
import { parsePreviewTarget, type PreviewRequest } from './previewLinks';
import { AgentConfigEditor, AgentRunView, type AgentConfig } from "./components/AgentPanel";
import { ChatConfigEditor, ChatRunView, type ChatConfig } from "./components/ChatPanel";
import { SkillsPanel } from "./components/SkillsPanel";
import { UpdatePanel, UpdatePrompt, useUpdateState } from "./components/UpdatePanel";
import { UsageButton } from "./components/UsagePanel";
import { CliVersionsPanel, OutdatedNotice } from "./components/CliVersions";
import { ProviderDefaults } from "./components/ProviderDefaults";
import { SeatPicker } from "./components/SeatPicker";
import { Markdown } from "./components/Markdown";
import { HEADLESS, loadDefaults, saveDefaults, seatFor } from "./providers";
import { CliInstaller } from "./components/CliInstaller";
import { LaunchPresets, type LaunchSeat } from "./components/LaunchPresets";
import { VoiceSettingsPanel } from "./components/VoiceSettingsPanel";
import { DictationButton } from "./components/DictationButton";
import { AttachMenu, AttachmentCards, ComposerDropOverlay, useComposerAttachments, useWindowDrop } from "./components/ComposerAttachments";
import { attachMode, formatPath, pastedFiles, uploadAttachment, type SavedAttachment } from "./attachments";
import { SetupGuide, setupNeeded } from "./components/SetupGuide";
import { ChatQuickControls } from "./components/ChatQuickControls";
import { loadVoiceSettings, saveVoiceSettings, type VoiceSettings } from "./voice/speech";
import { getSuggestions } from "./suggestions";
import { NextSteps } from "./components/NextSteps";
import { MessageAttachments } from "./components/MessageAttachments";
import { WorkspaceWelcome } from "./components/WorkspaceWelcome";
import { composerDraftKey, useComposerDrafts } from "./composerDrafts";

type Mode = "agent" | "code" | "chat";
type Dialog = "history" | "changes" | "session-delete" | "session" | "settings" | "project" | "delete" | "clear" | "setup" | "skills" | "update" | null;
const modeLabels: Record<Mode, string> = {
  agent: "Agent",
  code: "Code",
  chat: "Chat",
};
const statusText: Record<string, string> = {
  running: "กำลังทำงาน",
  stopping: "กำลังปิด",
  exited: "จบการทำงาน",
  error: "มีข้อผิดพลาด",
  completed: "เสร็จแล้ว",
  failed: "ไม่สำเร็จ",
  cancelled: "ยกเลิกแล้ว",
};
function initial(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function App() {
  const slashMenu = useRef<SlashMenuHandle>(null);
  const mentionMenu = useRef<MentionMenuHandle>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWs, setActiveWs] = useState(initial("superai-workspace", ""));
  const activeWsRef = useRef(activeWs);
  activeWsRef.current = activeWs;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clis, setClis] = useState<Cli[]>([]);
  const [selected, setSelected] = useState(() => initial("superai-selected", ""));
  useEffect(() => { try { localStorage.setItem("superai-selected", selected); } catch {} }, [selected]);
  const [historyRun, setHistoryRun] = useState("");
  const [mode, setMode] = useState<Mode>(() => {
    const saved = initial("superai-mode", "code");
    return saved === "agent" || saved === "chat" ? saved : "code";
  });
  const [preview, setPreview] = useState(
    initial("superai-preview", "true") === "true",
  );
  const [sidebar, setSidebar] = useState(true);
  const [layout, setLayout] = useState<CanvasLayout>(() => {
    const saved = initial("superai-canvas-layout-v2", "auto");
    return ["auto", "tabs", "stack", "split", "3", "4"].includes(saved) ? saved as CanvasLayout : "auto";
  });
  const [zoomed, setZoomed] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [dockView, setDockView] = useState<DockView>("browser");
  const [previewRequest, setPreviewRequest] = useState<PreviewRequest>();
  const [launchPlan, setLaunchPlan] = useState<LaunchSeat[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleteSession, setDeleteSession] = useState<{id: string; name: string} | null>(null);
  useEffect(() => { const request = (event: Event) => { setDeleteSession((event as CustomEvent<{id: string; name: string}>).detail); setDialog("session-delete"); }; window.addEventListener("superai:delete-session", request); return () => window.removeEventListener("superai:delete-session", request); }, []);
  const [settingsTab, setSettingsTab] = useState("tools");
  const [usageOpen, setUsageOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pty, setPty] = useState(false);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<"active" | "all">("active");
  const draftScope = composerDraftKey(activeWs, mode, selected, target);
  const { draft, setDraft, setDraftFor } = useComposerDrafts(draftScope);
  const [launchType, setLaunchType] = useState("claude-code");
  const [count, setCount] = useState(1);
  const launchTotal = launchPlan?.reduce((n, seat) => n + seat.count, 0) || count;
  const [projectName, setProjectName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [projectInstructions, setProjectInstructions] = useState("");
  const [editing, setEditing] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelError, setModelError] = useState("");
  const [allowTools, setAllowTools] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null);
  // Model/effort for the CLI chosen in the "open session" dialog (Code mode).
  const [sessionSeat, setSessionSeat] = useState<Seat>(() => seatFor("claude-code", ""));
  const [runs, setRuns] = useState<Run[]>([]);
  const [menu, setMenu] = useState("");
  const composer = useRef<HTMLTextAreaElement>(null);
  const update = useUpdateState();
  // Record the project folder as trusted in Claude Code / Codex / Antigravity so new tabs skip their "trust this folder?" prompt.
  const [trustFolders, setTrustFolders] = useState(() => initial("superai-trust-folders", "1") === "1");
  useEffect(() => {
    try { localStorage.setItem("superai-trust-folders", trustFolders ? "1" : "0"); } catch {}
  }, [trustFolders]);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(loadVoiceSettings);
  const setupShown = useRef(false);
  const [checkingModels, setCheckingModels] = useState(false);
  const [openCodeModel, setOpenCodeModel] = useState(
    initial("superai-opencode-model", "auto"),
  );
  const workspace = workspaces.find((w) => w.id === activeWs);
  const [pinnedPickerOpen, setPinnedPickerOpen] = useState(false);
  const [pinnedSearch, setPinnedSearch] = useState("");
  const [projectFileList, setProjectFileList] = useState<Array<{ path: string; name: string }>>([]);

  const loadProjectFiles = useCallback(async () => {
    if (!workspace) return;
    try {
      const res = await api<{ files: Array<{ path: string; name: string }> }>(`/api/workspaces/${workspace.id}/files`);
      setProjectFileList(res.files || []);
    } catch {}
  }, [workspace]);

  const handleTogglePin = async (filePath: string) => {
    if (!workspace) return;
    try {
      const updated = await togglePinnedFile(workspace.id, filePath);
      setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setNotice("อัปเดตไฟล์ปักหมุดแล้ว");
    } catch (err: any) {
      showError(err.message);
    }
  };
  const visible = sessions.filter((s) => s.wsId === activeWs);
  const selectedSession = visible.find((s) => s.id === selected);
  // Chat sessions take messages without a running terminal.
  const running = visible.filter((s) => s.status === "running" || paneView(s) === "chat");
  // The one chat session the composer sends to gets its Model/Effort/skills/account controls there.
  const composerTarget = target === "all" ? undefined : selectedSession;
  const chatTarget = mode === "code" && composerTarget && paneView(composerTarget) === "chat" ? composerTarget : undefined;
  const conversation = runs.filter((r) => r.mode === mode);
  const latestRun = conversation[conversation.length - 1] || null;
  const suggestions = getSuggestions({
    mode,
    lastRun: latestRun ? { ...latestRun, output: latestRun.output || latestRun.panel?.filter(answer => answer.status === "completed").map(answer => answer.output).join("\n\n") || "" } : null,
  });
  const activeRun = runs.find((r) => r.status === "running");
  const launchCli = clis.find((c) => c.id === launchType);
  const showError = useCallback((text: string) => {
    setError(text);
  }, []);
  const refresh = useCallback(async () => {
    const [w, s] = await Promise.all([
      api<Workspace[]>("/api/workspaces"),
      api<Session[]>("/api/terminals"),
    ]);
    setWorkspaces(w);
    setSessions(s);
    setConnected(true);
    setActiveWs((current) =>
      w.some((x) => x.id === current) ? current : w[0]?.id || "",
    );
  }, []);
  const checkClis = useCallback(async () => {
    setClis(await api<Cli[]>("/api/clis"));
  }, []);
  const attachments = useComposerAttachments(showError, draftScope);
  const attachToComposer = useCallback((files: File[]) => {
    attachments.add(files);
    requestAnimationFrame(() => composer.current?.focus());
  }, [attachments.add]);
  const task = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  const loadModels = useCallback(async () => {
    setCheckingModels(true);
    setModelError("");
    try {
      const data = await api<{ models: string[] }>("/api/ollama/models");
      setModels(data.models);
      if (!data.models.length)
        setModelError(
          "ยังไม่มี model ใช้คำสั่ง ollama pull qwen2.5-coder:7b ใน terminal",
        );
    } catch (e) {
      setModels([]);
      setModelError((e as Error).message);
    } finally {
      setCheckingModels(false);
    }
  }, []);
  useEffect(() => {
    void task(async () => {
      const health = await api("/api/health");
      setPty(health.pty);
      await Promise.all([refresh(), checkClis()]);
    });
    let pending = false;
    const timer = setInterval(async () => {
      if (pending) return;
      pending = true;
      try {
        await refresh();
      } catch {
        setConnected(false);
      } finally {
        pending = false;
      }
    }, 1800);
    return () => clearInterval(timer);
  }, [refresh, checkClis, task]);
  useEffect(() => {
    localStorage.setItem("superai-workspace", activeWs);
    if (connected) setSelected(current => sessions.some(session => session.id === current && session.wsId === activeWs) ? current : "");
    setTarget("active");
    setRuns([]);
  }, [activeWs]);
  useEffect(() => {
    if (visible.length && !visible.some((s) => s.id === selected))
      setSelected(visible[0].id);
  }, [visible, selected]);
  useEffect(() => {
    localStorage.setItem("superai-canvas-layout-v2", layout);
  }, [layout]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    localStorage.setItem("superai-preview", String(preview));
  }, [preview]);
  useEffect(() => {
    try { localStorage.setItem("superai-mode", mode); } catch {}
  }, [mode]);
  useEffect(() => {
    if (connected) void loadModels();
  }, [connected, loadModels]);
  useEffect(() => {
    setSessionSeat(seatFor(launchType, ""));
  }, [launchType, dialog]);
  useEffect(() => {
    if (!activeWs) return;
    let ignore = false;
    const load = async () => {
      try {
        const data = await api<Run[]>(`/api/conversations/${activeWs}`);
        if (!ignore) setRuns(data);
      } catch {}
    };
    void load();
    const timer = setInterval(load, 1000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [activeWs]);
  useEffect(() => saveVoiceSettings(voiceSettings), [voiceSettings]);
  // First launch: walk new users through Node, Git, CLI, project and login.
  useEffect(() => {
    if (setupShown.current || !connected || !clis.length) return;
    setupShown.current = true;
    let dismissed = false;
    try { dismissed = localStorage.getItem("superai-setup-dismissed") === "1"; } catch {}
    if (!dismissed && setupNeeded(clis, workspaces)) setDialog("setup");
  }, [connected, clis, workspaces]);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement;
    const panel = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!panel) return;
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    )).filter((element) => element.getClientRects().length > 0);
    (dialog === "session-delete" ? panel.querySelector<HTMLElement>(".dialog-footer .secondary") : controls()[0])?.focus();
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    panel.addEventListener("keydown", keepFocus);
    return () => {
      panel.removeEventListener("keydown", keepFocus);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [dialog]);
  const loadOpenCodeModels = useCallback(async () => {
    try {
      const data = await api<{ models: string[] }>("/api/opencode/models");
      const free = data.models.find((m) => m.startsWith('opencode/') && m.endsWith('-free')) || '';
      setOpenCodeModel((current) => current === 'auto' ? free : current);
      // First run: OpenCode starts on a free model until the user picks another one.
      const defaults = loadDefaults();
      if (free && !defaults.opencode) saveDefaults({ ...defaults, opencode: { model: free, effort: "" } });
    } catch (e) {
      setNotice((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (clis.some((c) => c.id === "opencode" && c.available))
      void loadOpenCodeModels();
  }, [clis, loadOpenCodeModels]);
  useEffect(() => {
    localStorage.setItem("superai-opencode-model", openCodeModel);
  }, [openCodeModel]);
  const openSession = (type?: string) => {
    if (type) setLaunchType(type);
    setCount(1);
    setLaunchPlan(null);
    setDialog("session");
  };
  const spawn = () =>
    task(async () => {
      if (!workspace) throw new Error("กรุณาสร้างโปรเจกต์ก่อน");
      const plan = launchPlan || [{ type: launchType, count }];
      if (plan.some(seat => seat.type === "opencode") && openCodeModel === "auto" && !(launchPlan ? loadDefaults().opencode?.model : sessionSeat.model)) throw new Error("กำลังตรวจรุ่น OpenCode กรุณารอ หรือเลือกรุ่นเอง");
      const totals = new Map<string, number>();
      for (const seat of plan) totals.set(seat.type, (totals.get(seat.type) || 0) + seat.count);
      for (const [type, amount] of totals) {
        const cli = clis.find(c => c.id === type);
        if (!cli?.available) throw new Error(`ไม่พบ CLI ${cli?.name || type} กรุณาติดตั้งก่อน`);
        const capacity = cli.maxSessions - sessions.filter(s => s.agentType === type && ["running", "stopping", "error"].includes(s.status)).length;
        if (amount > capacity) throw new Error(`${cli.name} เปิดเพิ่มได้อีก ${Math.max(0, capacity)} session`);
      }
      const remaining = plan.flatMap(seat => Array.from({ length: seat.count }, () => seat.type));
      let opened = 0;
      try {
        for (const type of [...remaining]) {
          const cli = clis.find(c => c.id === type)!;
            const chosen = !launchPlan && type === launchType ? sessionSeat : seatFor(type, "");
            const supportsModel = HEADLESS.includes(type);
            const session = await post<Session>("/api/terminals/spawn", {
              agentType: type, wsId: workspace.id,
              name: [cli.name, supportsModel && chosen.model].filter(Boolean).join(" · "),
              openCodeModel: type === "opencode" && !chosen.model && openCodeModel !== "auto" ? openCodeModel : undefined,
              ...(supportsModel ? { model: chosen.model, effort: chosen.effort } : {}),
              trustFolder: trustFolders,
            });
            if (session.status === "error") throw new Error(`เปิด ${cli.name} ไม่สำเร็จ กรุณาตรวจการติดตั้ง CLI`);
            setSelected(session.id);
            remaining.shift(); opened++;
        }
      } catch (e) {
        const pending = new Map<string, number>();
        remaining.forEach(type => pending.set(type, (pending.get(type) || 0) + 1));
        setLaunchPlan([...pending].map(([type, amount]) => ({ type, count: amount })));
        throw new Error(`เปิดสำเร็จ ${opened} session · เหลือ ${remaining.length} session ที่ยังไม่ได้เปิด ลองใหม่จะเปิดเฉพาะที่เหลือ: ${(e as Error).message}`);
      } finally {
        await refresh().catch(() => {
          setConnected(false);
          setError("อ่านสถานะล่าสุดไม่ได้ กำลังลองเชื่อมต่อใหม่ · session ที่เปิดสำเร็จยังทำงานอยู่");
        });
      }
      setMode("code");
      setDialog(null);
      setLaunchPlan(null);
      setNotice(`เปิดแล้ว ${launchTotal} session`);
    });
  const closeSession = (id: string) =>
    task(async () => {
      const result = await post(`/api/terminals/${id}/kill`);
      if (!result.success)
        throw new Error("ปิด session ไม่สำเร็จ กรุณาลองใหม่");
      await refresh();
    });
  const restartSession = useCallback((id: string) =>
    void task(async () => {
      await post(`/api/terminals/${id}/restart`);
      await refresh();
    }), [task, refresh]);
  const switchView = useCallback((id: string, view: "chat" | "terminal") =>
    void task(async () => {
      await post(`/api/terminals/${id}/view`, { view });
      await refresh();
    }), [task, refresh]);
  useEffect(() => {
    const opened = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      setMode("code"); setDialog(null);
      void refresh().then(() => setSelected(id), (e) => showError((e as Error).message));
    };
    window.addEventListener("superai:login-session", opened);
    return () => window.removeEventListener("superai:login-session", opened);
  }, [refresh, showError]);
  const retryRun = (previous: Run) => task(async () => {
    if (activeRun || busy) return;
    const created = await post<Run>(`/api/conversations/${previous.wsId}`, {
      mode: previous.mode, prompt: previous.prompt, attachments: previous.attachments || [],
      allowTools: previous.allowTools, main: previous.main, subagents: previous.subagents,
      panel: previous.panel?.map(answer => answer.seat), summarizer: previous.summarizer,
      summaryStyle: previous.summaryStyle,
    });
    // Apply the returned run before releasing shared busy state: all rows and Send stay locked.
    if (activeWsRef.current === previous.wsId) setRuns(current => [...current.filter(run => run.id !== created.id), created]);
  });
  /** `queue` (Ctrl+Enter): a chat that is still answering takes the message after its current turn. */
  const send = (queue = false) =>
    task(async () => {
      if (!draft.trim() && !attachments.items.length) return;
      let queuedCount = 0;
      if (!workspace) throw new Error("กรุณาสร้างโปรเจกต์ก่อน");
      // Save attached images/PDFs into <project>/.superai/attachments first.
      if (mode === "chat" && /^\/skills?\s*$/.test(draft.trim())) { setNotice("เลือก skill จากรายการเหนือช่องพิมพ์ แล้วระบุงานที่ต้องการ"); return; }
      const saved: SavedAttachment[] = [];
      for (const item of attachments.items)
        saved.push(await uploadAttachment(`/api/workspaces/${workspace.id}/attachments`, item.file));
      if (mode === "code") {
        const recipients =
          target === "all"
            ? running
            : running.filter(
                (s) => s.id === selected,
              );
        if (!recipients.length)
          throw new Error(
            "ไม่มี terminal ที่กำลังทำงาน กรุณาเปิด session ก่อน",
          );
        for (const recipient of recipients) {
          // A pane in chat view takes the message as a chat turn; files go along as paths.
          if (paneView(recipient) === "chat") {
            const text = draft.trim() || "ดูไฟล์แนบนี้";
            const prefs = chatPrefs(recipient.id);
            // Composer commands for one chat: handled by its controls, not sent to the AI.
            if (recipients.length === 1 && /^\/(skills?|login)\s*$/.test(text)) {
              sendChatCommand(recipient.id, text.startsWith("/login") ? "login" : "skills");
              if (text.startsWith("/login")) setDraft("");
              return;
            }
            if (recipients.length === 1 && text === "/model") throw new Error("เลือก Model จากช่องคำสั่งด้านล่าง ใช้กับข้อความถัดไป");
            if (prefs.blocked) throw new Error(`${recipient.name}: ${prefs.note || "กรุณาเข้าสู่ระบบก่อนส่งข้อความ"}`);
            if (recipients.length === 1 && /^\/skills?\s*$/.test(text)) { setDialog("skills"); setDraft(""); return; }
            const hasSkill = /(?:^|\s)\/(?:skill\s+)?([\w.:-]+)/.test(text);
            const skillId = prefs.skillId && hasSkill ? prefs.skillId : "";
            const result = await post<{ queued?: boolean }>(`/api/terminals/${recipient.id}/chat`, {
              text,
              model: prefs.model,
              effort: prefs.effort,
              permission: prefs.permission,
              ...(skillId ? { skillId } : {}),
              attachments: saved.map((file) => file.path),
              // Ctrl+Enter: wait behind a running turn instead of being refused.
              ...(queue ? { queue: true } : {}),
            });
            if (result.queued) queuedCount++;
            if (prefs.skillId) setChatPrefs(recipient.id, { skillId: "" });
            continue;
          }
          // Codex gets project-relative paths: typed ":" and "\" can be lost through ConPTY.
          const relative = attachMode(recipient.agentType) === "clipboard" && recipient.cwd === workspace.rootPath;
          const paths = saved.map((file) => formatPath(relative ? file.relativePath : file.path)).join("").trim();
          const result = await post(`/api/terminals/${recipient.id}/input`, {
            input: [draft.trim() || (paths ? "ดูไฟล์แนบนี้" : ""), paths].filter(Boolean).join(" ") + "\r",
          });
          if (!result.success)
            throw new Error(
              `ส่งไป ${recipient.name} ไม่สำเร็จ กรุณาตรวจ session`,
            );
        }
        setNotice(
          queuedCount
            ? "ต่อคิวแล้ว · ส่งเองเมื่องานก่อนหน้าเสร็จ"
            : target === "all"
              ? `ส่งให้ ${recipients.length} session ในโปรเจกต์นี้แล้ว`
              : "ส่งคำสั่งแล้ว",
        );
      } else {
        const prompt = draft.trim() || "ช่วยดูไฟล์แนบนี้";
        const files = saved.map((file) => file.path);
        if (mode === "agent") {
          if (!agentConfig) throw new Error("กรุณาเลือก Main และ Sub-agent ก่อน");
          await post(`/api/conversations/${workspace.id}`, { mode, prompt, attachments: files, allowTools, main: agentConfig.main, subagents: agentConfig.subagents });
        } else {
          if (!chatConfig) throw new Error("กรุณาเลือก AI ที่จะถามก่อน");
          await post(`/api/conversations/${workspace.id}`, { mode, prompt, attachments: files, panel: chatConfig.panel, summarizer: chatConfig.summarizer, summaryStyle: chatConfig.style });
        }
        setRuns(await api<Run[]>(`/api/conversations/${workspace.id}`));
      }
      setDraft("");
      attachments.clear();
    });
  useEffect(() => {
    const prepare = (event: Event) => {
      const detail = (event as CustomEvent<{text: string; sessionId?: string; expand?: boolean}>).detail;
      if (detail.sessionId) {
        const session = sessions.find(s => s.id === detail.sessionId);
        if (session?.wsId) setActiveWs(session.wsId);
        setMode("code"); setSelected(detail.sessionId); setTarget("active");
        setDraftFor(composerDraftKey(session?.wsId || activeWs, "code", detail.sessionId, "active"), detail.text);
      } else {
        setDraft(detail.text);
      }
      setComposerExpanded(detail.expand !== false);
      requestAnimationFrame(() => composer.current?.focus());
    };
    const changes = (event: Event) => {
      const id = (event as CustomEvent<{sessionId?: string}>).detail?.sessionId;
      const session = sessions.find(s => s.id === id);
      if (session?.wsId) setActiveWs(session.wsId);
      setDialog("changes");
    };
    const setup = () => setDialog("setup");
    const openLink = (event: Event) => {
      try {
        const href = (event as CustomEvent<{ href: string }>).detail.href;
        const target = parsePreviewTarget(href);
        setPreviewRequest({ id: crypto.randomUUID(), workspaceId: activeWs || undefined, target });
        setDockView('browser'); setPreview(true);
      } catch (error) { showError((error as Error).message); }
    };
    const openArtifactEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ title: string; language: string; content: string }>).detail;
      setPreviewRequest({
        id: crypto.randomUUID(),
        workspaceId: activeWs || undefined,
        target: { kind: 'artifact', title: detail.title, language: detail.language, content: detail.content },
      });
      setDockView('browser'); setPreview(true);
    };
    const reload = () => { if (activeWs) void api<Run[]>(`/api/conversations/${activeWs}`).then(setRuns, error => showError(error.message)); };
    window.addEventListener("superai:prepare-message", prepare);
    window.addEventListener("superai:show-changes", changes);
    window.addEventListener("superai:open-setup", setup);
    window.addEventListener('superai:open-preview-link', openLink);
    window.addEventListener('superai:open-artifact', openArtifactEvent);
    window.addEventListener("superai:refresh-runs", reload);
    return () => {
      window.removeEventListener("superai:prepare-message", prepare);
      window.removeEventListener("superai:show-changes", changes);
      window.removeEventListener("superai:open-setup", setup);
      window.removeEventListener('superai:open-preview-link', openLink);
      window.removeEventListener('superai:open-artifact', openArtifactEvent);
      window.removeEventListener("superai:refresh-runs", reload);
    };
  }, [sessions, activeWs, showError, setDraft, setDraftFor]);
  useEffect(() => {
    const handlePaletteKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handlePaletteKey);
    return () => window.removeEventListener('keydown', handlePaletteKey);
  }, []);
  useEffect(() => { if (historyRun && runs.some(run => run.id === historyRun)) { document.getElementById('run-' + historyRun)?.scrollIntoView({ block: 'start' }); setHistoryRun(''); } }, [historyRun, runs]);
  const openHistoryEntry = (entry: HistoryEntry) => {
    setActiveWs(entry.wsId); setMode(entry.mode); setDialog(null);
    if (entry.sessionId) { setSelected(entry.sessionId); setTarget("active"); try { localStorage.setItem('superai-jump:' + entry.sessionId, entry.id); window.dispatchEvent(new CustomEvent('superai:jump-message', {detail:entry.sessionId})); } catch {} }
    else setHistoryRun(entry.id);
  };
  const dropTarget = useWindowDrop(attachToComposer, connected && !dialog);
  const interrupt = () =>
    task(async () => {
      if (mode !== "code" && activeRun) {
        await post(`/api/runs/${activeRun.id}/cancel`);
        setNotice("ส่งคำขอยกเลิกงานแล้ว");
      } else {
        const recipients =
          target === "all"
            ? running
            : running.filter(
                (s) => s.id === selected,
              );
        if (!recipients.length) throw new Error("ไม่มี session ที่กำลังทำงาน");
        for (const s of recipients) {
          if (paneView(s) === "chat") {
            await post(`/api/terminals/${s.id}/chat/cancel`);
            continue;
          }
          const r = await post(`/api/terminals/${s.id}/input`, {
            input: "\u0003",
          });
          if (!r.success) throw new Error("ส่งคำสั่งหยุดไม่สำเร็จ");
        }
        setNotice("ส่ง Ctrl+C ให้ session ที่เลือกแล้ว");
      }
    });
  const folder = () =>
    task(async () => {
      const value = await window.superai?.pickFolder();
      if (value) {
        setProjectPath(value);
        if (!projectName)
          setProjectName(
            value.split(/[\\/]/).filter(Boolean).at(-1) || "โปรเจกต์",
          );
      }
    });
  const saveProject = () =>
    task(async () => {
      if (!projectName.trim() || !projectPath.trim())
        throw new Error("กรุณาระบุชื่อและโฟลเดอร์โปรเจกต์");
      const result = await api<Workspace>(
        editing ? `/api/workspaces/${editing}` : "/api/workspaces",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            name: projectName.trim(),
            rootPath: projectPath.trim(),
            instructions: projectInstructions.trim(),
          }),
        },
      );
      await refresh();
      setActiveWs(result.id);
      setDialog(null);
      setNotice(editing ? "แก้ไขโปรเจกต์แล้ว" : "เพิ่มโปรเจกต์แล้ว");
    });
  const openProject = (ws?: Workspace) => {
    setEditing(ws?.id || "");
    setProjectName(ws?.name || "");
    setProjectPath(ws?.rootPath || "");
    setProjectInstructions(ws?.instructions || "");
    setMenu("");
    setDialog("project");
  };
  const openSettings = () => {
    setDialog("settings");
    void loadModels();
    void checkClis().catch((e) => setError(e.message));
  };
  const closeSetup = () => {
    try { localStorage.setItem("superai-setup-dismissed", "1"); } catch {}
    setDialog(null);
  };
  const closeDialog = () => (dialog === "setup" ? closeSetup() : setDialog(null));

  return (
    <div className={`app-shell ${window.superai?.platform === "darwin" ? "platform-mac" : ""}`}>
      <ComposerDropOverlay active={dropTarget === "composer"} />
      <header className="titlebar app-drag">
        <div className="brand">
          <img className="brand-logo" src="/brand/mark.png" alt="" draggable={false} />
          <img className="brand-wordmark" src="/brand/wordmark.png" alt="SuperAi & RAKKYXD" draggable={false} />
        </div>
        <div className="titlebar-project">
          <span className={`status-dot ${connected ? "" : "offline"}`} />
          {connected ? "พื้นที่ทำงานของคุณ" : "กำลังเชื่อมต่อใหม่"}
        </div>
            <nav className="mode-switch" aria-label="โหมดทำงาน">
              {(["agent", "code", "chat"] as Mode[]).map((m) => (
                <button
                  key={m}
                  className={mode === m ? "active" : ""}
                  onClick={() => { setMode(m); if (m === "agent") setPreview(false); }}
                >
                  {m === "code" ? (
                    <Code2 size={15} />
                  ) : m === "chat" ? (
                    <MessageSquare size={15} />
                  ) : (
                    <Bot size={15} />
                  )}
                  <span>{modeLabels[m]}</span>
                </button>
              ))}
            </nav>
      </header>
      <div className="workspace-shell">
        {sidebar && (
          <aside className="project-sidebar">
            <div className="sidebar-heading">
              <span>พื้นที่ทำงาน</span>
              <button
                className="icon-button"
                title="ซ่อนแถบโปรเจกต์"
                onClick={() => setSidebar(false)}
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <button className="new-project" onClick={() => openProject()}>
              <Plus size={16} /> เพิ่มโปรเจกต์{" "}
            </button>
            <label className="project-search">
              <Search size={14} />
              <input
                placeholder="ค้นหาโปรเจกต์"
                aria-label="ค้นหาโปรเจกต์"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="project-list">
              {workspaces
                .filter((w) =>
                  w.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((ws) => {
                  const entries = sessions.filter((s) => s.wsId === ws.id);
                  return (
                    <div className="project-group" key={ws.id}>
                      <div
                        className={`project-row ${activeWs === ws.id ? "active" : ""}`}
                      >
                        <button
                          className="project-select"
                          onClick={() => {
                            setActiveWs(ws.id);
                            setMenu("");
                          }}
                          title={ws.rootPath}
                        >
                          {activeWs === ws.id ? (
                            <ChevronDown size={13} />
                          ) : (
                            <ChevronRight size={13} />
                          )}
                          <Folder size={16} />
                          <span>{ws.name}</span>
                          {entries.filter((s) => s.status === "running")
                            .length > 0 && (
                            <small>
                              {
                                entries.filter((s) => s.status === "running")
                                  .length
                              }
                            </small>
                          )}
                        </button>
                        <button
                          className="icon-button project-more"
                          title={`จัดการโปรเจกต์ ${ws.name}`}
                          onClick={() => setMenu(menu === ws.id ? "" : ws.id)}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </div>
                      {menu === ws.id && (
                        <div className="project-menu">
                          <button onClick={() => openProject(ws)}>
                            <Pencil size={13} /> แก้ไขชื่อ / คำสั่งประจำโปรเจกต์
                          </button>
                          <button
                            className="danger-text"
                            onClick={() => {
                              setEditing(ws.id);
                              setDialog("delete");
                              setMenu("");
                            }}
                          >
                            <Trash2 size={13} /> ลบจากรายการ
                          </button>
                        </div>
                      )}
                      {activeWs === ws.id && (
                        <div className="project-sessions">
                          {entries.map((s) => (
                            <div key={s.id} className="sidebar-session-row">
                              <button
                                className={`sidebar-session ${s.id === selected && mode === "code" ? "active" : ""}`}
                                onClick={() => {
                                  setSelected(s.id);
                                  setMode("code");
                                }}
                              >
                                {paneView(s) === "chat" ? <MessageSquare size={13} /> : <Terminal size={13} />}
                                <span>{s.name}</span>
                                <span
                                  className={`status-dot ${s.status === "running" || paneView(s) === "chat" ? "" : s.status === "error" ? "bad" : "offline"}`}
                                />
                              </button>
                              <button
                                className="sidebar-session-delete"
                                title={`ลบ ${s.name}`}
                                aria-label={`ลบ ${s.name}`}
                                disabled={busy}
                                onClick={() => {
                                  setDeleteSession({id: s.id, name: s.name}); setDialog("session-delete");
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          <button
                            className="add-session-link"
                            onClick={() => openSession()}
                          >
                            <Plus size={13} /> เปิด session ใหม่
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              {!workspaces.length && (
                <p className="sidebar-empty">
                  เพิ่มโฟลเดอร์โปรเจกต์เพื่อเริ่มทำงาน
                </p>
              )}
            </div>
            <div className="sidebar-bottom"><button onClick={() => setDialog("history")}><Search size={17} /> ค้นหาประวัติ</button>
              <button onClick={() => setDialog("setup")} title="ตรวจความพร้อมและตั้งค่าเริ่มต้น">
                <Rocket size={17} />
                <span>
                  เริ่มต้นใช้งาน<small>ตรวจ Node, Git, CLI และบัญชี</small>
                </span>
              </button>
              <button onClick={() => setDialog("skills")} disabled={!workspace} title="ให้ AI เสนอ skill ที่จำเป็นต่อโปรเจกต์นี้">
                <Puzzle size={17} />
                <span>Skills<small>AI เสนอ คุณกดติดตั้ง</small></span>
              </button>
              <button onClick={openSettings}>
                <Settings size={17} />
                <span>การตั้งค่า</span>
              </button>
              {update && (
                <button onClick={() => setDialog("update")} className={update.status === "available" || update.status === "ready" ? "update-ready" : ""}
                  title="ตรวจและติดตั้งเวอร์ชันใหม่จาก GitHub Releases">
                  {update.status === "checking" ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : update.status === "latest" ? (
                    <Check size={17} />
                  ) : (
                    <Download size={17} />
                  )}
                  <span>
                    {update.status === "available"
                      ? `อัปเดตเป็น v${update.latestVersion}`
                      : update.status === "ready"
                      ? "พร้อมติดตั้งอัปเดต"
                      : update.status === "checking"
                      ? "กำลังตรวจอัปเดต…"
                      : update.status === "latest"
                      ? "เวอร์ชันล่าสุดแล้ว"
                      : "อัปเดตโปรแกรม"}
                    <small>{update.status === "downloading" ? `กำลังดาวน์โหลด ${update.progress || 0}%` : `เวอร์ชัน ${update.currentVersion}`}</small>
                  </span>
                  {(update.status === "available" || update.status === "ready") && <span className="update-dot" aria-label="มีอัปเดตใหม่" />}
                </button>
              )}
            </div>
          </aside>
        )}
        <div className="main-column">
          <div className="workspace-toolbar">
            <div className="breadcrumb">
              {!sidebar && (
                <button
                  className="icon-button"
                  title="แสดงแถบโปรเจกต์"
                  onClick={() => setSidebar(true)}
                >
                  <PanelLeftOpen size={17} />
                </button>
              )}
              <Folder size={15} />
              <span>{workspace?.name || "เริ่มต้นใช้งาน"}</span>
              <ChevronRight size={13} />
              <span className="dim">{modeLabels[mode]}</span>
            </div>

            <div className="toolbar-actions">
              <UsageButton open={usageOpen} onOpenChange={setUsageOpen} />
              <button className={`toolbar-button ${preview && dockView === "dashboard" ? "selected" : ""}`} title="เปิดแผงสถานะ" onClick={() => { setDockView("dashboard"); setPreview(true); }}><Activity size={14} /><span>สถานะ</span></button>
              <button
                aria-label="Preview" className={`toolbar-button ${preview ? "selected" : ""}`}
                onClick={() => { setDockView("browser"); setPreview(dockView === "browser" ? !preview : true); }}
              >
                <Globe size={15} />
                <span>เปิด Preview</span>
              </button>
              <button
                className="primary compact"
                aria-label="สร้าง session"
                title="สร้าง session"
                disabled={!workspace}
                onClick={() => openSession()}
              >
                <Plus size={15} />
                <span>เพิ่ม session</span>
              </button>
            </div>
          </div>
          <div className="canvas-row">
            <main className={`work-canvas ${mode === "code" ? "code-mode" : mode === "agent" ? "agent-mode" : ""}`}>
          {(error || notice) && (
            <div
              className={`message-banner ${error ? "error" : ""}`}
              role={error ? "alert" : "status"}
            >
              {error ? <AlertCircle size={16} /> : <Check size={16} />}
              <span>{error || notice}{error && <small className="banner-guidance">{recoveryHint(error)}<button onClick={() => {setComposerExpanded(true);requestAnimationFrame(() => composer.current?.focus());}}>กลับไปแก้ข้อความ</button><button onClick={() => setDialog("setup")}>ตรวจบัญชีและเครื่องมือ</button></small>}</span>
              <button
                className="icon-button"
                title="ปิดข้อความแจ้งเตือน"
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}
              <div className="canvas-heading">
                <div>
                  <span className="section-icon">
                    {mode === "code" ? (
                      <Terminal size={16} />
                    ) : mode === "agent" ? (
                      <Layers size={16} />
                    ) : (
                      <MessageSquare size={16} />
                    )}
                  </span>
                  <h1>
                    {mode === "code"
                      ? "ห้องทำงาน"
                      : mode === "agent"
                        ? "ทีม Agent"
                        : "ถามหลาย AI"}
                  </h1>
                  <span className="count-badge">
                    {mode === "code"
                      ? `${visible.length} session`
                      : `${conversation.length} งาน`}
                  </span>
                </div>
                <div className="inline">
                  {mode === "code" ? (
                    <>
                      <span className="running-label">
                        <span className="status-dot" />
                        {running.length} กำลังทำงาน
                      </span>
                      {zoomed && (
                        <button className="text-button" onClick={() => setZoomed(false)} title="กลับการจัดวางเดิม">
                          <Minimize2 size={14} /> กลับการจัดวางเดิม
                        </button>
                      )}
                      <div className="layout-switch" role="group" aria-label="การจัดวาง session">
                        {([
                          ["auto", "จัดพอดีจอ", SlidersHorizontal],
                          ["tabs", "เต็มพื้นที่", PanelTop],
                          ["stack", "เรียงแนวตั้ง", Rows2],
                          ["split", "แบ่งสองคอลัมน์", LayoutGrid],
                        ] as const).map(([value, label, Icon]) => (
                          <button key={value} className="icon-button" title={label}
                            aria-pressed={!zoomed && layout === value}
                            onClick={() => { setLayout(value); setZoomed(false); }}>
                            <Icon size={16} />
                          </button>
                        ))}
                      </div>
                      <select className="column-select" aria-label="จำนวนคอลัมน์" value={layout} onChange={e => { setLayout(e.target.value as CanvasLayout); setZoomed(false); }}>
                        <option value="auto">อัตโนมัติ</option><option value="tabs">เต็มพื้นที่</option><option value="stack">แนวตั้ง</option><option value="split">2 คอลัมน์</option><option value="3">3 คอลัมน์</option><option value="4">4 คอลัมน์</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <button className="text-button" onClick={() => setDialog("skills")} disabled={!workspace} title="ให้ AI เลือก skill ที่จำเป็นต่อโปรเจกต์">
                        <Puzzle size={13} /> Skills
                      </button>
                      <button className="text-button" onClick={openSettings}>
                        model และ effort เริ่มต้น
                        <ChevronDown size={13} />
                      </button>
                      <button
                        className="icon-button"
                        title="ล้างประวัติ Agent และ Chat ของโปรเจกต์"
                        disabled={!!activeRun || !runs.length}
                        onClick={() => setDialog("clear")}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div
                className={`code-workspace ${mode !== "code" ? "not-visible" : ""}`}
              >
                {visible.length > 0 ? (
                  <SessionCanvas sessions={visible} workspaceId={activeWs} selected={selected} layout={layout} zoomed={zoomed} active={mode === "code"} busy={busy}
                    select={setSelected} zoom={id => { setSelected(id); setZoomed(true); }} close={closeSession} restart={restartSession} add={openSession} switchView={switchView}
                    refresh={() => void refresh().catch(() => {})} onError={showError} />
                ) : (
                  <WorkspaceWelcome clis={clis} openSession={openSession} onMode={setMode} />
                )}
              </div>
              {mode !== "code" && (
                <div className="conversation-scroll">
                  {mode === "agent" ? (
                    <AgentConfigEditor key={`agent-${activeWs}`} workspaceId={activeWs} clis={clis} ollamaModels={models} disabled={!!activeRun} runCount={conversation.length} onChange={setAgentConfig} onFixTools={() => openSession()} />
                  ) : (
                    <ChatConfigEditor key={`chat-${activeWs}`} workspaceId={activeWs} clis={clis} ollamaModels={models} disabled={!!activeRun} runCount={conversation.length} onChange={setChatConfig} value={chatConfig} />
                  )}
                  {!conversation.length ? (
                    <div className="conversation-empty compact">
                      <div className="empty-command">
                        {mode === "agent" ? <Users size={26} /> : <MessageSquare size={26} />}
                      </div>
                      <h2>{mode === "agent" ? "บอกเป้าหมาย แล้วให้ทีมแบ่งงานกันทำ" : "พิมพ์คำถามครั้งเดียว ได้ความเห็นจากทุก AI"}</h2>
                      <p>
                        {mode === "agent"
                          ? "พิมพ์เป้าหมายและเกณฑ์ตรวจรับด้านล่าง Main จะแจกงานให้ Sub-agent และคุณจะเห็นว่าแต่ละตัวกำลังทำอะไร"
                          : "แต่ละ AI ตอบแยกกัน แล้วผู้สรุปจะรวมผลพร้อมบอกว่าใครแนะนำอะไร"}
                      </p>
                    </div>
                  ) : (
                    conversation.map((run) => (
                      <article className="conversation-run" id={`run-${run.id}`} key={run.id}>
                        <div className={`user-message ${run.mode === "agent" ? "mission-brief" : ""}`}>
                          <span className="message-author">
                            คุณ{" "}
                            <time>
                              {new Date(run.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                            </time>
                          </span>
                          <p>{run.prompt}</p>
                          <MessageAttachments paths={run.attachments} endpoint={`/api/workspaces/${encodeURIComponent(run.wsId)}/preview-file`} />
                        </div>
                        {run.mode === "chat" && run.panel ? <ChatRunView run={run} /> : run.main ? <AgentRunView run={run} onFixTools={() => setDialog("setup")} /> : null}
                        {(!run.main && (run.mode === "agent" || !run.panel)) && (
                          <div className="assistant-message">
                            <div className="message-author">
                              <img className="small-brand" src="/brand/mark.png" alt="" />{" "}
                              SuperAi{" "}
                              <span className={`run-state ${run.status === "failed" ? "danger-text" : ""}`}>
                                {run.status === "running" && <LoaderCircle size={12} className="spin" />}
                                {statusText[run.status]}
                              </span>
                            </div>
                            {run.output ? (
                              <Markdown text={run.output} />
                            ) : run.status === "running" ? (
                              <p className="muted">รอ Main สรุปเมื่อ Sub-agent ทำงานเสร็จ…</p>
                            ) : null}
                          </div>
                        )}
                        <RunActions run={run} blocked={!!activeRun || busy} onRetry={retryRun} />
                        {run.id === latestRun?.id && !activeRun && <NextSteps items={suggestions} disabled={busy} onSelect={text => { setDraft(text); requestAnimationFrame(() => composer.current?.focus()); }} />}
                        {run.error && <div className="inline-error" role="alert">{run.error}<button className="secondary" onClick={() => setDialog("setup")}>ตรวจเครื่องมือและบัญชี</button></div>}
                      </article>
                    ))
                  )}
                </div>
              )}
              <div className={`composer-area ${mode === "code" && !composerExpanded ? "compact-code" : ""}`}>
                <div className="composer-context-tags">
                  {workspace?.instructions && (
                    <button
                      type="button"
                      className="composer-instructions-pill"
                      title={`คำสั่งประจำโปรเจกต์: ${workspace.instructions} (คลิกเพื่อแก้ไข)`}
                      onClick={() => openProject(workspace)}
                    >
                      <Sparkles size={12} />
                      <span>กฎโปรเจกต์: {workspace.instructions}</span>
                    </button>
                  )}
                  {workspace?.pinnedFiles && workspace.pinnedFiles.length > 0 && (
                    <div className="composer-pinned-group">
                      <span className="pinned-label">
                        <Pin size={11} /> ปักหมุด ({workspace.pinnedFiles.length}):
                      </span>
                      {workspace.pinnedFiles.map((file) => {
                        const fileName = file.split(/[\\/]/).pop() || file;
                        return (
                          <span
                            key={file}
                            className="composer-pinned-chip"
                            title={`${file} (คลิกเพื่อเปิดดูใน Preview)`}
                          >
                            <span
                              className="pinned-chip-name"
                              onClick={() => {
                                setPreviewRequest({
                                  id: crypto.randomUUID(),
                                  workspaceId: workspace.id,
                                  target: { kind: "file", path: file },
                                });
                                setDockView("browser");
                                setPreview(true);
                              }}
                            >
                              {fileName}
                            </span>
                            <button
                              type="button"
                              className="pinned-chip-remove"
                              title={`เลิกปักหมุด ${file}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleTogglePin(file);
                              }}
                            >
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="composer-pin-picker-wrap">
                    <button
                      type="button"
                      className="composer-add-pin-btn"
                      title="ปักหมุดไฟล์เป็น Context ให้ AI อัตโนมัติ"
                      onClick={() => {
                        setPinnedPickerOpen((v) => {
                          const next = !v;
                          if (next) void loadProjectFiles();
                          return next;
                        });
                      }}
                    >
                      <Pin size={11} />
                      <span>+ ปักหมุดไฟล์</span>
                    </button>
                    {pinnedPickerOpen && (
                      <div className="composer-pin-dropdown">
                        <div className="pin-dropdown-header">
                          <input
                            type="text"
                            placeholder="ค้นหาไฟล์ในโปรเจกต์..."
                            value={pinnedSearch}
                            onChange={(e) => setPinnedSearch(e.target.value)}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="pin-close-btn"
                            onClick={() => setPinnedPickerOpen(false)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="pin-dropdown-list">
                          {projectFileList
                            .filter((f) =>
                              f.path.toLowerCase().includes(pinnedSearch.toLowerCase())
                            )
                            .slice(0, 30)
                            .map((f) => {
                              const isPinned = workspace?.pinnedFiles?.includes(f.path);
                              return (
                                <button
                                  key={f.path}
                                  type="button"
                                  className={`pin-dropdown-item ${isPinned ? "is-pinned" : ""}`}
                                  onClick={() => {
                                    void handleTogglePin(f.path);
                                  }}
                                >
                                  <span className="item-name">{f.name}</span>
                                  <span className="item-path">{f.path}</span>
                                  <span className="item-status">
                                    {isPinned ? "✓ ปักหมุดแล้ว" : "+ ปักหมุด"}
                                  </span>
                                </button>
                              );
                            })}
                          {projectFileList.length === 0 && (
                            <div className="pin-dropdown-empty">กำลังโหลดไฟล์หรือไม่มีไฟล์ในโปรเจกต์...</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Code mode has no row above the box: its target and size controls sit in the bottom row, like Claude's. */}
                {mode !== "code" && <div className="composer-context">
                  <div className="inline">
                    {(
                      <>
                        <Bot size={13} />
                        <span>
                          {mode === "agent"
                            ? `Main: ${agentConfig?.main.name || "-"} · Sub-agent ${agentConfig?.subagents.length || 0} ตัว`
                            : `ถาม ${chatConfig?.panel.length || 0} AI${chatConfig?.summarizer ? ` · สรุปโดย ${chatConfig.summarizer.name}` : ""}`}
                        </span>
                        {mode === "agent" && (
                          <label className="tool-permission">
                            <input
                              type="checkbox"
                              checked={allowTools}
                              onChange={(e) => setAllowTools(e.target.checked)}
                              disabled={!!activeRun}
                            />{" "}
                            อนุญาตให้ Sub-agent แก้ไฟล์และรันคำสั่ง
                          </label>
                        )}
                      </>
                    )}
                  </div>
                </div>}
                <div className={`composer-box ${chatTarget ? "has-session-controls" : ""}`}>
                  {mode === "chat" && chatConfig && workspace && <ChatQuickControls workspaceId={workspace.id} config={chatConfig} onChange={setChatConfig} clis={clis} ollamaModels={models} disabled={!!activeRun || busy} onDraft={setDraft} />}
                  {chatTarget && <SessionChatControls key={chatTarget.id} sessionId={chatTarget.id} name={chatTarget.name.split("·")[0].trim() || chatTarget.name} disabled={busy} />}
                  <AttachmentCards items={attachments.items} onRemove={attachments.remove} disabled={busy} />
                  <div className="composer-input-container">
                    <SlashMenu ref={slashMenu} draft={draft} sessionId={chatTarget?.id} workspaceId={mode === "chat" ? workspace?.id : undefined} providers={mode === "chat" ? [...new Set((chatConfig?.panel || []).filter(seat => seat.provider.startsWith("cli:")).map(seat => seat.provider.slice(4)))] : []} onDraft={text => { setDraft(text); requestAnimationFrame(() => composer.current?.focus()); }} />
                    <MentionMenu ref={mentionMenu} draft={draft} workspaceId={workspace?.id} onDraft={text => { setDraft(text); requestAnimationFrame(() => composer.current?.focus()); }} />
                    <textarea
                      ref={composer}
                      rows={mode === "code" && !composerExpanded ? 1 : 3}
                      aria-label="คำสั่ง"
                      placeholder={
                        mode === "code"
                            ? target === "all" ? `พิมพ์ข้อความถึงทุก session (${running.length})…` : composerTarget ? `พิมพ์ข้อความถึง ${composerTarget.name.split("·")[0].trim()}…` : "คลิกเลือก session ก่อนพิมพ์…"
                            : mode === "agent"
                              ? "บอกเป้าหมายให้ทีม เช่น ทำหน้าเข้าสู่ระบบพร้อมทดสอบ…"
                              : "ถามคำถามเดียว ส่งให้ทุก AI ที่เลือก…"
                      }
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                      }}
                      onPaste={(e) => {
                        const files = pastedFiles(e.clipboardData);
                        if (!files.length) return;
                        e.preventDefault();
                        attachToComposer(files);
                      }}
                      onKeyDown={(e) => {
                        if (slashMenu.current?.keyDown(e)) return;
                        if (mentionMenu.current?.keyDown(e)) return;
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          void send(mode === "code" && (e.ctrlKey || e.metaKey));
                        }
                      }}
                    />
                  </div>
                  <div className="composer-bottom">
                    <div className="composer-tools">
                    <AttachMenu onFiles={attachToComposer} disabled={!workspace} />
                    {mode === "code" && (
                      <button className="icon-button" title={composerExpanded ? "ย่อช่องคำสั่ง" : "ขยายช่องคำสั่ง"}
                        aria-expanded={composerExpanded} onClick={() => setComposerExpanded(!composerExpanded)}>
                        {composerExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      </button>
                    )}
                    {/* Only worth showing when there is more than one session to send to. */}
                    {mode === "code" && (running.length > 1 || target !== "active") && (
                      <select
                        className="composer-target"
                        aria-label="เป้าหมายคำสั่ง"
                        value={target}
                        title={target === "all" ? `ส่งถึงทุก session ในโปรเจกต์นี้ (${running.length})` : `ส่งถึง ${selectedSession?.name || "session ที่เลือก"}`}
                        onChange={(e) => setTarget(e.target.value === "all" ? "all" : "active")}
                      >
                        <option value="active">
                          ที่เลือก
                        </option>
                        <option value="all">
                          ทุก session
                        </option>
                      </select>
                    )}
                    <span>
                      {mode === "code" ? (
                        <>
                          <Terminal size={12} />
                          {workspace?.name || "ยังไม่มีโปรเจกต์"}
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={12} />{" "}
                          ใช้บัญชีและโควตาของแต่ละ CLI
                        </>
                      )}
                    </span>
                    </div>
                    <div className="inline">
                      <DictationButton
                        settings={voiceSettings}
                        onSettingsChange={setVoiceSettings}
                        onError={showError}
                        onText={(text) => {
                          setDraft((current) => (current.trim() ? `${current.replace(/\s+$/, "")} ${text}` : text));
                          requestAnimationFrame(() => composer.current?.focus());
                        }}
                      />
                      <button
                        className="icon-button"
                        title={
                          mode === "code"
                            ? "หยุดคำสั่ง (Ctrl+C)"
                            : "หยุดงานของ AI ทุกตัว"
                        }
                        disabled={
                          busy ||
                          (mode === "code" ? !running.length : !activeRun)
                        }
                        onClick={interrupt}
                      >
                        <Square size={14} />
                      </button>
                      <button
                        className="send-button"
                        aria-label="ส่งคำสั่ง (Enter)" title="ส่งคำสั่ง (Enter)"
                        disabled={
                          busy ||
                          (!draft.trim() && !attachments.items.length) ||
                          !workspace ||
                          (mode !== "code" && !!activeRun)
                        }
                        onClick={() => send()}
                      >
                        {busy ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : (
                          <Send size={16} />
                        )}
                        <span className="send-label">ส่ง</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="composer-hint">
                  <span>Enter ส่ง{mode === "code" ? " · Ctrl+Enter ต่อคิว" : ""} · Shift + Enter ขึ้นบรรทัดใหม่ · Ctrl+U แนบรูปหรือ PDF</span>
                  <span>ตรวจคำสั่งก่อนส่งเสมอ</span>
                </div>
              </div>
            </main>
            <RightDock open={preview} view={dockView} setView={setDockView} close={() => setPreview(false)} suspended={!!dialog || usageOpen}
              workspace={workspace} workspaces={workspaces} sessions={sessions} runs={runs} selected={selected} previewRequest={previewRequest}
              onSelect={session => { setActiveWs(session.wsId || activeWs); setSelected(session.id); setMode("code"); }}
              onPrompt={text => { setDraft(current => current ? `${current}\n${text}` : text); requestAnimationFrame(() => composer.current?.focus()); }} onError={showError} />
          </div>
          <footer className="statusbar">
            <span className={`status-dot ${connected ? "" : "offline"}`} />
            {connected ? "เชื่อมต่อแล้ว" : "เชื่อมต่อขาดหาย"}
            <span className="footer-divider" />
            <span>
              {pty ? "PTY พร้อมใช้" : "โหมด pipe · CLI บางตัวอาจไม่รองรับ"}
            </span>
            <span className="push path-text" title={workspace?.rootPath}>
              {workspace?.rootPath || "ยังไม่มีโปรเจกต์"}
            </span>
            <span className="footer-divider" />
            <span>ภาษาไทย</span>
          </footer>
        </div>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        workspaces={workspaces}
        activeWs={activeWs}
        onSelectWorkspace={(wsId) => {
          setActiveWs(wsId);
        }}
        sessions={sessions}
        selectedSession={selected}
        onSelectSession={(sessId) => {
          setSelected(sessId);
          setMode("code");
        }}
        onAction={(actionName) => {
          if (actionName === "session") setDialog("session");
          else if (actionName === "project") openProject();
          else if (actionName === "settings") openSettings();
          else if (actionName === "history") setDialog("history");
          else if (actionName === "changes") setDialog("changes");
          else if (actionName === "setup") setDialog("setup");
          else if (actionName === "preview") {
            setDockView("browser");
            setPreview(true);
          }
        }}
      />
      {dialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) closeDialog();
          }}
        >
          <section
            className={`dialog ${dialog === "setup" ? "setup-dialog" : ""} ${dialog === "settings" || dialog === "skills" || dialog === "history" || dialog === "changes" ? "settings-dialog" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) { e.stopPropagation(); closeDialog(); }
            }}
          >
            <div className="dialog-heading">
              <div>
                <h2 id="dialog-title">
                  {dialog === "history" ? "ค้นหาประวัติบทสนทนา" : dialog === "changes" ? "ไฟล์ที่เปลี่ยนและผลงาน" : dialog === "session-delete" ? "ลบ session นี้?" : dialog === "session"
                    ? "เปิด session ใหม่"
                    : dialog === "settings"
                      ? "การตั้งค่าพื้นที่ทำงาน"
                      : dialog === "project"
                        ? editing
                          ? "แก้ไขโปรเจกต์"
                          : "เพิ่มโปรเจกต์"
                        : dialog === "delete"
                          ? "ลบโปรเจกต์จากรายการ?"
                          : dialog === "setup"
                            ? "เริ่มต้นใช้งาน SuperAi"
                            : dialog === "skills"
                              ? "Skills ของโปรเจกต์"
                              : dialog === "update"
                                ? "อัปเดตโปรแกรม"
                              : "ล้างประวัติ Agent และ Chat?"}
                </h2>
                <p>
                  {dialog === "session"
                    ? "เลือก CLI, model, effort และจำนวนแท็บที่ต้องการ"
                    : dialog === "settings"
                      ? "ตรวจเครื่องมือ และเลือก model กับ effort เริ่มต้นของแต่ละผู้ให้บริการ"
                      : dialog === "project"
                        ? "เลือกโฟลเดอร์ที่ใช้ทำงานจริงบนเครื่อง"
                        : dialog === "setup"
                          ? "ตรวจเครื่องมือ บัญชี และค่าเริ่มต้นก่อนเริ่มงาน"
                          : dialog === "skills"
                            ? `${workspace?.name || ""} · AI เสนอ คุณเป็นคนกดติดตั้ง`
                            : dialog === "update"
                              ? "ดาวน์โหลดเวอร์ชันใหม่จาก GitHub Releases แล้วติดตั้งทับให้เอง"
                            : dialog === "history" ? "ค้นหาข้อความและคำตอบที่บันทึกไว้ แล้วเปิดกลับไปทำงานต่อ" : dialog === "changes" ? "ตรวจไฟล์และ diff ของโปรเจกต์ หรือเปิดตัวอย่างผลงาน" : "กรุณาตรวจสอบก่อนดำเนินการ"}
                </p>
              </div>
              <button
                className="icon-button"
                title="ปิดหน้าต่าง"
                aria-label="ปิดหน้าต่าง"
                disabled={busy}
                onClick={closeDialog}
              >
                <X size={18} />
              </button>
            </div>
            {error && (
              <div className="dialog-error" role="alert">
                <AlertCircle size={15} />
                {dialog === "setup" ? "ดำเนินการไม่สำเร็จ กรุณาตรวจเครื่องมือหรือลองใหม่" : error}
              </div>
            )}
            {dialog === "history" && <HistoryPanel workspaces={workspaces} sessions={sessions} onSelect={openHistoryEntry} />}
            {dialog === "changes" && workspace && <ChangesPanel workspaceId={workspace.id} onPreview={() => { setDialog(null); setDockView("browser"); setPreview(true); }} />}
            {dialog === "session-delete" && deleteSession && <><p className="confirm-description"><strong>{deleteSession.name}</strong><br />ประวัติแชตใน session นี้จะถูกลบด้วย</p><div className="dialog-footer"><button className="secondary" autoFocus onClick={closeDialog}>ยกเลิก</button><button className="danger-button" disabled={busy} onClick={() => { closeSession(deleteSession.id); setDialog(null); }}>ลบ session</button></div></>}
            {dialog === "session" && (
              <>
                <CliInstaller clis={clis} onRefresh={checkClis} onError={showError}/>
                <LaunchPresets clis={clis} type={launchType} count={count} onChoose={setLaunchPlan} onError={showError} />
                {launchPlan && <div className="launch-plan"><strong>ชุดที่จะเปิด: {launchPlan.map(seat => `${clis.find(c => c.id === seat.type)?.name || seat.type} ×${seat.count}`).join(" + ")}</strong><button className="text-button" onClick={() => setLaunchPlan(null)}>เลือกเอง</button></div>}
                <div className="cli-options">
                  {clis.map((c) => {
                    const active = sessions.filter(
                      (s) => s.agentType === c.id && s.status === "running",
                    ).length;
                    return (
                      <button
                        className={`cli-option ${launchType === c.id ? "selected" : ""}`}
                        key={c.id}
                        onClick={() => {
                          setLaunchType(c.id);
                          setLaunchPlan(null);
                          setCount(1);
                        }}
                      >
                        <div className="agent-monogram">
                          {c.id === "terminal" ? (
                            <Terminal size={20} />
                          ) : (
                            c.name[0]
                          )}
                        </div>
                        <span>
                          <strong>{c.name}</strong>
                          <small>
                            {c.available
                              ? c.id === "freebuff"
                                ? `เปิดได้ 1 session · ใช้อยู่ ${active}`
                                : `พร้อมใช้ · กำลังทำงาน ${active}`
                              : "ไม่พบคำสั่งในเครื่อง"}
                          </small>
                        </span>
                        {launchType === c.id ? (
                          <Check size={17} />
                        ) : (
                          <span
                            className={`status-dot ${c.available ? "" : "offline"}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                {!launchPlan && launchCli?.available && launchType !== "terminal" && <OutdatedNotice key={launchType} cliId={launchType} onError={showError} />}
                {!launchPlan && HEADLESS.includes(launchType) && launchCli?.available && (
                  <div className="session-model">
                    <SeatPicker named={false} fixedProvider label={launchCli.name} clis={clis} ollamaModels={[]} seat={sessionSeat} onChange={setSessionSeat} />
                    <small className="muted">เว้นว่างเพื่อใช้ค่าเริ่มต้นที่ตั้งไว้ใน CLI · เปลี่ยนภายหลังได้ด้วยคำสั่ง /model ของ CLI นั้น</small>
                  </div>
                )}
                <div className="dialog-field-row">
                  <label>
                    จำนวน session
                    <select
                      value={count}
                      onChange={(e) => { setLaunchPlan(null); setCount(Number(e.target.value)); }}
                    >
                      {Array.from(
                        { length: Math.min(6, launchCli?.maxSessions || 1) },
                        (_, i) => (
                          <option key={i} value={i + 1}>
                            {i + 1} session
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <p>
                    แต่ละ session ทำงานในโฟลเดอร์
                    <br />
                    <strong>{workspace?.name}</strong>
                  </p>
                </div>
                {launchCli && !launchCli.available && (
                  <p className="inline-error">
                    ยังไม่ได้ติดตั้ง {launchCli.name} ติดตั้ง CLI
                    แล้วกดตรวจสอบเครื่องมือในตั้งค่า
                  </p>
                )}
                <div className="dialog-footer">
                  <button className="secondary" onClick={() => setDialog(null)}>
                    ยกเลิก
                  </button>
                  <button
                    className="primary"
                    disabled={busy || (launchPlan ? launchPlan.some(seat => !clis.find(c => c.id === seat.type)?.available) : !launchCli?.available)}
                    onClick={spawn}
                  >
                    {busy ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <Plus size={15} />
                    )}{" "}
                    เปิด {launchTotal} session
                  </button>
                </div>
              </>
            )}
            {dialog === "setup" && (
              <>
                <SetupGuide clis={clis} workspaces={workspaces} voice={voiceSettings} refreshClis={checkClis} onError={showError}
                  addProject={() => openProject()} installCli={() => openSession()} openSkills={() => setDialog("skills")}
                  login={(id) => { void task(() => loginProvider(id, { wsId: workspace?.id || workspaces[0]?.id })); }} />
                <div className="dialog-footer">
                  <span className="muted">เปิดหน้านี้อีกครั้งได้จากแถบซ้าย “เริ่มต้นใช้งาน”</span>
                  <button className="primary" onClick={closeSetup}>เสร็จแล้ว <Check size={15} /></button>
                </div>
              </>
            )}
            {dialog === "update" && (
              <>
                <div className="settings-content">
                  <UpdatePanel state={update} onError={showError} />
                </div>
                <div className="dialog-footer">
                  <span className="muted">ตรวจให้เองตอนเปิดโปรแกรมและทุก 30 นาที</span>
                  <button className="primary" onClick={() => setDialog(null)}>ปิด <Check size={15} /></button>
                </div>
              </>
            )}
            {dialog === "skills" && (
              <>
                <div className="settings-content">
                  <SkillsPanel workspace={workspace} clis={clis} ollamaModels={models} onError={showError} onNotice={setNotice} />
                </div>
                <div className="dialog-footer">
                  <span className="muted">ตรวจไฟล์ของ skill บน GitHub ได้ก่อนติดตั้ง</span>
                  <button className="primary" onClick={() => setDialog(null)}>เสร็จแล้ว <Check size={15} /></button>
                </div>
              </>
            )}
            {dialog === "project" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveProject();
                }}
              >
                <div className="dialog-fields">
                  <label>
                    ชื่อโปรเจกต์
                    <input
                      autoFocus
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="เช่น เว็บไซต์ร้านของฉัน"
                      required
                    />
                  </label>
                  <label>
                    โฟลเดอร์โปรเจกต์
                    <div className="input-action">
                      <input
                        aria-label="โฟลเดอร์โปรเจกต์"
                        value={projectPath}
                        onChange={(e) => setProjectPath(e.target.value)}
                        placeholder="D:\Projects\my-app"
                        required
                      />
                      {window.superai && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={folder}
                        >
                          <FolderPlus size={16} /> เลือก
                        </button>
                      )}
                    </div>
                  </label>
                  <label>
                    คำสั่งประจำโปรเจกต์ (Custom Instructions)
                    <textarea
                      rows={3}
                      value={projectInstructions}
                      onChange={(e) => setProjectInstructions(e.target.value)}
                      placeholder="เช่น ตอบเป็นภาษาไทยเสมอ, เน้นเขียน TypeScript + React, ห้ามใช้ any..."
                    />
                  </label>
                  {editing && (
                    <p className="muted">
                      session ที่เปิดอยู่จะใช้โฟลเดอร์เดิมจนกว่าจะเปิด session
                      ใหม่
                    </p>
                  )}
                </div>
                <div className="dialog-footer">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setDialog(null)}
                  >
                    ยกเลิก
                  </button>
                  <button className="primary" disabled={busy} type="submit">
                    {busy ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <Check size={15} />
                    )}{" "}
                    บันทึกโปรเจกต์
                  </button>
                </div>
              </form>
            )}
            {dialog === "settings" && (
              <>
                <div className="mission-settings">
<nav className="settings-nav" aria-label="หมวดการตั้งค่า">{[["tools", "เครื่องมือ AI"], ["models", "Model และ Effort"], ["folders", "โฟลเดอร์"], ["voice", "เสียง"]].map(([id, label]) => <button key={id} aria-current={settingsTab === id ? "page" : undefined} onClick={() => setSettingsTab(id)}>{label}</button>)}</nav>
<div className="settings-content"><section hidden={settingsTab !== "tools"}>
                  <div className="settings-section-title">
                    <h3>เครื่องมือ CLI</h3>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        task(async () => {
                          await checkClis();
                          setNotice("ตรวจสอบเครื่องมือแล้ว");
                        })
                      }
                    >
                      <RefreshCw size={13} /> ตรวจสอบอีกครั้ง
                    </button>
                  </div>
                  <p className="muted">
                    ใช้บัญชีและขั้นตอนเข้าสู่ระบบของแต่ละ CLI เปิด session
                    แล้วทำตามคำแนะนำของเครื่องมือนั้นได้เลย
                  </p>
                  <div className="cli-status-list">
                    {clis.map((c) => (
                      <div key={c.id}>
                        <span>{c.name}</span>
                        <code>{c.command}</code>
                        <span className={c.available ? "success-text" : "dim"}>
                          {c.available ? "พร้อมใช้งาน" : "ยังไม่ติดตั้ง"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <CliVersionsPanel onError={showError} /></section><section hidden={settingsTab !== "folders"}>
                  <div className="settings-section-title">
                    <h3>โฟลเดอร์โปรเจกต์</h3>
                  </div>
                  <label className="tool-permission settings-toggle">
                    <input type="checkbox" checked={trustFolders} onChange={(e) => setTrustFolders(e.target.checked)} />
                    เชื่อถือโฟลเดอร์โปรเจกต์ให้ CLI อัตโนมัติ (ไม่ต้องตอบ “trust this folder” ทุกครั้งที่เปิดแท็บ)
                  </label>
                  <p className="muted">
                    ใช้กับ Claude Code, Codex และ Antigravity เฉพาะโฟลเดอร์ที่คุณเพิ่มเป็นโปรเจกต์ เทียบเท่ากับการกด “Yes, I trust this folder” เอง
                    ปิดไว้ถ้าต้องการให้ CLI ถามก่อนทุกครั้ง
                  </p>
                  </section><section hidden={settingsTab !== "models"}><div className="settings-section-title">
                    <h3>model และ effort เริ่มต้น</h3>
                  </div>
                  <p className="muted">
                    ใช้เป็นค่าตั้งต้นทุกครั้งที่เลือก AI ในโหมด Agent, Chat และเปิดแท็บในโหมด Code (เปลี่ยนแยกแต่ละตัวได้ภายหลัง) ·
                    เว้นว่างเพื่อใช้ค่าที่ตั้งไว้ใน CLI · ค่าใช้จ่ายและโควตาขึ้นกับบัญชีของคุณ
                  </p>
                  <ProviderDefaults clis={clis} />
                  <div className="settings-section-title">
                    <h3>Ollama บนเครื่อง (ไม่บังคับ)</h3>
                    <button className="text-button" disabled={checkingModels} onClick={loadModels}>
                      <RefreshCw className={checkingModels ? "spin" : ""} size={13} /> ตรวจ model
                    </button>
                  </div>
                  <p className="muted">
                    {modelError ? modelError : models.length ? `พบ ${models.length} รุ่น: ${models.slice(0, 6).join(", ")} · เลือกได้ในช่องผู้ให้บริการ “Ollama บนเครื่อง”` : "ยังไม่พบ model"}
                  </p>
                  <div className="setup-command">
                    <Terminal size={14} />
                    <code>ollama pull qwen2.5-coder:7b</code>
                    <button
                      className="text-button"
                      onClick={() => {
                        setDraftFor(composerDraftKey(activeWs, "code", selected, target), "ollama pull qwen2.5-coder:7b");
                        setMode("code");
                        setDialog(null);
                      }}
                    >
                      ใส่ในช่องคำสั่ง
                    </button>
                  </div>
                  </section><section hidden={settingsTab !== "voice"}><VoiceSettingsPanel settings={voiceSettings} onChange={setVoiceSettings} /></section></div>
                </div>
                <div className="dialog-footer">
                  <span className="muted">บันทึกการตั้งค่าอัตโนมัติ</span>
                  <button className="primary" onClick={() => setDialog(null)}>
                    เสร็จแล้ว <Check size={15} />
                  </button>
                </div>
              </>
            )}
            {(dialog === "delete" || dialog === "clear") && (
              <>
                <p className="confirm-description">
                  {dialog === "delete"
                    ? `ลบ “${workspaces.find((w) => w.id === editing)?.name}” จากรายการและปิด session ที่เกี่ยวข้อง ไฟล์ในโฟลเดอร์จะยังอยู่`
                    : "ล้างประวัติ Agent และ Chat ทั้งหมดของโปรเจกต์นี้ การล้างไม่ลบไฟล์โปรเจกต์"}
                </p>
                <div className="dialog-footer">
                  <button className="secondary" onClick={() => setDialog(null)}>
                    ยกเลิก
                  </button>
                  <button
                    className="danger-button"
                    disabled={busy}
                    onClick={() =>
                      task(async () => {
                        if (dialog === "delete") {
                          await api(`/api/workspaces/${editing}`, {
                            method: "DELETE",
                          });
                          await refresh();
                        } else {
                          await api(`/api/conversations/${activeWs}`, {
                            method: "DELETE",
                          });
                          setRuns([]);
                        }
                        setDialog(null);
                        setNotice(
                          dialog === "delete"
                            ? "ลบจากรายการแล้ว"
                            : "ล้างประวัติแล้ว",
                        );
                      })
                    }
                  >
                    <Trash2 size={15} />
                    {dialog === "delete" ? "ลบจากรายการ" : "ล้างประวัติ"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      <UpdatePrompt state={update} onError={showError} onDetails={() => setDialog("update")} />
    </div>
  );
}
