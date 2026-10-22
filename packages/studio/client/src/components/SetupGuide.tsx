import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FolderPlus,
  LoaderCircle,
  LogIn,
  RefreshCw,
  Terminal,
  Sparkles,
  Wand2,
  Cpu,
  FolderGit2,
  KeyRound,
  Sliders,
  Puzzle,
  Mic,
} from "lucide-react";
import { api, post, type Cli, type CliAuthStatus, type NodeStatus, type Workspace } from "../api";
import { ProviderAccess } from "./ProviderAccess";
import { SPEECH_MODELS } from "../voice/models";
import type { VoiceSettings } from "../voice/speech";
import { isModelCached } from "../voice/stt";
import { confirmDefaults, defaultsConfirmed } from "../providers";
import { ProviderDefaults } from "./ProviderDefaults";

interface GitStatus {
  required: boolean;
  installed: boolean;
  version: string | null;
}
interface Job {
  id: string;
  cliId: string;
  status: string;
  log: string;
  error?: string;
}

const AI_CLIS = ["claude-code", "codex", "opencode", "antigravity", "freebuff"];
const LOGIN_KEY = "superai-setup-login";

export function setupNeeded(clis: Cli[], workspaces: Workspace[]) {
  const node = clis[0]?.nodeReady ?? true;
  return (
    !node ||
    !clis.some((c) => AI_CLIS.includes(c.id) && c.available) ||
    !workspaces.length ||
    !defaultsConfirmed()
  );
}

interface Props {
  clis: Cli[];
  workspaces: Workspace[];
  voice: VoiceSettings;
  refreshClis: () => Promise<void>;
  addProject: () => void;
  installCli: () => void;
  login: (cliId: string) => void;
  openSkills: () => void;
  onError: (message: string) => void;
}

export function SetupGuide({
  clis,
  workspaces,
  voice,
  refreshClis,
  addProject,
  installCli,
  login,
  openSkills,
  onError,
}: Props) {
  const loginCheckbox = useRef<HTMLInputElement>(null);
  const [accounts, setAccounts] = useState<Record<string, CliAuthStatus>>({});
  const onStatus = useCallback(
    (status: CliAuthStatus) =>
      setAccounts((current) => ({ ...current, [status.id]: status })),
    []
  );
  const [defaultsDone, setDefaultsDone] = useState(defaultsConfirmed);
  const [node, setNode] = useState<NodeStatus | null>(null);
  const [git, setGit] = useState<GitStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loginAcknowledged, setLoginAcknowledged] = useState(() => {
    try {
      return localStorage.getItem(LOGIN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [model, setModel] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [autoSettingUp, setAutoSettingUp] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const [n, g] = await Promise.all([
        api<NodeStatus>("/api/node/status"),
        api<GitStatus>("/api/git/status"),
        refreshClis(),
      ]);
      setNode(n);
      setGit(g);
      setModel(await isModelCached(SPEECH_MODELS[voice.model].repo));
    } catch {
      onError("ตรวจเครื่องมือไม่สำเร็จ กรุณากดตรวจเครื่องมืออีกครั้ง");
    } finally {
      setChecking(false);
    }
  }, [refreshClis, onError, voice.model]);

  useEffect(() => {
    void check();
  }, [check]);

  const running = jobs.find((j) => j.status === "running");
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      try {
        const data = await api<Job[]>("/api/cli-installs");
        setJobs(data);
        if (!data.some((j) => j.status === "running")) void check();
      } catch {}
    }, 1000);
    return () => clearInterval(timer);
  }, [running, check]);

  const install = async (url: string) => {
    try {
      const job = await post<Job>(url);
      setJobs((current) => [...current, job]);
    } catch {
      onError("เริ่มติดตั้งไม่สำเร็จ กรุณาลองใหม่");
    }
  };

  const markLogin = (value: boolean) => {
    try {
      if (value) localStorage.setItem(LOGIN_KEY, "1");
      else localStorage.removeItem(LOGIN_KEY);
      setLoginAcknowledged(value);
    } catch {
      onError("บันทึกหรือลืมเครื่องหมายยืนยันไม่ได้ กรุณาตรวจสิทธิ์พื้นที่จัดเก็บ");
    }
  };

  const lastJob = (id: string) => [...jobs].reverse().find((j) => j.cliId === id);
  const firstCli = clis.find((c) => AI_CLIS.includes(c.id) && c.available);
  const hasCli = !!firstCli;

  // Auto-setup missing components in one click
  const runAutoSetup = async () => {
    setAutoSettingUp(true);
    try {
      if (!node?.ready) {
        await install("/api/node/install");
      } else if (git?.required && !git.installed) {
        await install("/api/git/install");
      } else if (!hasCli) {
        installCli();
      } else if (!workspaces.length) {
        addProject();
      }
    } catch (e: any) {
      onError(e.message || "เกิดข้อผิดพลาดในการเตรียมระบบอัตโนมัติ");
    } finally {
      setAutoSettingUp(false);
    }
  };

  const steps = [
    {
      key: "node",
      icon: Cpu,
      title: "Node.js 22 LTS (เอนจินระบบ)",
      done: !!node?.ready,
      optional: false,
      detail: node?.ready
        ? `ติดตั้งเรียบร้อย (${node.version}) พร้อมใช้งานทันที`
        : node?.version
        ? `รุ่นปัจจุบัน ${node.version} แนะนำ Node.js 22 เพื่อความเสถียร`
        : "จำเป็นสำหรับรันเครื่องมือและสคริปต์ AI ทั้งหมด ติดตั้งแบบ Portable แยกอิสระ ไม่กระทบระบบเดิม",
      action: !node?.ready && (
        <button
          className="setup-btn-primary"
          disabled={!!running || autoSettingUp}
          onClick={() => void install("/api/node/install")}
        >
          <Download size={14} /> ติดตั้งอัตโนมัติ
        </button>
      ),
      job: lastJob("node"),
    },
    ...(git?.required
      ? [
          {
            key: "git",
            icon: FolderGit2,
            title: "Git for Windows (Git Bash)",
            done: git.installed,
            optional: false,
            detail: git.installed
              ? `พร้อมใช้งาน · ${git.version || "Git Bash ติดตั้งแล้ว"}`
              : "จำเป็นสำหรับเครื่องมือ AI เช่น Claude Code บน Windows ติดตั้งแบบพกพา ไม่ต้องใช้สิทธิ์ Admin",
            action: !git.installed && (
              <button
                className="setup-btn-primary"
                disabled={!!running || autoSettingUp}
                onClick={() => void install("/api/git/install")}
              >
                <Download size={14} /> ติดตั้งอัตโนมัติ
              </button>
            ),
            job: lastJob("git"),
          },
        ]
      : []),
    {
      key: "cli",
      icon: Terminal,
      title: "ผู้ช่วย AI (AI Assistants)",
      done: hasCli,
      optional: false,
      detail: hasCli
        ? `ผู้ช่วยพร้อมใช้งาน: ${clis
            .filter((c) => AI_CLIS.includes(c.id) && c.available)
            .map((c) => c.name)
            .join(", ")}`
        : "Claude Code, OpenAI Codex, OpenCode หรือ Antigravity CLI (มีรุ่นฟรีให้ใช้งานทันที)",
      action: (
        <button className="setup-btn-primary" onClick={installCli}>
          <Terminal size={14} /> {hasCli ? "จัดการ / เพิ่มตัวอื่น" : "เลือกและติดตั้ง AI"}
        </button>
      ),
    },
    {
      key: "project",
      icon: FolderPlus,
      title: "โฟลเดอร์โปรเจกต์ (Workspace)",
      done: workspaces.length > 0,
      optional: false,
      detail: workspaces.length
        ? `เชื่อมต่อแล้ว ${workspaces.length} โปรเจกต์ (${workspaces[0]?.name})`
        : "เลือกโฟลเดอร์ที่คุณต้องการให้ AI เข้าไปช่วยเขียนโค้ด หรือสร้างโฟลเดอร์ใหม่",
      action: !workspaces.length && (
        <button className="setup-btn-primary" onClick={addProject}>
          <FolderPlus size={14} /> เลือกโฟลเดอร์ทำงาน
        </button>
      ),
    },
    {
      key: "login",
      icon: KeyRound,
      title: "บัญชีและสิทธิ์เข้าถึง (Authentication)",
      done: Object.values(accounts).some((a) => a.status === "authenticated"),
      optional:
        Object.values(accounts).length > 0 &&
        Object.values(accounts).every((a) => a.status === "unknown"),
      detail:
        "ล็อกอินเข้าใช้บริการ AI ที่คุณต้องการ หรือใช้รุ่นฟรีของ OpenCode / โมเดล Ollama ในเครื่องได้โดยไม่ต้องล็อกอิน",
      content: (
        <div className="setup-login-help" id="setup-login-help">
          <div className="provider-accounts">
            {clis
              .filter((c) => AI_CLIS.includes(c.id) && c.available)
              .map((c) => (
                <ProviderAccess
                  key={c.id}
                  provider={c.id}
                  wsId={workspaces[0]?.id}
                  onStatus={onStatus}
                />
              ))}
          </div>
          <small className="setup-notice-text">
            ข้อมูลบัญชีและ Credentials ทั้งหมดถูกจัดเก็บอย่างปลอดภัยบนเครื่องของคุณผ่านระบบเข้ารหัสของ OS
          </small>
        </div>
      ),
      action: (
        <div className="setup-login-actions" aria-describedby="setup-login-help">
          <button
            className="setup-btn-secondary"
            disabled={!firstCli || !workspaces.length}
            onClick={() => firstCli && login(firstCli.id)}
          >
            <LogIn size={14} aria-hidden="true" /> เปิด Terminal เพื่อล็อกอิน
          </button>
          <label className="setup-confirm">
            <input
              ref={loginCheckbox}
              type="checkbox"
              aria-describedby="setup-login-help"
              checked={loginAcknowledged}
              onChange={(e) => markLogin(e.target.checked)}
            />
            ฉันเข้าสู่ระบบเรียบร้อยแล้ว
          </label>
        </div>
      ),
    },
    {
      key: "defaults",
      icon: Sliders,
      title: "ตั้งค่า Model และระดับความคิด (Effort)",
      done: defaultsDone,
      optional: false,
      detail: hasCli
        ? "เลือกรุ่นโมเดลและ Effort เริ่มต้นที่ต้องการสำหรับแต่ละค่าย เพื่อความสะดวกรวดเร็วเวลาเปิดเซสชัน"
        : "ติดตั้งผู้ช่วย AI อย่างน้อย 1 ตัวก่อน เพื่อตั้งค่าเริ่มต้น",
      content: hasCli && (
        <ProviderDefaults clis={clis} onSaved={() => setDefaultsDone(true)} />
      ),
      action: hasCli && !defaultsDone && (
        <button
          className="setup-btn-primary"
          onClick={() => {
            confirmDefaults();
            setDefaultsDone(true);
          }}
        >
          <Check size={14} /> บันทึกและใช้ค่านี้
        </button>
      ),
    },
    {
      key: "skills",
      icon: Puzzle,
      title: "Skills เสริมความสามารถ (ไม่บังคับ)",
      done: false,
      optional: true,
      detail: "ค้นหาและติดตั้ง Agent Skills จากคลังมาตรฐานของ Vercel, Supabase และ Anthropic ได้ในคลิกเดียว",
      action: workspaces.length > 0 && hasCli && (
        <button className="setup-btn-secondary" onClick={openSkills}>
          <Puzzle size={14} /> ดูคลัง Skills
        </button>
      ),
    },
    {
      key: "voice",
      icon: Mic,
      title: "พูดเพื่อพิมพ์ / แปลงเสียงพูด (ไม่บังคับ)",
      done: !!model,
      optional: true,
      detail: model
        ? "โมเดลเสียงพร้อมใช้งานแล้ว กดปุ่มไมค์ในช่องแชทเพื่อพูดแทนการพิมพ์ได้ทันที"
        : `กดปุ่มไมค์ในช่องพิมพ์ครั้งแรกเพื่อดาวน์โหลดโมเดลเสียง (${SPEECH_MODELS[voice.model].size}) เก็บไว้ในเครื่อง`,
      action: null,
    },
  ];

  const totalCore = steps.filter((s) => !s.optional).length;
  const completedCore = steps.filter((s) => s.done && !s.optional).length;
  const progressPercent = Math.round((completedCore / totalCore) * 100);
  const isReady = completedCore === totalCore;

  return (
    <div className="setup-guide-container">
      {/* Hero Mission Control Header */}
      <div className="setup-hero-banner">
        <div className="setup-hero-info">
          <div className="setup-pill-badge">
            <Sparkles size={13} className="text-cyan-400" />
            <span>ศูนย์ตั้งค่าความพร้อมของสตูดิโอ (Setup Center)</span>
          </div>
          <h2>{isReady ? "🎉 ยินดีด้วย! สตูดิโอของคุณพร้อมทำงาน 100%" : "เตรียมความพร้อมสตูดิโอของคุณ"}</h2>
          <p>
            {isReady
              ? "ระบบทุกอย่างถูกตั้งค่าเรียบร้อยแล้ว คุณสามารถปิดหน้านี้และเริ่มสร้างผลงานร่วมกับ AI ได้ทันที"
              : "ทำตามขั้นตอนด้านล่าง หรือกดปุ่มติดตั้งอัตโนมัติ เพื่อให้ระบบเตรียมทุกอย่างให้ในคลิกเดียว"}
          </p>

          {/* Progress Bar */}
          <div className="setup-progress-wrapper">
            <div className="setup-progress-label">
              <span>ความคืบหน้าของระบบ: <strong>{completedCore} จาก {totalCore} รายการหลัก</strong></span>
              <span className="setup-progress-percent">{progressPercent}%</span>
            </div>
            <div className="setup-progress-track">
              <div
                className="setup-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="setup-hero-actions">
          {!isReady && (
            <button
              className="setup-quickstart-btn"
              disabled={!!running || autoSettingUp}
              onClick={() => void runAutoSetup()}
            >
              <Wand2 size={16} />
              <span>{autoSettingUp ? "กำลังดำเนินการ..." : "ติดตั้งสิ่งที่ขาดอัตโนมัติ"}</span>
            </button>
          )}
          <button
            className="setup-refresh-btn"
            disabled={checking}
            onClick={() => void check()}
            title="ตรวจสถานะเครื่องมืออีกครั้ง"
          >
            <RefreshCw size={13} className={checking ? "spin" : ""} />
            <span>{checking ? "กำลังตรวจ..." : "ตรวจใหม่อีกครั้ง"}</span>
          </button>
        </div>
      </div>

      {/* Steps List */}
      <div className="setup-card-list">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.key}
              className={`setup-step-card ${step.done ? "card-completed" : ""} ${
                step.optional ? "card-optional" : ""
              }`}
            >
              <div className="setup-card-header">
                <div className={`setup-status-indicator ${step.done ? "indicator-done" : ""}`}>
                  {step.done ? <Check size={16} /> : <span>{index + 1}</span>}
                </div>
                <div className="setup-card-title-group">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={step.done ? "text-emerald-400" : "text-cyan-400"} />
                    <h3>{step.title}</h3>
                    {step.optional && <span className="setup-badge-optional">ไม่บังคับ</span>}
                    {step.done && <span className="setup-badge-done">พร้อมใช้</span>}
                  </div>
                  <p>{step.detail}</p>
                </div>
                {step.action && (
                  <div className="setup-card-action-slot">{step.action}</div>
                )}
              </div>

              {"content" in step && step.content && (
                <div className="setup-card-subcontent">{step.content}</div>
              )}

              {"job" in step && step.job && (
                <div className={`setup-job-status ${step.job.status}`}>
                  {step.job.status === "running" && (
                    <LoaderCircle size={14} className="spin text-cyan-400" />
                  )}
                  <span>
                    {step.job.status === "running"
                      ? "กำลังดาวน์โหลดและแตกไฟล์... กรุณารอสักครู่"
                      : step.job.status === "failed"
                      ? "ติดตั้งไม่สำเร็จ ลองใหม่อีกครั้ง หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต"
                      : "การติดตั้งเสร็จสมบูรณ์"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
