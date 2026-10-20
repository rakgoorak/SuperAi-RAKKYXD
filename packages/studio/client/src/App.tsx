import { useCallback, useEffect, useRef, useState } from "react";
import {
  Command,
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
  Keyboard,
  ShieldCheck,
  Layers,
  Radio,
  AudioLines,
  Rocket,
} from "lucide-react";
import { api, post, Workspace, Cli, Session, Run, AgentTeam } from "./api";
import { SessionCanvas, type CanvasLayout } from "./components/SessionCanvas";
import { RightDock, type DockView } from "./components/RightDock";
import { TeamEditor, TeamProgress } from "./components/TeamEditor";
import { CliInstaller } from "./components/CliInstaller";
import { LaunchPresets, type LaunchSeat } from "./components/LaunchPresets";
import { VoiceMode } from "./components/VoiceMode";
import { VoiceSettingsPanel } from "./components/VoiceSettingsPanel";
import { SetupGuide, setupNeeded } from "./components/SetupGuide";
import { loadVoiceSettings, saveVoiceSettings, type VoiceSettings } from "./voice/speech";

type Mode = "code" | "chat" | "assistant";
type Dialog = "session" | "settings" | "project" | "delete" | "clear" | "setup" | null;
const modeLabels: Record<Mode, string> = {
  code: "โค้ด",
  chat: "สนทนา",
  assistant: "ผู้ช่วย",
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWs, setActiveWs] = useState(initial("superai-workspace", ""));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clis, setClis] = useState<Cli[]>([]);
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<Mode>("code");
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
  const [composerShown, setComposerShown] = useState(false);
  const [dockView, setDockView] = useState<DockView>("browser");
  const [launchPlan, setLaunchPlan] = useState<LaunchSeat[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pty, setPty] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState("active");
  const [launchType, setLaunchType] = useState("claude-code");
  const [count, setCount] = useState(1);
  const launchTotal = launchPlan?.reduce((n, seat) => n + seat.count, 0) || count;
  const [projectName, setProjectName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [editing, setEditing] = useState("");
  const [model, setModel] = useState(initial("superai-model", "cli:opencode"));
  const [models, setModels] = useState<string[]>([]);
  const [modelError, setModelError] = useState("");
  const [allowTools, setAllowTools] = useState(false);
  const [agentTeam,setAgentTeam] = useState<AgentTeam | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [menu, setMenu] = useState("");
  const composer = useRef<HTMLTextAreaElement>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(loadVoiceSettings);
  const setupShown = useRef(false);
  const [checkingModels, setCheckingModels] = useState(false);
  const [openCodeModel, setOpenCodeModel] = useState(
    initial("superai-opencode-model", "auto"),
  );
  const [openCodeModels, setOpenCodeModels] = useState<string[]>([]);
  const [checkingOpenCode, setCheckingOpenCode] = useState(false);
  const workspace = workspaces.find((w) => w.id === activeWs);
  const visible = sessions.filter((s) => s.wsId === activeWs);
  const selectedSession = visible.find((s) => s.id === selected);
  const running = visible.filter((s) => s.status === "running");
  const conversation = runs.filter(
    (r) => r.mode === (mode === "assistant" ? "assistant" : "chat"),
  );
  const activeRun = runs.find((r) => r.status === "running");
  const launchCli = clis.find((c) => c.id === launchType);
  const modelLabel = model.startsWith("cli:")
    ? clis.find((c) => c.id === model.slice(4))?.name || "CLI"
    : model;
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
      setModel((current) => current || data.models[0] || "");
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
    setSelected(current => sessions.some(session => session.id === current && session.wsId === activeWs) ? current : "");
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
    localStorage.setItem("superai-model", model);
  }, [model]);
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
  const loadOpenCodeModels = useCallback(async () => {
    setCheckingOpenCode(true);
    try {
      const data = await api<{ models: string[] }>("/api/opencode/models");
      setOpenCodeModels(data.models);
      setOpenCodeModel((current) => current === 'auto' ? data.models.find((m) => m.startsWith('opencode/') && m.endsWith('-free')) || '' : current);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setCheckingOpenCode(false);
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
      if (plan.some(seat => seat.type === "opencode") && openCodeModel === "auto") throw new Error("กำลังตรวจรุ่น OpenCode กรุณารอ หรือเลือกรุ่นในการตั้งค่า");
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
            const session = await post<Session>("/api/terminals/spawn", {
              agentType: type, wsId: workspace.id, name: cli.name,
              openCodeModel: type === "opencode" ? openCodeModel : undefined,
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
  const send = () =>
    task(async () => {
      if(mode==='chat'&&model==='cli:opencode'&&openCodeModel==='auto')throw new Error('กำลังตรวจรุ่น OpenCode กรุณารอ หรือเลือกรุ่นในการตั้งค่า');
      if (!draft.trim()) return;
      if (!workspace) throw new Error("กรุณาสร้างโปรเจกต์ก่อน");
      if (mode === "code") {
        const recipients =
          target === "all"
            ? running
            : running.filter(
                (s) => s.id === (target === "active" ? selected : target),
              );
        if (!recipients.length)
          throw new Error(
            "ไม่มี terminal ที่กำลังทำงาน กรุณาเปิด session ก่อน",
          );
        for (const recipient of recipients) {
          const result = await post(`/api/terminals/${recipient.id}/input`, {
            input: draft + "\r",
          });
          if (!result.success)
            throw new Error(
              `ส่งไป ${recipient.name} ไม่สำเร็จ กรุณาตรวจ session`,
            );
        }
        setNotice(
          target === "all"
            ? `ส่งให้ ${recipients.length} session ในโปรเจกต์นี้แล้ว`
            : "ส่งคำสั่งแล้ว",
        );
      } else {
        const conversationModel = mode === 'assistant' ? agentTeam?.leader.provider : model;
        if (!conversationModel)
          throw new Error("เปิดการตั้งค่า แล้วเลือก CLI หรือ model ก่อน");
        await post(`/api/conversations/${workspace.id}`, {
          prompt: draft,
          mode,
          model:conversationModel,
          allowTools,
          openCodeModel,
          ...(mode === "assistant" ? {team:agentTeam} : {}),
        });
        setRuns(await api<Run[]>(`/api/conversations/${workspace.id}`));
      }
      setDraft("");
    });
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
                (s) => s.id === (target === "active" ? selected : target),
              );
        if (!recipients.length) throw new Error("ไม่มี session ที่กำลังทำงาน");
        for (const s of recipients) {
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
    setMenu("");
    setDialog("project");
  };
  const openSettings = () => {
    setDialog("settings");
    void loadModels();
    void checkClis().catch((e) => setError(e.message));
  };
  const openVoiceMode = () => {
    setError("");
    if (!workspace) return setError("เพิ่มโปรเจกต์ก่อนเริ่มโหมดเสียง");
    if (mode === "code") setMode("chat");
    if (!(mode === "assistant" ? agentTeam?.leader.provider : model)) {
      setError("เลือกผู้ช่วยหรือ model ในการตั้งค่าก่อนเริ่มโหมดเสียง");
      return openSettings();
    }
    setDialog(null);
    setVoiceOpen(true);
  };
  const submitVoice = async (text: string) => {
    if (!workspace) throw new Error("กรุณาสร้างโปรเจกต์ก่อน");
    const voiceMode = mode === "assistant" ? "assistant" : "chat";
    const provider = voiceMode === "assistant" ? agentTeam?.leader.provider : model;
    if (!provider) throw new Error("เลือกผู้ช่วยหรือ model ในการตั้งค่าก่อน");
    if (voiceMode === "chat" && model === "cli:opencode" && openCodeModel === "auto") throw new Error("กำลังตรวจรุ่น OpenCode กรุณารอสักครู่");
    const run = await post<Run>(`/api/conversations/${workspace.id}`, {
      prompt: text, mode: voiceMode, model: provider, allowTools, openCodeModel, voice: true,
      ...(voiceMode === "assistant" ? { team: agentTeam } : {}),
    });
    setRuns(await api<Run[]>(`/api/conversations/${workspace.id}`));
    return run;
  };
  const closeSetup = () => {
    try { localStorage.setItem("superai-setup-dismissed", "1"); } catch {}
    setDialog(null);
  };
  const closeDialog = () => (dialog === "setup" ? closeSetup() : setDialog(null));

  return (
    <div className={`app-shell ${window.superai?.platform === "darwin" ? "platform-mac" : ""}`}>
      <header className="titlebar app-drag">
        <div className="brand">
          <div className="brand-mark">
            <Command size={20} />
          </div>
          <strong>
            SuperAi <span>& RAKKYXD</span>
          </strong>
        </div>
        <div className="titlebar-project">
          <span className={`status-dot ${connected ? "" : "offline"}`} />
          {connected ? "พื้นที่ทำงานของคุณ" : "กำลังเชื่อมต่อใหม่"}
        </div>
            <nav className="mode-switch" aria-label="โหมดทำงาน">
              {(["assistant", "code", "chat"] as Mode[]).map((m) => (
                <button
                  key={m}
                  className={mode === m ? "active" : ""}
                  onClick={() => setMode(m)}
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
                            <Pencil size={13} /> เปลี่ยนชื่อ / โฟลเดอร์
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
                            <button
                              key={s.id}
                              className={`sidebar-session ${s.id === selected && mode === "code" ? "active" : ""}`}
                              onClick={() => {
                                setSelected(s.id);
                                setMode("code");
                              }}
                            >
                              <Terminal size={13} />
                              <span>{s.name}</span>
                              <span
                                className={`status-dot ${s.status === "running" ? "" : s.status === "error" ? "bad" : "offline"}`}
                              />
                            </button>
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
            <div className="sidebar-bottom">
              <button onClick={() => setDialog("setup")} title="ตรวจความพร้อมและตั้งค่าเริ่มต้น">
                <Rocket size={17} />
                <span>
                  เริ่มต้นใช้งาน<small>ตรวจ Node, Git, CLI และบัญชี</small>
                </span>
              </button>
              <button onClick={openVoiceMode} title="คุยกับผู้ช่วยด้วยเสียง">
                <AudioLines size={17} />
                <span>
                  โหมดเสียง<small>คุยต่อเนื่อง · ไทย / อังกฤษ</small>
                </span>
              </button>
              <button onClick={openSettings}>
                <Settings size={17} />
                <span>การตั้งค่า</span>
              </button>
              <div className="account-local">
                <div className="avatar">R</div>
                <div>
                  RAKKYXD<small>พื้นที่ทำงานบนเครื่องของคุณ</small>
                </div>
                <ShieldCheck size={16} />
              </div>
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
              {mode === "code" && <button className={`toolbar-button ${composerShown ? "selected" : ""}`} title="ช่องคำสั่งรวม" aria-pressed={composerShown} onClick={() => setComposerShown(!composerShown)}><Keyboard size={14} /><span>คำสั่งรวม</span></button>}
              <button className={`toolbar-button ${preview && dockView === "dashboard" ? "selected" : ""}`} title="เปิดแผงสถานะ" onClick={() => { setDockView("dashboard"); setPreview(true); }}><Activity size={14} /><span>สถานะ</span></button>
              <button
                className={`toolbar-button ${preview ? "selected" : ""}`}
                onClick={() => { setDockView("browser"); setPreview(dockView === "browser" ? !preview : true); }}
              >
                <Globe size={15} />
                <span>Preview</span>
              </button>
              <button
                className="primary compact"
                aria-label="สร้าง session"
                title="สร้าง session"
                disabled={!workspace}
                onClick={() => openSession()}
              >
                <Plus size={15} />
                <span>สร้าง session</span>
              </button>
            </div>
          </div>
          <div className="canvas-row">
            <main className={`work-canvas ${mode === "code" ? "code-mode" : ""}`}>
          {(error || notice) && (
            <div
              className={`message-banner ${error ? "error" : ""}`}
              role={error ? "alert" : "status"}
            >
              {error ? <AlertCircle size={16} /> : <Check size={16} />}
              <span>{error || notice}</span>
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
                    ) : mode === "assistant" ? (
                      <Layers size={16} />
                    ) : (
                      <MessageSquare size={16} />
                    )}
                  </span>
                  <h1>
                    {mode === "code"
                      ? "ห้องทำงาน"
                      : mode === "assistant"
                        ? "ทีมผู้ช่วย AI"
                        : "บทสนทนา"}
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
                      <button className="text-button" onClick={openSettings}>
                        {mode === "assistant" ? "ตั้งค่าเริ่มต้น" : modelLabel || "เลือก model"}
                        <ChevronDown size={13} />
                      </button>
                      <button
                        className="icon-button"
                        title="ล้างประวัติโหมดนี้และโหมดผู้ช่วยของโปรเจกต์"
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
                    select={setSelected} zoom={id => { setSelected(id); setZoomed(true); }} close={closeSession} add={openSession}
                    refresh={() => void refresh().catch(() => {})} onError={showError} />
                ) : (
                  <div className="workspace-empty">
                    <div className="empty-command">
                      <Command size={32} />
                    </div>
                    <h2>ไอเดียของคุณ เริ่มได้ที่นี่</h2>
                    <p>
                      เลือกโปรเจกต์ เปิดผู้ช่วยที่ถนัด
                      <br />
                      แล้วสร้างงานของคุณในพื้นที่เดียว
                    </p>
                    <button
                      className="primary"
                      disabled={!workspace}
                      onClick={() => openSession()}
                    >
                      <Plus size={16} /> เปิด session แรก
                    </button>
                    <div className="available-agents">
                      {clis
                        .filter((c) => c.id !== "terminal")
                        .map((c) => (
                          <button
                            key={c.id}
                            onClick={() => openSession(c.id)}
                            title={
                              c.available
                                ? `เปิด ${c.name}`
                                : `${c.name} ยังไม่ติดตั้ง`
                            }
                          >
                            <span
                              className={`agent-monogram ${c.available ? "" : "unavailable"}`}
                            >
                              {c.name.slice(0, 1)}
                            </span>
                            <span>{c.name}</span>
                            <small>
                              {c.available ? "พร้อมใช้" : "ยังไม่ติดตั้ง"}
                            </small>
                          </button>
                        ))}
                    </div>
                    <div className="empty-hint">
                      <AudioLines size={14} /> พิมพ์คำสั่ง หรือเปิดโหมดเสียงเพื่อคุยกับผู้ช่วย
                    </div>
                  </div>
                )}
              </div>
              {mode !== "code" && (
                <div className="conversation-scroll">
                  {mode === "assistant" && <TeamEditor key={activeWs} workspaceId={activeWs} clis={clis} models={models} openCodeModels={openCodeModels} provider={model} override={openCodeModel} disabled={!!activeRun} onChange={setAgentTeam} onError={showError} discover={()=>void loadModels()}/>}
                  {!conversation.length && mode === "assistant" ? <p className="team-instructions">พิมพ์เป้าหมายและเกณฑ์ตรวจรับด้านล่าง แล้วกดส่ง หัวหน้าจะมอบหมายงานตามลูกทีมที่เลือก</p> : !conversation.length ? (
                    <div className="conversation-empty">
                      <div className="empty-command">
                        {mode === "assistant" ? (
                          <Bot size={30} />
                        ) : (
                          <MessageSquare size={30} />
                        )}
                      </div>
                      <h2>
                        {mode === "assistant"
                          ? "มอบหมายเป้าหมายให้ทีม AI"
                          : "เริ่มจากคำถามของคุณ"}
                      </h2>
                      <p>
                        {mode === "assistant"
                          ? "Supervisor จะแบ่งงานให้ Coder, Tester และ Reviewer พร้อมรายงานผลจริง"
                          : "ถาม อธิบายโค้ด หรือวางแผนงาน บทสนทนาถูกเก็บแยกตามโปรเจกต์"}
                      </p>
                      <p className="muted">
                        เลือกใช้บัญชี CLI ของคุณ หรือ model ของ Ollama
                        ในการตั้งค่า
                      </p>
                      <button className="secondary" onClick={openSettings}>
                        <Settings size={15} /> ตั้งค่า model
                      </button>
                    </div>
                  ) : (
                    conversation.map((run) => (
                      <article className="conversation-run" key={run.id}>
                        <div className="user-message">
                          <span className="message-author">
                            คุณ{" "}
                            <time>
                              {new Date(run.createdAt).toLocaleTimeString(
                                "th-TH",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </time>
                          </span>
                          <p>{run.prompt}</p>
                        </div>
                        {run.team && <TeamProgress run={run}/>}
                        <div className="assistant-message">
                          <div className="message-author">
                            <span className="small-brand">
                              <Command size={14} />
                            </span>{" "}
                            SuperAi{" "}
                            <span
                              className={`run-state ${run.status === "failed" ? "danger-text" : ""}`}
                            >
                              {run.status === "running" && (
                                <LoaderCircle size={12} className="spin" />
                              )}
                              {statusText[run.status]}
                            </span>
                          </div>
                          {run.output ? (
                            <pre>{run.output}</pre>
                          ) : run.status === "running" ? (
                            <p className="muted">
                              กำลังประมวลผลผ่านผู้ช่วยที่เลือก…
                            </p>
                          ) : null}
                          {run.error && (
                            <div className="inline-error">{run.error}</div>
                          )}
                          {run.events.length > 0 && (
                            <details>
                              <summary>
                                บันทึกการทำงาน ({run.events.length})
                              </summary>
                              <pre className="event-log">
                                {run.events.join("\n\n")}
                              </pre>
                            </details>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              )}
              <div className={`composer-area ${mode === "code" && !composerExpanded ? "compact-code" : ""} ${mode === "code" && !composerShown ? "not-visible" : ""}`}>
                <div className="composer-context">
                  <div className="inline">
                    {mode === "code" ? (
                      <>
                        <Radio size={13} />
                        <select
                          aria-label="เป้าหมายคำสั่ง"
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                        >
                          <option value="active">
                            {selectedSession?.name || "เลือก session"} ·
                            ที่เลือก
                          </option>
                          <option value="all">
                            ทุก session ในโปรเจกต์ ({running.length})
                          </option>
                          {running.map((s) => (
                            <option value={s.id} key={s.id}>
                              {s.name} · {s.id.slice(0, 5)}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <Bot size={13} />
                        <span>{mode === "assistant" ? `หัวหน้า: ${agentTeam?.leader.name || "ยังไม่เลือกทีม"}` : modelLabel || "ยังไม่ได้เลือก model"}</span>
                        <label className="tool-permission">
                          <input
                            type="checkbox"
                            checked={allowTools}
                            onChange={(e) => setAllowTools(e.target.checked)}
                            disabled={!!activeRun}
                          />{" "}
                          อนุญาตแก้ไฟล์และรันคำสั่ง
                        </label>
                      </>
                    )}
                  </div>
                  <div className="inline">
                    {mode === "code" && (
                      <button className="icon-button" title={composerExpanded ? "ย่อช่องคำสั่ง" : "ขยายช่องคำสั่ง"}
                        aria-expanded={composerExpanded} onClick={() => setComposerExpanded(!composerExpanded)}>
                        {composerExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      </button>
                    )}
                  {mode !== "code" && (
                    <button className="text-button" onClick={openVoiceMode} title="คุยด้วยเสียงแบบต่อเนื่อง">
                      <AudioLines size={14} /> โหมดเสียง
                    </button>
                  )}
                  </div>
                </div>
                <div className="composer-box">
                  <textarea
                    ref={composer}
                    rows={mode === "code" && !composerExpanded ? 1 : 3}
                    aria-label="คำสั่ง"
                    placeholder={
                      mode === "code"
                        ? "พิมพ์คำสั่งให้ session ที่เลือก…"
                        : "วันนี้อยากให้ช่วยอะไร?"
                    }
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <div className="composer-bottom">
                    <span>
                      {mode === "code" ? (
                        <>
                          <Terminal size={12} />
                          {workspace?.name || "ยังไม่มีโปรเจกต์"}
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={12} />{" "}
                          {(mode === "assistant" ? agentTeam?.leader.provider || "" : model).startsWith("cli:")
                            ? "ใช้บัญชี CLI ของคุณ"
                            : "ใช้ Ollama บนเครื่อง"}
                        </>
                      )}
                    </span>
                    <div className="inline">
                      <button
                        className="icon-button"
                        title={
                          mode === "code"
                            ? "หยุดคำสั่ง (Ctrl+C)"
                            : "ยกเลิกงานผู้ช่วย"
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
                        title="ส่งคำสั่ง (Enter)"
                        disabled={
                          busy ||
                          !draft.trim() ||
                          !workspace ||
                          (mode !== "code" && !!activeRun)
                        }
                        onClick={send}
                      >
                        {busy ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="composer-hint">
                  <span>Enter ส่ง · Shift + Enter ขึ้นบรรทัดใหม่</span>
                  <span>ตรวจคำสั่งก่อนส่งเสมอ</span>
                </div>
              </div>
            </main>
            <RightDock open={preview} view={dockView} setView={setDockView} close={() => setPreview(false)} suspended={!!dialog || voiceOpen}
              workspace={workspace} workspaces={workspaces} sessions={sessions} runs={runs} selected={selected}
              onSelect={session => { setActiveWs(session.wsId || activeWs); setSelected(session.id); setMode("code"); }}
              onPrompt={text => { setDraft(current => current ? `${current}\n${text}` : text); setComposerShown(true); requestAnimationFrame(() => composer.current?.focus()); }} onError={showError} />
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
      {voiceOpen && (
        <VoiceMode
          runs={runs}
          target={mode === "assistant" ? `ทีม · ${agentTeam?.leader.name || "หัวหน้าทีม"}` : modelLabel}
          settings={voiceSettings}
          submit={submitVoice}
          cancel={async (id) => { await post(`/api/runs/${id}/cancel`); }}
          openSettings={openSettings}
          close={() => setVoiceOpen(false)}
        />
      )}
      {dialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) closeDialog();
          }}
        >
          <section
            className={`dialog ${dialog === "settings" ? "settings-dialog" : ""}`}
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
                  {dialog === "session"
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
                            : "ล้างประวัติผู้ช่วย?"}
                </h2>
                <p>
                  {dialog === "session"
                    ? "เลือก CLI และจำนวนพื้นที่ทำงานที่ต้องการ"
                    : dialog === "settings"
                      ? "เชื่อมเครื่องมือที่คุณใช้ และเลือก model สำหรับผู้ช่วย"
                      : dialog === "project"
                        ? "เลือกโฟลเดอร์ที่ใช้ทำงานจริงบนเครื่อง"
                        : dialog === "setup"
                          ? "ทำตามทีละขั้น ระบบตรวจเครื่องของคุณจริง และติดตั้งสิ่งที่ขาดให้ได้"
                          : "กรุณาตรวจสอบก่อนดำเนินการ"}
                </p>
              </div>
              <button
                className="icon-button"
                title="ปิดหน้าต่าง"
                disabled={busy}
                onClick={closeDialog}
              >
                <X size={18} />
              </button>
            </div>
            {error && (
              <div className="dialog-error" role="alert">
                <AlertCircle size={15} />
                {error}
              </div>
            )}
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
                  addProject={() => openProject()} installCli={() => openSession()}
                  login={(id) => { setLaunchType(id); setCount(1); setLaunchPlan(null); setDialog("session"); }}
                  tryVoice={openVoiceMode} />
                <div className="dialog-footer">
                  <span className="muted">เปิดหน้านี้อีกครั้งได้จากแถบซ้าย “เริ่มต้นใช้งาน”</span>
                  <button className="primary" onClick={closeSetup}>เสร็จแล้ว <Check size={15} /></button>
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
                <div className="settings-content">
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
                  <div className="settings-section-title">
                    <h3>รุ่นของ OpenCode</h3>
                    <button
                      className="text-button"
                      disabled={checkingOpenCode}
                      onClick={loadOpenCodeModels}
                    >
                      <RefreshCw
                        size={13}
                        className={checkingOpenCode ? "spin" : ""}
                      />{" "}
                      ตรวจรุ่น
                    </button>
                  </div>
                  <label className="settings-label">
                    เลือกรุ่น OpenCode
                    <select
                      value={openCodeModel}
                      onChange={(e) => {setOpenCodeModel(e.target.value);if(e.target.value==='auto')void loadOpenCodeModels();}}
                    >
                      <option value="auto">ตรวจและเลือกรุ่นที่พร้อมใช้</option><option value="">ใช้รุ่นเดิมที่ตั้งไว้ใน OpenCode</option>
                      {openCodeModels.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <p className="muted">
                    ใช้เฉพาะ SuperAi ไม่เปลี่ยนไฟล์ตั้งค่าของ OpenCode
                    บัญชีและสิทธิ์ใช้งานขึ้นกับผู้ให้บริการรุ่นนั้น
                  </p>
                  <div className="settings-section-title">
                    <h3>ผู้ช่วยและบทสนทนา</h3>
                    <button
                      className="text-button"
                      disabled={checkingModels}
                      onClick={loadModels}
                    >
                      <RefreshCw
                        className={checkingModels ? "spin" : ""}
                        size={13}
                      />{" "}
                      ตรวจ model
                    </button>
                  </div>
                  <p className="muted">
                    เลือก CLI เพื่อใช้บัญชีเดิม หรือเลือก model ของ Ollama
                    หากต้องการประมวลผลบนเครื่อง ค่าใช้จ่ายและโควตา CLI
                    ขึ้นกับบัญชีของคุณ
                  </p>
                  {modelError && (
                    <p className="muted">
                      Ollama (ตัวเลือกเพิ่มเติม): {modelError}
                    </p>
                  )}
                  <label className="settings-label">
                    เครื่องมือ / Model
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      <option value="">เลือก CLI หรือ model</option>
                      {clis
                        .filter(
                          (c) =>
                            c.available &&
                            ["claude-code", "codex", "opencode"].includes(c.id),
                        )
                        .map((c) => (
                          <option key={c.id} value={`cli:${c.id}`}>
                            {c.name} · บัญชี CLI
                          </option>
                        ))}
                      {models.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <div className="setup-command">
                    <Terminal size={14} />
                    <code>ollama pull qwen2.5-coder:7b</code>
                    <button
                      className="text-button"
                      onClick={() => {
                        setDraft("ollama pull qwen2.5-coder:7b");
                        setMode("code");
                        setDialog(null);
                      }}
                    >
                      ใส่ในช่องคำสั่ง
                    </button>
                  </div>
                  <VoiceSettingsPanel settings={voiceSettings} onChange={setVoiceSettings} onError={showError} />
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
                    : "ล้างประวัติสนทนาและทีมผู้ช่วยทั้งหมดของโปรเจกต์นี้ การล้างไม่ลบไฟล์โปรเจกต์"}
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
    </div>
  );
}
