import { toastRecovery } from "./recovery";
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
  Layers,
  Rocket,
  Puzzle,
  Download,
  Users,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { api, post, Workspace, Cli, Session, Run, Seat, togglePinnedFile } from "./api";
import { MessageContextChips } from './components/MessageContextChips';
import { contextPrompt, saveMessageContexts } from './conversationContext';
import { useResponseStyle } from './responseStyle';
import { ResponseStyleSelect } from './components/ResponseStyleSelect';
import { ComposerOptions } from './components/ComposerOptions';
import { ProjectContextStatus } from './components/ProjectContextStatus';
import { ConversationExport } from './components/ConversationExport';
import { namedSessions, sessionAliases } from './sessionNames';
import { Star } from 'lucide-react';
import './usability.css';
import { paneView } from "./paneView";
import { chatPrefs, sendChatCommand, setChatPrefs } from "./chatControls";
import { SessionChatControls } from "./components/SessionChatControls";
import { ComposerLocation } from "./components/ComposerLocation";
import { SessionCanvas, type CanvasLayout } from "./components/SessionCanvas";
import { RightDock, type DockView } from "./components/RightDock";
import { parsePreviewTarget, type PreviewRequest, renderTextWithLinks, findUrlAtPosition, extractUrls, openExternalLink } from './previewLinks';
import { AgentConfigEditor, AgentRunView, type AgentConfig } from "./components/AgentPanel";
import { ChatConfigEditor, ChatRunView, type ChatConfig } from "./components/ChatPanel";
import { SkillsPanel } from "./components/SkillsPanel";
import { UpdatePanel, UpdatePrompt, useUpdateState } from "./components/UpdatePanel";
import { UsageButton } from "./components/UsagePanel";
import { CliVersionsPanel, OutdatedNotice } from "./components/CliVersions";
import { ProviderDefaults } from "./components/ProviderDefaults";
import { SeatPicker } from "./components/SeatPicker";
import { Markdown } from "./components/Markdown";
import { ImageEndpointContext } from "./components/MarkdownImage";
import { HEADLESS, loadDefaults, saveDefaults, seatFor, confirmDefaults } from "./providers";
import { CliInstaller } from "./components/CliInstaller";
import { LaunchPresets, type LaunchSeat } from "./components/LaunchPresets";
import { VoiceSettingsPanel } from "./components/VoiceSettingsPanel";
import { NotifySettingsPanel } from "./components/NotifySettingsPanel";
import { McpManagerPanel } from "./components/McpManagerPanel";
import { finishedRuns, notifyDone, onNoticeOpen, runNotice } from "./completionNotify";
import { onChatRunning, onNextPrompt } from "./nextPrompt";
import { DictationButton } from "./components/DictationButton";
import { AttachMenu, AttachmentCards, ComposerDropOverlay, useComposerAttachments, useWindowDrop } from "./components/ComposerAttachments";
import { attachMode, formatPath, pastedFiles, uploadAttachment, type SavedAttachment } from "./attachments";
import { SetupGuide, setupNeeded } from "./components/SetupGuide";
import { loadVoiceSettings, saveVoiceSettings, type VoiceSettings } from "./voice/speech";
import { getSuggestions } from "./suggestions";
import { NextSteps } from "./components/NextSteps";
import { MessageAttachments } from "./components/MessageAttachments";
import { WorkspaceWelcome } from "./components/WorkspaceWelcome";
import { QuickChatControls } from "./components/QuickChatControls";
import { ProviderBadge } from "./components/ProviderBadge";
import { providerIdentity } from "./providerIdentity";
import { firstReady } from "./providers";
import { loadQuickConversationState, saveQuickConversationState, type PendingQuickConversation } from "./quickConversationState";
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
  const [quickState] = useState(loadQuickConversationState);
  const [selected, setSelected] = useState(() => initial("superai-selected", ""));
  const newConversationWorkspace = useRef<string | null>(quickState.pending?.wsId || (quickState.aliases[activeWs] ? activeWs : null));
  useEffect(() => { try { localStorage.setItem("superai-selected", selected); } catch {} }, [selected]);
  const [historyRun, setHistoryRun] = useState("");
  const [mode, setMode] = useState<Mode>(() => {
    const saved = initial("superai-mode", "code");
    return saved === "agent" || saved === "chat" ? saved : "code";
  });
  const [preview, setPreview] = useState(
    initial("superai-preview", "false") === "true",
  );
  const [sidebar, setSidebar] = useState(true);
  const [layout, setLayout] = useState<CanvasLayout>(() => {
    const saved = initial("superai-canvas-layout-v2", "tabs");
    return ["auto", "tabs", "stack", "split", "3", "4"].includes(saved) ? saved as CanvasLayout : "tabs";
  });
  const [zoomed, setZoomed] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [composerPanelOpen, setComposerPanelOpen] = useState(false);
  useEffect(() => { setComposerPanelOpen(false); }, [activeWs, selected, mode]);
  const [dockView, setDockView] = useState<DockView>("browser");
  const [previewRequest, setPreviewRequest] = useState<PreviewRequest>();
  const [launchPlan, setLaunchPlan] = useState<LaunchSeat[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [returnToSetup, setReturnToSetup] = useState(false);
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
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [answerStyle, setAnswerStyle] = useResponseStyle(mode === 'code' ? 'quick-chat' : `${activeWs}:${mode}`);
  const [target, setTarget] = useState<"active" | "all">("active");
  // Alias only the first app-managed workspace to its originating draft; other projects stay isolated.
  const starterDraftScopes = useRef(new Map<string, string>(Object.entries(quickState.aliases)));
  const draftScope = mode === "code" && !selected && target === "active"
    ? starterDraftScopes.current.get(activeWs) || composerDraftKey(activeWs, mode, selected, target)
    : composerDraftKey(activeWs, mode, selected, target);
  const { draft, setDraft, setDraftFor } = useComposerDrafts(draftScope);
  const [quickChoice, setQuickChoice] = useState(() => initial("superai-quick-provider", ""));
  const quickProvider = clis.some(cli => cli.id === quickChoice && cli.available && HEADLESS.includes(cli.id)) ? quickChoice : firstReady(clis);
  const sending = useRef(false);
  const pendingQuick = useRef<PendingQuickConversation | undefined>(quickState.pending);
  const chooseQuickProvider = (id: string) => {
    newConversationWorkspace.current = activeWs;
    setQuickChoice(id);
    try { localStorage.setItem("superai-quick-provider", id); } catch {}
    requestAnimationFrame(() => composer.current?.focus());
  };
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
  const [projectFileList, setProjectFileList] = useState<string[]>([]);
  const pinPickerWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pinnedPickerOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (pinPickerWrapRef.current && !pinPickerWrapRef.current.contains(e.target as Node)) {
        setPinnedPickerOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinnedPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [pinnedPickerOpen]);

  const loadProjectFiles = useCallback(async () => {
    if (!workspace) return;
    try {
      const res = await api<{ files: string[] }>(`/api/workspaces/${workspace.id}/files`);
      setProjectFileList(Array.isArray(res.files) ? res.files : []);
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
  const [hiddenSessions, setHiddenSessions] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("superai-hidden-sessions") || "[]");
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("superai-hidden-sessions", JSON.stringify(hiddenSessions));
    } catch {}
  }, [hiddenSessions]);
  const workspaceSessions = sessions.filter((s) => s.wsId === activeWs);
  const visible = workspaceSessions.filter((s) => !hiddenSessions.includes(s.id));
  const hiddenInWorkspace = workspaceSessions.filter((s) => hiddenSessions.includes(s.id));
  const hideSession = useCallback((id: string) => {
    setHiddenSessions((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (selected === id) {
      const nextVisible = workspaceSessions.find((s) => s.id !== id && !hiddenSessions.includes(s.id));
      setSelected(nextVisible?.id || "");
      setZoomed(false);
    }
    setNotice("ซ่อน session พับเก็บไว้แล้ว · คลิกชื่อในแถบซ้ายหรือแถบด้านบนเพื่อเปิดกลับมาได้ตลอดเวลา");
  }, [selected, workspaceSessions, hiddenSessions]);
  const unhideSession = useCallback((id: string) => {
    setHiddenSessions((prev) => prev.filter((item) => item !== id));
    setSelected(id);
    setMode("code");
  }, []);
  const unhideAllWorkspaceSessions = useCallback(() => {
    const wsIds = new Set(workspaceSessions.map((s) => s.id));
    setHiddenSessions((prev) => prev.filter((id) => !wsIds.has(id)));
  }, [workspaceSessions]);
  const selectedSession = visible.find((s) => s.id === selected);
  // Chat sessions take messages without a running terminal.
  const running = visible.filter((s) => s.status === "running" || paneView(s) === "chat");
  // The one chat session the composer sends to gets its Model/Effort/skills/account controls there.
  const composerTarget = target === "all" ? undefined : selectedSession;
  const chatTarget = mode === "code" && composerTarget && paneView(composerTarget) === "chat" ? composerTarget : undefined;
  const [nextPrompts, setNextPrompts] = useState<Record<string, string>>({});
  useEffect(() => onNextPrompt((sessionId, text) => setNextPrompts(current => ({ ...current, [sessionId]: text }))), []);
  const nextPrompt = chatTarget && !draft ? nextPrompts[chatTarget.id] || "" : "";
  const [chatsRunning, setChatsRunning] = useState<Record<string, boolean>>({});
  useEffect(() => onChatRunning((sessionId, value) => setChatsRunning(current => current[sessionId] === value ? current : { ...current, [sessionId]: value })), []);
  const chatBusy = !!chatTarget && !!chatsRunning[chatTarget.id];
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
    setSessions(namedSessions(s));
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
    if (visible.length && !visible.some((s) => s.id === selected) && (selected || (newConversationWorkspace.current !== activeWs && !starterDraftScopes.current.has(activeWs))))
      setSelected(visible[0].id);
  }, [visible, selected, activeWs]);
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
  const runStatuses = useRef(new Map<string, Run["status"]>());
  useEffect(() => {
    for (const run of finishedRuns(runStatuses.current, runs))
      notifyDone(runNotice(run, workspaces.find(w => w.id === run.wsId)?.name));
  }, [runs]);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  useEffect(() => onNoticeOpen(target => {
    if (target.kind === "run") { setActiveWs(target.wsId); setMode(target.mode); return; }
    const session = sessionsRef.current.find(s => s.id === target.id);
    if (!session) return;
    if (session.wsId) setActiveWs(session.wsId);
    setMode("code");
    setSelected(session.id);
  }), []);
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
      if (
        previous instanceof HTMLElement &&
        previous.isConnected &&
        !document.activeElement?.closest("[data-terminal-pane]")
      ) {
        previous.focus();
      }
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
        setMode("code");
        setDialog(null);
        setLaunchPlan(null);
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
      setNotice(`เปิดแล้ว ${launchTotal} session`);
    });
  const closeSession = (id: string) =>
    task(async () => {
      const result = await post(`/api/terminals/${id}/kill`);
      if (!result.success)
        throw new Error("ปิด session ไม่สำเร็จ กรุณาลองใหม่");
      if (pendingQuick.current?.session.id === id) {
        pendingQuick.current = undefined;
        saveQuickConversationState(starterDraftScopes.current);
      }
      setHiddenSessions((prev) => prev.filter((item) => item !== id));
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
        summaryStyle: previous.summaryStyle, responseStyle: previous.responseStyle,
    });
    // Apply the returned run before releasing shared busy state: all rows and Send stay locked.
    if (activeWsRef.current === previous.wsId) setRuns(current => [...current.filter(run => run.id !== created.id), created]);
  });
  /** `queue` (Ctrl+Enter): a chat that is still answering takes the message after its current turn. */
  const send = async (queue = false) => {
    if (sending.current) return;
    sending.current = true;
    try { await task(async () => {
      if (!draft.trim() && !attachments.items.length) return;
      if (mode === "code" && target === "active" && !composerTarget) {
        if (!quickProvider) throw new Error("ยังไม่มี AI พร้อมใช้ เปิดเริ่มต้นใช้งานเพื่อติดตั้งและเชื่อมบัญชีก่อน");
        const ws = workspace || await post<Workspace>("/api/workspaces/quick-chat");
        if (!workspace) {
          starterDraftScopes.current.set(ws.id, draftScope);
          saveQuickConversationState(starterDraftScopes.current, pendingQuick.current);
        }
        newConversationWorkspace.current = ws.id;
        const chosen = seatFor(quickProvider, "");
        let session = pendingQuick.current?.wsId === ws.id && pendingQuick.current.session.agentType === quickProvider ? pendingQuick.current.session : undefined;
        if (!session) {
          session = await post<Session>("/api/terminals/spawn", { agentType: quickProvider, wsId: ws.id,
            name: draft.trim().split('\n')[0].slice(0, 60) || providerIdentity(quickProvider).label, model: chosen.model, effort: chosen.effort,
            view: "chat", trustFolder: false });
          if (session.status === "error") throw new Error(`เปิด ${providerIdentity(quickProvider).label} ไม่สำเร็จ ตรวจการติดตั้งแล้วลองอีกครั้ง`);
          pendingQuick.current = { session, wsId: ws.id };
          saveQuickConversationState(starterDraftScopes.current, pendingQuick.current);
          setChatPrefs(session.id, { model: chosen.model, effort: chosen.effort, permission: "read", responseStyle: answerStyle });
        }
        const files: SavedAttachment[] = [];
        for (const item of attachments.items) files.push(await uploadAttachment(`/api/workspaces/${ws.id}/attachments`, item.file));
        await post(`/api/terminals/${session.id}/chat`, { text: draft.trim() || "ดูไฟล์แนบนี้",
          model: chosen.model, effort: chosen.effort, permission: "read", responseStyle: answerStyle, attachments: files.map(file => file.path) });
        setChatPrefs(session.id, { responseStyle: answerStyle });
        const created = session;
        setWorkspaces(current => current.some(item => item.id === ws.id) ? current : [...current, ws]);
        setSessions(current => current.some(item => item.id === created.id) ? current : [...current, created]);
        setHiddenSessions(current => current.filter(id => id !== created.id));
        setActiveWs(ws.id); setSelected(created.id); setTarget("active");
        setDraft(""); attachments.clear(); pendingQuick.current = undefined; starterDraftScopes.current.delete(ws.id);
        saveQuickConversationState(starterDraftScopes.current);
        setNotice(`เริ่มคุยกับ ${providerIdentity(quickProvider).label} แล้ว`);
        return;
      }
      let queuedCount = 0, interruptedCount = 0;
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
            // Enter while the chat is answering stops that answer and sends this one at once.
            const result = await post<{ queued?: boolean; interrupted?: boolean }>(`/api/terminals/${recipient.id}/chat`, {
              text: contextPrompt(recipient.id, text),
              model: prefs.model,
              effort: prefs.effort,
              permission: prefs.permission,
              responseStyle: prefs.responseStyle,
              ...(skillId ? { skillId } : {}),
              attachments: saved.map((file) => file.path),
              // Ctrl+Enter: wait behind a running turn instead of being refused.
              ...(queue ? { queue: true } : {}),
            });
            if (result.queued) queuedCount++;
            if (result.interrupted) interruptedCount++;
            try { saveMessageContexts(recipient.id, []); }
            catch { setNotice('ส่งข้อความแล้ว แต่ล้างบริบทที่บันทึกไว้ไม่ได้ กรุณาเอาบริบทออกก่อนส่งครั้งถัดไป'); }
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
        // A chat shows its own message at once; only say something when the send did more than that.
        const sentNotice = queuedCount
          ? "ต่อคิวแล้ว · ส่งเองเมื่องานก่อนหน้าเสร็จ"
          : interruptedCount
            ? "หยุดคำตอบเดิม แล้วส่งข้อความใหม่ทันที"
            : target === "all"
              ? `ส่งให้ ${recipients.length} session ในโปรเจกต์นี้แล้ว`
              : recipients.every(r => paneView(r) === "chat") ? "" : "ส่งคำสั่งแล้ว";
        if (sentNotice) setNotice(sentNotice);
      } else {
        const prompt = draft.trim() || "ช่วยดูไฟล์แนบนี้";
        const files = saved.map((file) => file.path);
        if (mode === "agent") {
          if (!agentConfig) throw new Error("กรุณาเลือก Main และ Sub-agent ก่อน");
          await post(`/api/conversations/${workspace.id}`, { mode, prompt, attachments: files, allowTools, main: agentConfig.main, subagents: agentConfig.subagents, responseStyle: answerStyle });
        } else {
          if (!chatConfig) throw new Error("กรุณาเลือก AI ที่จะถามก่อน");
          await post(`/api/conversations/${workspace.id}`, { mode, prompt, attachments: files, panel: chatConfig.panel, summarizer: chatConfig.summarizer, summaryStyle: chatConfig.style, responseStyle: answerStyle });
        }
        setRuns(await api<Run[]>(`/api/conversations/${workspace.id}`));
      }
      setDraft("");
      attachments.clear();
    }); } finally { sending.current = false; }
  };
  useEffect(() => {
    const prepareComposer = (event: Event) => {
      const detail = (event as CustomEvent<{ text: string; mode?: Mode; sessionId?: string; expand?: boolean }>).detail;
      const targetMode: Mode = detail.mode || "code";
      setMode(targetMode);
      if (detail.sessionId) {
        const session = sessions.find((s) => s.id === detail.sessionId);
        if (session?.wsId) setActiveWs(session.wsId);
        setSelected(detail.sessionId);
        setTarget("active");
        setDraftFor(composerDraftKey(session?.wsId || activeWs, targetMode, detail.sessionId, "active"), detail.text);
      } else {
        setDraft(detail.text);
        if (activeWs) {
          setDraftFor(composerDraftKey(activeWs, targetMode, selected || "all", target), detail.text);
        }
      }
      setComposerExpanded(detail.expand !== false);
      requestAnimationFrame(() => composer.current?.focus());
    };
    const prepare = (event: Event) => {
      const detail = (event as CustomEvent<{text: string; sessionId?: string; expand?: boolean; append?: boolean}>).detail;
      if (detail.sessionId) {
        const session = sessions.find(s => s.id === detail.sessionId);
        if (session?.wsId) setActiveWs(session.wsId);
        setMode("code"); setSelected(detail.sessionId); setTarget("active");
        setDraftFor(composerDraftKey(session?.wsId || activeWs, "code", detail.sessionId, "active"), current => detail.append ? [current, detail.text].filter(Boolean).join('\n\n') : detail.text);
      } else {
        setDraft(current => detail.append ? [current, detail.text].filter(Boolean).join('\n\n') : detail.text);
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
    const forkCreated = (event: Event) => {
      const { session, sourceId, side } = (event as CustomEvent<{ session: Session; sourceId: string; side: boolean }>).detail;
      const sourcePrefs = chatPrefs(sourceId);
      setChatPrefs(session.id, { model: sourcePrefs.model, effort: sourcePrefs.effort, permission: sourcePrefs.permission, responseStyle: sourcePrefs.responseStyle });
      setSessions(current => current.some(item => item.id === session.id) ? current : [...current, session]);
      if (session.wsId) setActiveWs(session.wsId);
      setHiddenSessions(current => side
        ? [...new Set([...current, ...sessions.filter(item => item.wsId === session.wsId && item.id !== sourceId && item.id !== session.id).map(item => item.id)])].filter(id => id !== sourceId && id !== session.id)
        : current.filter(id => id !== session.id));
      setSelected(session.id); setTarget('active'); setMode('code'); setZoomed(false);
      setLayout(side ? 'split' : 'tabs');
      setNotice(side ? 'เปิด Side chat แล้ว · บริบทพร้อมสำหรับข้อความถัดไป' : 'สร้างห้องแยกพร้อมประวัติแล้ว · ห้องเดิมยังอยู่');
      requestAnimationFrame(() => composer.current?.focus());
    };
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
    window.addEventListener("superai:prepare-composer", prepareComposer);
    window.addEventListener("superai:prepare-message", prepare);
    window.addEventListener("superai:show-changes", changes);
    window.addEventListener("superai:open-setup", setup);
    window.addEventListener('superai:fork-created', forkCreated);
    window.addEventListener('superai:open-preview-link', openLink);
    window.addEventListener('superai:open-artifact', openArtifactEvent);
    window.addEventListener("superai:refresh-runs", reload);
    return () => {
      window.removeEventListener("superai:prepare-composer", prepareComposer);
      window.removeEventListener("superai:prepare-message", prepare);
      window.removeEventListener("superai:show-changes", changes);
      window.removeEventListener("superai:open-setup", setup);
      window.removeEventListener('superai:fork-created', forkCreated);
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
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input') return;
      const files = pastedFiles(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      attachToComposer(files);
      composer.current?.focus();
      setNotice(`แนบรูปภาพจากคลิปบอร์ดแล้ว (${files.length} ไฟล์)`);
    };
    window.addEventListener('keydown', handlePaletteKey);
    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('keydown', handlePaletteKey);
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [attachToComposer]);
  useEffect(() => { if (historyRun && runs.some(run => run.id === historyRun)) { document.getElementById('run-' + historyRun)?.scrollIntoView({ block: 'start' }); setHistoryRun(''); } }, [historyRun, runs]);
  const openHistoryEntry = (entry: HistoryEntry) => {
    setActiveWs(entry.wsId); setMode(entry.mode); setDialog(null);
    if (entry.sessionId) { setHiddenSessions(current => current.filter(id => id !== entry.sessionId)); setSelected(entry.sessionId); setTarget("active"); try { localStorage.setItem('superai-jump:' + entry.sessionId, entry.id); window.dispatchEvent(new CustomEvent('superai:jump-message', {detail:entry.sessionId})); } catch {} }
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
      setDialog(returnToSetup ? "setup" : null);
      setReturnToSetup(false);
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
  const closeDialog = () => {
    if (dialog === "project" && returnToSetup) { setReturnToSetup(false); setDialog("setup"); }
    else if (dialog === "setup") closeSetup();
    else setDialog(null);
  };
  const startFromSetup = async (type: string, wsId: string, text: string) => {
    const ws = workspaces.find(w => w.id === wsId);
    const cli = clis.find(c => c.id === type && c.available);
    if (!ws || !cli) throw new Error("ยังไม่พบโฟลเดอร์หรือผู้ช่วยที่เลือก กลับไปตรวจความพร้อมอีกครั้ง");
    let session = sessions.find(s => s.wsId === wsId && s.agentType === type && s.status === "running");
    if (!session) {
      const chosen = seatFor(type, "");
      session = await post<Session>("/api/terminals/spawn", { agentType: type, wsId, name: cli.name,
        ...(HEADLESS.includes(type) ? { model: chosen.model, effort: chosen.effort } : {}), trustFolder: trustFolders });
      if (session.status === "error") throw new Error(`เปิด ${cli.name} ไม่สำเร็จ ตรวจการติดตั้งและบัญชีแล้วลองอีกครั้ง`);
      const created = session;
      setSessions(current => current.some(s => s.id === created.id) ? current : [...current, created]);
    }
    setActiveWs(wsId); setSelected(session.id); setTarget("active"); setMode("code");
    if (text.trim()) setDraftFor(composerDraftKey(wsId, "code", session.id, "active"), current => current.trim() && current !== text ? `${current}\n\n${text}` : text);
    confirmDefaults(); closeSetup();
    await refresh().catch(() => showError("เปิดห้องคุยแล้ว แต่ยังอ่านสถานะล่าสุดไม่ได้ กรุณาตรวจการเชื่อมต่อ"));
    requestAnimationFrame(() => composer.current?.focus());
  };

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
                  aria-label={modeLabels[m]}
                  aria-pressed={mode === m}
                  title={m === "agent" ? "ให้ทีม AI แบ่งงานและลงมือทำ" : m === "code" ? "คุยกับผู้ช่วย AI และทำงานกับไฟล์" : "ถามหลาย AI แล้วเปรียบเทียบคำตอบ"}
                  onClick={() => { setMode(m); if (m === "agent") setPreview(false); }}
                >
                  {m === "code" ? (
                    <Code2 size={15} />
                  ) : m === "chat" ? (
                    <MessageSquare size={15} />
                  ) : (
                    <Bot size={15} />
                  )}
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
            <button type="button" className="text-button favorite-filter" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><Star size={13} />โปรเจกต์โปรด</button>
            <div className="project-list">
              {favoritesOnly && !workspaces.some(item => item.favorite) && <p className="muted" style={{ padding: '8px 14px', fontSize: 12 }}>ยังไม่มีโปรเจกต์โปรด เพิ่มได้จากเมนู … ของโปรเจกต์</p>}
              {workspaces
                .filter((w) =>
                  w.name.toLowerCase().includes(search.toLowerCase()) && (!favoritesOnly || w.favorite === true),
                )
                .sort((a, b) => Number(b.favorite === true) - Number(a.favorite === true))
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
                          {ws.favorite && <Star size={12} className="project-favorite-mark" aria-label="โปรเจกต์โปรด" />}
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
                          <button onClick={() => void task(async () => {
                            const updated = await api<Workspace>(`/api/workspaces/${ws.id}`, { method: 'PATCH', body: JSON.stringify({ favorite: !ws.favorite }) });
                            setWorkspaces(current => current.map(item => item.id === ws.id ? updated : item)); setMenu('');
                          })}><Star size={13} />{ws.favorite ? 'เอาออกจากโปรเจกต์โปรด' : 'เพิ่มในโปรเจกต์โปรด'}</button>
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
                          {entries.map((s) => {
                            const isHidden = hiddenSessions.includes(s.id);
                            return (
                              <div key={s.id} className={`sidebar-session-row ${isHidden ? "is-hidden" : ""}`}>
                                <button
                                  className={`sidebar-session ${s.id === selected && mode === "code" && !isHidden ? "active" : ""} ${isHidden ? "is-hidden" : ""}`}
                                  title={isHidden ? `${s.name} (ซ่อนอยู่ · คลิกเพื่อเปิดกลับมาแสดงบนหน้าจอ)` : s.name}
                                  onClick={() => {
                                    unhideSession(s.id);
                                  }}
                                >
                                  <ProviderBadge provider={s.agentType} compact />
                                  <span className="sidebar-session-copy"><span>{s.name}</span><small>{providerIdentity(s.agentType).label}{paneView(s) === "terminal" ? ' · Terminal' : ''}</small></span>
                                  {isHidden && <small className="sidebar-hidden-badge">ซ่อนอยู่</small>}
                                  <span
                                    className={`status-dot ${s.status === "running" || paneView(s) === "chat" ? "" : s.status === "error" ? "bad" : "offline"}`}
                                  />
                                </button>
                                <button
                                  className={`sidebar-session-visibility ${isHidden ? "is-hidden" : ""}`}
                                  title={isHidden ? `แสดง ${s.name} บนหน้าจอ` : `ซ่อน ${s.name} พับเก็บไว้ก่อน`}
                                  aria-label={isHidden ? `แสดง ${s.name}` : `ซ่อน ${s.name}`}
                                  onClick={() => {
                                    if (isHidden) unhideSession(s.id);
                                    else hideSession(s.id);
                                  }}
                                >
                                  {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
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
                            );
                          })}
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
                  บทสนทนาแรกจะปรากฏที่นี่ · เริ่มพิมพ์ได้เลย
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
              {mode !== "code" && <><ChevronRight size={13} /><span className="dim">{modeLabels[mode]}</span></>}
              {mode === "code" && selectedSession && <><ChevronRight size={13} /><ProviderBadge provider={selectedSession.agentType} /><span className="conversation-title">{selectedSession.name}</span></>}
            </div>

            <div className="toolbar-actions">
              <UsageButton open={usageOpen} onOpenChange={setUsageOpen} />
              <button className={`toolbar-button ${preview && dockView === "dashboard" ? "selected" : ""}`} aria-label="สถานะ" title="เปิดแผงสถานะ" onClick={() => { setDockView("dashboard"); setPreview(true); }}><Activity size={16} /><span>สถานะ</span></button>
              <button className={`toolbar-button ${preview && dockView === "files" ? "selected" : ""}`} aria-label="ไฟล์" title="เปิดไฟล์และแก้ไขด่วน" onClick={() => { setDockView("files"); setPreview(dockView === "files" ? !preview : true); }}><Folder size={16} /><span>ไฟล์</span></button>
              <button
                aria-label="Preview" title="เปิด Preview" className={`toolbar-button ${preview && dockView === "browser" ? "selected" : ""}`}
                onClick={() => { setDockView("browser"); setPreview(dockView === "browser" ? !preview : true); }}
              >
                <Globe size={16} />
                <span>เปิด Preview</span>
              </button>
              <button
                className="secondary compact advanced-session-button"
                aria-label="สร้าง session"
                title="เปิด Terminal หรือหลายห้อง"
                disabled={!workspace}
                onClick={() => openSession()}
              >
                <Terminal size={16} />
                <span>Terminal / หลายห้อง</span>
              </button>
              <button className="primary compact" aria-label="บทสนทนาใหม่" title="บทสนทนาใหม่" disabled={busy} onClick={() => {
                newConversationWorkspace.current = activeWs;
                setMode("code"); setSelected(""); setTarget("active"); setZoomed(false);
                requestAnimationFrame(() => composer.current?.focus());
              }}><Plus size={15} /><span>คุยใหม่</span></button>
            </div>
          </div>
          <div className="canvas-row">
            <main className={`work-canvas ${mode === "code" ? "code-mode" : mode === "agent" ? "agent-mode" : ""}`}>
          {(error || notice) && (
            <div
              className={`message-banner ${error ? "error" : ""}`}
              role={error ? "alert" : "status"}
            >
              {error ? <AlertCircle size={15} /> : <Check size={15} />}
              <span>{error || notice}{error && (() => {
                const { hint, account } = toastRecovery(error);
                return (hint || account) && <small className="banner-guidance">{hint}{account && <button onClick={() => setDialog("setup")}>ตรวจบัญชี</button>}</small>;
              })()}</span>
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
              <div className={`canvas-heading ${mode === "code" && (!selectedSession || visible.length <= 1) && !hiddenInWorkspace.length && !zoomed ? "canvas-heading-quiet" : ""}`}>
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
                  {mode === "code" && hiddenInWorkspace.length > 0 && (
                    <div className="hidden-sessions-bar" role="group" aria-label="session ที่ซ่อนอยู่">
                      <span className="hidden-sessions-label">
                        <EyeOff size={12} /> ซ่อนอยู่ {hiddenInWorkspace.length}:
                      </span>
                      {hiddenInWorkspace.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="hidden-session-chip"
                          title={`คลิกเพื่อแสดง ${s.name} กลับมาบนหน้าจอ`}
                          onClick={() => unhideSession(s.id)}
                        >
                          <Eye size={11} />
                          <span>{s.name.split("·")[0].trim() || s.name}</span>
                        </button>
                      ))}
                      {hiddenInWorkspace.length > 1 && (
                        <button
                          type="button"
                          className="hidden-session-restore-all"
                          title="แสดงทุก session ที่ซ่อนอยู่ในโปรเจกต์นี้"
                          onClick={unhideAllWorkspaceSessions}
                        >
                          แสดงทั้งหมด
                        </button>
                      )}
                    </div>
                  )}
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
                      {mode === "agent" ? (
                        <AgentConfigEditor key={`agent-${activeWs}`} workspaceId={activeWs} clis={clis} ollamaModels={models} disabled={!!activeRun || busy} onChange={setAgentConfig} onFixTools={() => openSession()} />
                      ) : (
                        <ChatConfigEditor key={`chat-${activeWs}`} workspaceId={activeWs} clis={clis} ollamaModels={models} disabled={!!activeRun || busy} onChange={setChatConfig} />
                      )}
                      <button className="text-button" onClick={() => setDialog("skills")} disabled={!workspace} title="ให้ AI เลือก skill ที่จำเป็นต่อโปรเจกต์">
                        <Puzzle size={13} /> Skills
                      </button>
                      {workspace && <ConversationExport title={`${workspace.name}-${mode}`} workspaceId={workspace.id} mode={mode === 'agent' ? 'agent' : 'chat'} />}
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
                {workspaceSessions.length > 0 && selectedSession ? (
                  <SessionCanvas sessions={workspaceSessions} hiddenIds={hiddenSessions} workspaceId={activeWs} selected={selected} layout={layout} zoomed={zoomed} active={mode === "code"} busy={busy}
                    rename={async (id, name) => {
                      setError('');
                      const updated = await post<Session>(`/api/terminals/${id}/name`, { name });
                      const aliases = sessionAliases(); delete aliases[id];
                      try { localStorage.setItem('superai-pane-names', JSON.stringify(aliases)); } catch { /* The canonical name is already saved on the server. */ }
                      setSessions(current => current.map(item => item.id === id ? updated : item));
                    }}
                    select={setSelected} zoom={id => { setSelected(id); setZoomed(true); }}
                    hide={hideSession} unhide={unhideSession} unhideAll={unhideAllWorkspaceSessions}
                    close={closeSession} restart={restartSession} add={openSession} switchView={switchView}
                    refresh={() => void refresh().catch(() => {})} onError={showError} />
                ) : (
                  <WorkspaceWelcome clis={clis} openSession={openSession} onMode={setMode} provider={quickProvider} onProvider={chooseQuickProvider} disabled={busy} />
                )}
              </div>
              {mode !== "code" && (
                <ImageEndpointContext.Provider value={`/api/workspaces/${encodeURIComponent(activeWs)}/preview-file`}><div className="conversation-scroll">
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
                          <p>{renderTextWithLinks(run.prompt)}</p>
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
                </div></ImageEndpointContext.Provider>
              )}
              <div className={`composer-area composer-balanced ${mode === "code" && !composerExpanded ? "compact-code" : ""} ${chatTarget ? "chat-minimal" : ""} ${chatBusy || mode !== 'code' && activeRun ? "chat-busy" : ""} ${draft.trim() || attachments.items.length ? "has-draft" : ""}`}>
                <section className="composer-project-panel" aria-label="บริบทและการทำงาน" hidden={!composerPanelOpen} onKeyDown={event => {
                  if (event.key === 'Escape' && !event.defaultPrevented) {
                    event.stopPropagation();
                    if (pinnedPickerOpen) setPinnedPickerOpen(false);
                    else { setComposerPanelOpen(false); requestAnimationFrame(() => composer.current?.closest('.composer-area')?.querySelector<HTMLButtonElement>('.attach-menu > button')?.focus()); }
                  }
                }}>
                  <header><strong>บริบทและการทำงาน</strong><button type="button" aria-label="ปิดบริบทและการทำงาน" onClick={() => { setComposerPanelOpen(false); requestAnimationFrame(() => composer.current?.closest('.composer-area')?.querySelector<HTMLButtonElement>('.attach-menu > button')?.focus()); }}><X size={14} /></button></header>
                <div className="composer-context-tags">
                    {(mode !== 'code' || !composerTarget || chatTarget) && <ProjectContextStatus workspaceId={workspace?.id} sessionId={chatTarget?.id} revision={JSON.stringify([workspace?.instructions, workspace?.pinnedFiles])} />}
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
                  <div className="composer-pin-picker-wrap" ref={pinPickerWrapRef}>
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
                            .filter((filePath) =>
                              typeof filePath === "string" &&
                              filePath.toLowerCase().includes(pinnedSearch.toLowerCase())
                            )
                            .slice(0, 30)
                            .map((filePath) => {
                              const fileName = filePath.split(/[\\/]/).pop() || filePath;
                              const isPinned = Boolean(workspace?.pinnedFiles?.includes(filePath));
                              return (
                                <button
                                  key={filePath}
                                  type="button"
                                  className={`pin-dropdown-item ${isPinned ? "is-pinned" : ""}`}
                                  onClick={() => {
                                    void handleTogglePin(filePath);
                                  }}
                                >
                                  <span className="item-name">{fileName}</span>
                                  <span className="item-path">{filePath}</span>
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
                </section>
                <div className={`composer-box ${chatTarget ? "has-session-controls" : ""}`}>
                  <div className="composer-leading"><AttachMenu onFiles={attachToComposer} disabled={busy || (!workspace && mode !== "code")} actions={[
                    { label: 'บริบทและไฟล์ปักหมุด', selected: composerPanelOpen, onSelect: () => setComposerPanelOpen(value => !value) },
                    ...(mode === 'code' && running.length || activeRun ? [{ label: 'หยุดงานปัจจุบัน', onSelect: interrupt }] : []),
                    ...(mode === 'code' ? [{ label: composerExpanded ? 'ย่อช่องพิมพ์' : 'ขยายช่องพิมพ์', selected: composerExpanded, onSelect: () => { setComposerExpanded(value => !value); requestAnimationFrame(() => composer.current?.focus()); } }] : []),
                    ...(nextPrompt ? [{ label: 'ใช้ข้อความแนะนำ (Tab)', onSelect: () => { setDraft(nextPrompt); requestAnimationFrame(() => composer.current?.focus()); } }] : []),
                  ]} /></div>
                  <div className="composer-attachments-row">
                  <AttachmentCards items={attachments.items} onRemove={attachments.remove} disabled={busy} />
                    {mode === 'code' && chatTarget && <MessageContextChips sessionId={chatTarget.id} />}
                  </div>
                  <div className="composer-input-container">
                    <SlashMenu ref={slashMenu} draft={draft} sessionId={chatTarget?.id} workspaceId={mode === "chat" ? workspace?.id : undefined} providers={mode === "chat" ? [...new Set((chatConfig?.panel || []).filter(seat => seat.provider.startsWith("cli:")).map(seat => seat.provider.slice(4)))] : []} onDraft={text => { setDraft(text); requestAnimationFrame(() => composer.current?.focus()); }} />
                    <MentionMenu ref={mentionMenu} draft={draft} workspaceId={workspace?.id} onDraft={text => { setDraft(text); requestAnimationFrame(() => composer.current?.focus()); }} />
                    <textarea
                      ref={composer}
                      rows={mode === "code" && !composerExpanded ? 1 : 3}
                      aria-label="คำสั่ง"
                      placeholder={mode === 'code' ? target === 'all' ? 'ส่งข้อความถึงทุกห้อง…' : 'พิมพ์ข้อความ…' : mode === 'agent' ? 'บอกสิ่งที่ต้องการให้ทีมทำ…' : 'ถาม AI ที่เลือก…'}
                      title={nextPrompt ? 'มีข้อความแนะนำ: กด Tab เพื่อใช้ หรือเปิดเมนู + เพื่อดูตัวเลือก' : 'Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่'}
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                      }}
                      onPaste={(e) => {
                        const files = pastedFiles(e.clipboardData);
                        if (!files.length) return;
                        e.preventDefault();
                        attachToComposer(files);
                        setNotice(`แนบรูปภาพจากคลิปบอร์ดแล้ว (${files.length} ไฟล์)`);
                      }}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          const textarea = e.currentTarget;
                          const pos = textarea.selectionStart;
                          const url = findUrlAtPosition(textarea.value, pos);
                          if (url) {
                            e.preventDefault();
                            openExternalLink(url);
                            setNotice(`เปิดลิงก์: ${url}`);
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (slashMenu.current?.keyDown(e)) return;
                        if (mentionMenu.current?.keyDown(e)) return;
                        if (e.key === "Tab" && !e.shiftKey && nextPrompt) {
                          e.preventDefault();
                          setDraft(nextPrompt);
                          return;
                        }
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
                        className="icon-button composer-stop"
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
                          (!workspace && mode !== "code") ||
                          (mode === "code" && !composerTarget && target === "active" && !quickProvider) ||
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
                <div className="composer-meta" aria-label="การตั้งค่าข้อความ">
                <ComposerLocation workspace={workspace} workspaces={workspaces} recipients={mode === 'code' ? target === 'all' ? running : composerTarget ? [composerTarget] : [] : undefined}
                  onSelectWorkspace={id => { setActiveWs(id); setTarget('active'); }} onOpenFolder={() => openProject()}
                  onSelectWorktree={rootPath => { void task(async () => {
                    const normalized = (value: string) => value.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
                    let item = workspaces.find(candidate => normalized(candidate.rootPath) === normalized(rootPath));
                    if (!item) { item = await post<Workspace>('/api/workspaces', { name: rootPath.split(/[\\/]/).filter(Boolean).pop() || 'Worktree', rootPath }); await refresh(); }
                    setActiveWs(item.id); setTarget('active');
                  }); }} />
                    {mode === "code" && (composerTarget || target === "all") && (running.length > 1 || target !== "active") && (
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
                  {chatTarget && <SessionChatControls key={chatTarget.id} sessionId={chatTarget.id} name={chatTarget.name} disabled={busy} />}
                  {mode === "code" && !composerTarget && target === "active" && <QuickChatControls clis={clis} provider={quickProvider} onProvider={chooseQuickProvider} disabled={busy} onSetup={() => setDialog("setup")} style={answerStyle} onStyle={setAnswerStyle} />}
                  {mode !== 'code' && <ComposerOptions label="ตัวเลือกคำตอบ"><ResponseStyleSelect value={answerStyle} onChange={setAnswerStyle} disabled={busy || !!activeRun} /></ComposerOptions>}
                  {mode === "code" && composerTarget && !chatTarget && <div className="terminal-provider-context"><ProviderBadge provider={composerTarget.agentType} /><span>{providerIdentity(composerTarget.agentType).connection}</span></div>}
                </div>
                {extractUrls(draft).length > 0 && (
                  <div className="composer-detected-links">
                    <span className="detected-links-label">🔗 ลิงก์ที่พบ:</span>
                    {extractUrls(draft).map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        className="composer-link-chip"
                        title={`คลิกหรือ Ctrl+Click ในช่องเพื่อเปิด ${url}`}
                        onClick={() => openExternalLink(url)}
                      >
                        <ExternalLink size={11} />
                        <span>{url.replace(/^https?:\/\//, '')}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="composer-hint">
                  <span>Enter ส่ง{chatTarget ? " (ขณะ AI ทำงาน = แทรกทันที) · Ctrl+Enter ต่อคิว" : mode === "code" ? " · Ctrl+Enter ต่อคิว" : ""} · Shift + Enter ขึ้นบรรทัดใหม่ · Ctrl+Click เพื่อเปิดลิงก์</span>
                  <span>ตรวจคำสั่งก่อนส่งเสมอ</span>
                </div>
              </div>
            </main>
            <RightDock open={preview} view={dockView} setView={setDockView} close={() => setPreview(false)} suspended={!!dialog || usageOpen}
              workspace={workspace} workspaces={workspaces} sessions={sessions} runs={runs} selected={selected} previewRequest={previewRequest}
              onSelect={session => { setActiveWs(session.wsId || activeWs); unhideSession(session.id); }}
              onPrompt={text => {
                setDraft(text);
                setComposerExpanded(true);
                requestAnimationFrame(() => {
                  composer.current?.focus();
                  if (composer.current) {
                    const len = composer.current.value.length;
                    composer.current.setSelectionRange(len, len);
                  }
                });
              }} onError={showError} />
          </div>
          <div className="statusbar sr-only" style={{ display: "none" }} aria-hidden="true">
            {connected ? "เชื่อมต่อแล้ว" : "เชื่อมต่อขาดหาย"}
            {pty ? " · pty" : ""}
          </div>
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
          unhideSession(sessId);
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
            className={`dialog ${dialog === "setup" ? "setup-dialog" : ""} ${dialog === "settings" || dialog === "skills" || dialog === "history" || dialog === "changes" ? "settings-dialog" : ""} ${dialog === "changes" ? "changes-dialog" : ""}`}
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
                    ? "เลือกผู้ช่วยที่อยากคุยด้วย ใช้ค่ารุ่น AI เริ่มต้นได้ ห้องคุยแต่ละห้องแยกจากกัน"
                    : dialog === "settings"
                      ? "ตรวจเครื่องมือ และเลือก model กับ effort เริ่มต้นของแต่ละผู้ให้บริการ"
                      : dialog === "project"
                        ? "เลือกโฟลเดอร์ที่ใช้ทำงานจริงบนเครื่อง"
                        : dialog === "setup"
                          ? "เลือกโฟลเดอร์ เชื่อมต่อผู้ช่วย แล้วเริ่มคุยได้เลย"
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
            {dialog === "session-delete" && deleteSession && <><p className="confirm-description"><strong>{deleteSession.name}</strong><br />ประวัติแชตใน session นี้จะถูกลบด้วย (หากต้องการพักไว้ชั่วคราว กด “ซ่อนไว้ก่อน” เพื่อเปิดกลับมาใช้ทีหลังได้)</p><div className="dialog-footer"><button className="secondary" autoFocus onClick={closeDialog}>ยกเลิก</button><button className="secondary" disabled={busy} onClick={() => { hideSession(deleteSession.id); setDialog(null); }}><EyeOff size={15} /> ซ่อนไว้ก่อน (ไม่ลบ)</button><button className="danger-button" disabled={busy} onClick={() => { closeSession(deleteSession.id); setDialog(null); }}>ลบ session</button></div></>}
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
                    <small className="muted">ไม่แน่ใจว่าจะเลือกรุ่นไหน ใช้ค่าเริ่มต้นได้ แล้วค่อยเปลี่ยนทีหลัง</small>
                  </div>
                )}
                <div className="dialog-field-row">
                  <label>
                    จำนวนห้องคุย (session)
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
                    แต่ละห้องคุยทำงานในโฟลเดอร์
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
                <SetupGuide clis={clis} workspaces={workspaces} workspaceId={activeWs} voice={voiceSettings} refreshClis={checkClis} onStart={startFromSetup}
                  onGeneralChat={async () => {
                    const ws = await post<Workspace>("/api/workspaces/quick-chat");
                    setWorkspaces(current => current.some(item => item.id === ws.id) ? current : [...current, ws]);
                    setActiveWs(ws.id); return ws;
                  }}
                  addProject={() => { setReturnToSetup(true); openProject(); }} openSkills={() => setDialog("skills")} />
                <div className="dialog-footer">
                  <span className="muted">เปิดหน้านี้อีกครั้งได้จากแถบซ้าย “เริ่มต้นใช้งาน”</span>
                  <button className="secondary" onClick={closeSetup}>ปิดไว้ก่อน</button>
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
                        placeholder={window.superai?.platform === "darwin" ? "~/Projects/my-app" : "D:\\Projects\\my-app"}
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
                    คำแนะนำสำหรับ AI (ไม่บังคับ)
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
                    onClick={closeDialog}
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
<nav className="settings-nav" aria-label="หมวดการตั้งค่า">{[["tools", "เครื่องมือ AI"], ["mcp", "MCP Servers"], ["models", "Model และ Effort"], ["folders", "โฟลเดอร์"], ["voice", "เสียง"], ["notify", "แจ้งเตือนและคำแนะนำ"]].map(([id, label]) => <button key={id} aria-current={settingsTab === id ? "page" : undefined} onClick={() => setSettingsTab(id)}>{label}</button>)}</nav>
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
                  </section><section hidden={settingsTab !== "mcp"}><McpManagerPanel cwd={workspace?.rootPath} onError={showError} onNotice={setNotice} /></section><section hidden={settingsTab !== "voice"}><VoiceSettingsPanel settings={voiceSettings} onChange={setVoiceSettings} /></section><section hidden={settingsTab !== "notify"}><NotifySettingsPanel /></section></div>
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
