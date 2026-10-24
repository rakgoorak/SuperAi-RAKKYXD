import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FolderPlus,
  LoaderCircle,
  RefreshCw,
  Terminal,
  Wand2,
  Puzzle,
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
      title: "Node.js 22",
      done: !!node?.ready,
      optional: false,
      detail: node?.ready
        ? `ติดตั้งแล้ว (${node.version})`
        : node?.version
        ? `เครื่องนี้มี ${node.version} ซึ่ง CLI บางตัวต้องใช้ Node.js 22`
        : "ใช้รัน CLI ของ AI ติดตั้งแบบพกพา ไม่แตะ Node.js เดิมในเครื่อง",
      action: !node?.ready && (
        <button
          className="setup-btn-primary"
          disabled={!!running || autoSettingUp}
          onClick={() => void install("/api/node/install")}
        >
          <Download size={14} /> ติดตั้ง
        </button>
      ),
      job: lastJob("node"),
    },
    ...(git?.required
      ? [
          {
            key: "git",
                  title: "Git for Windows",
            done: git.installed,
            optional: false,
            detail: git.installed
              ? git.version ? `ติดตั้งแล้ว (${git.version})` : "ติดตั้งแล้ว"
              : "Claude Code บน Windows ต้องใช้ Git Bash ติดตั้งแบบพกพา ไม่ต้องใช้สิทธิ์ Admin",
            action: !git.installed && (
              <button
                className="setup-btn-primary"
                disabled={!!running || autoSettingUp}
                onClick={() => void install("/api/git/install")}
              >
                <Download size={14} /> ติดตั้ง
              </button>
            ),
            job: lastJob("git"),
          },
        ]
      : []),
    {
      key: "cli",
      title: "ผู้ช่วย AI",
      done: hasCli,
      optional: false,
      detail: hasCli
        ? `พร้อมใช้: ${clis
            .filter((c) => AI_CLIS.includes(c.id) && c.available)
            .map((c) => c.name)
            .join(", ")}`
        : "ติดตั้ง Claude Code, Codex, OpenCode หรือ Antigravity อย่างน้อย 1 ตัว (OpenCode มีรุ่นฟรี)",
      action: (
        <button className={hasCli ? "setup-btn-secondary" : "setup-btn-primary"} onClick={installCli}>
          <Terminal size={14} /> {hasCli ? "เพิ่มหรือจัดการ" : "ติดตั้งผู้ช่วย AI"}
        </button>
      ),
    },
    {
      key: "project",
      title: "โฟลเดอร์โปรเจกต์",
      done: workspaces.length > 0,
      optional: false,
      detail: workspaces.length
        ? `${workspaces.length} โปรเจกต์ (${workspaces[0]?.name})`
        : "เลือกโฟลเดอร์ที่ให้ AI อ่านและแก้ไฟล์",
      action: !workspaces.length && (
        <button className="setup-btn-primary" onClick={addProject}>
          <FolderPlus size={14} /> เลือกโฟลเดอร์
        </button>
      ),
    },
    {
      key: "login",
      title: "บัญชีผู้ให้บริการ",
      done: Object.values(accounts).some((a) => a.status === "authenticated"),
      optional:
        Object.values(accounts).length > 0 &&
        Object.values(accounts).every((a) => a.status === "unknown"),
      detail:
        "เข้าสู่ระบบ CLI ที่จะใช้ OpenCode รุ่นฟรีและ Ollama ในเครื่องไม่ต้องเข้าสู่ระบบ",
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
            CLI แต่ละตัวเก็บบัญชีของตัวเองไว้ในเครื่องนี้
          </small>
        </div>
      ),
      action: (
        <div className="setup-login-actions" aria-describedby="setup-login-help">
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
      title: "Model และ Effort เริ่มต้น",
      done: defaultsDone,
      optional: false,
      detail: hasCli
        ? "ค่าที่ session ใหม่ของแต่ละผู้ให้บริการจะใช้ เปลี่ยนทีหลังได้ในช่องพิมพ์"
        : "ติดตั้งผู้ช่วย AI ก่อน แล้วค่อยเลือกค่าเริ่มต้น",
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
          <Check size={14} /> ใช้ค่านี้
        </button>
      ),
    },
    {
      key: "skills",
      title: "Skills",
      done: false,
      optional: true,
      detail: "ชุดคำแนะนำเสริมจาก Anthropic, OpenAI, Vercel และ Supabase ที่ AI เรียกใช้เมื่องานตรงกัน",
      action: workspaces.length > 0 && hasCli && (
        <button className="setup-btn-secondary" onClick={openSkills}>
          <Puzzle size={14} /> เปิด Skills
        </button>
      ),
    },
    {
      key: "voice",
      title: "พิมพ์ด้วยเสียง",
      done: !!model,
      optional: true,
      detail: model
        ? "โมเดลเสียงอยู่ในเครื่องแล้ว กดไมค์ในช่องพิมพ์เพื่อพูดแทนพิมพ์"
        : `กดไมค์ในช่องพิมพ์ครั้งแรกเพื่อดาวน์โหลดโมเดลเสียง (${SPEECH_MODELS[voice.model].size})`,
      action: null,
    },
  ];

  const totalCore = steps.filter((s) => !s.optional).length;
  const completedCore = steps.filter((s) => s.done && !s.optional).length;
  const progressPercent = Math.round((completedCore / totalCore) * 100);
  const isReady = completedCore === totalCore;

  const remaining = totalCore - completedCore;

  return (
    <div className="setup-center">
      <header className="setup-status">
        <div className="setup-status-text">
          <h3>{isReady ? "พร้อมใช้งาน" : `เหลืออีก ${remaining} ขั้น`}</h3>
          <p>
            {isReady
              ? "ขั้นหลักครบแล้ว ปิดหน้านี้แล้วเริ่มงานได้เลย ส่วนที่ไม่บังคับทำทีหลังได้"
              : "ทำทีละขั้นด้านล่าง หรือให้แอปติดตั้งส่วนที่ขาดให้"}
          </p>
          <div
            className="setup-meter"
            role="progressbar"
            aria-label="ขั้นหลักที่เสร็จแล้ว"
            aria-valuemin={0}
            aria-valuemax={totalCore}
            aria-valuenow={completedCore}
          >
            <i style={{ width: `${progressPercent}%` }} />
          </div>
          <small>{completedCore} จาก {totalCore} ขั้นหลัก</small>
        </div>
        <div className="setup-status-actions">
          {!isReady && (
            <button
              className="setup-btn-primary"
              disabled={!!running || autoSettingUp}
              onClick={() => void runAutoSetup()}
            >
              <Wand2 size={14} /> {autoSettingUp ? "กำลังติดตั้ง…" : "ติดตั้งส่วนที่ขาด"}
            </button>
          )}
          <button
            className="setup-btn-secondary"
            disabled={checking}
            onClick={() => void check()}
          >
            <RefreshCw size={14} className={checking ? "spin" : ""} /> {checking ? "กำลังตรวจ…" : "ตรวจอีกครั้ง"}
          </button>
        </div>
      </header>

      <ol className="setup-list">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={`setup-row${step.done ? " done" : ""}${step.optional ? " optional" : ""}`}
          >
            <span className="setup-mark" aria-hidden="true">
              {step.done ? <Check size={14} /> : index + 1}
            </span>
            <div className="setup-text">
              <h4>
                <span>{step.title}</span>
                {step.optional && <span className="setup-tag">ไม่บังคับ</span>}
                {step.done && <span className="setup-done-label">เสร็จแล้ว</span>}
              </h4>
              <p>{step.detail}</p>
              {"job" in step && step.job && (
                <p className={`setup-job-status ${step.job.status}`}>
                  {step.job.status === "running" && <LoaderCircle size={13} className="spin" />}
                  {step.job.status === "running"
                    ? "กำลังดาวน์โหลดและติดตั้ง…"
                    : step.job.status === "failed"
                    ? "ติดตั้งไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วกดติดตั้งอีกครั้ง"
                    : "ติดตั้งเสร็จแล้ว"}
                </p>
              )}
            </div>
            {step.action && <div className="setup-row-action">{step.action}</div>}
            {"content" in step && step.content && (
              <div className="setup-row-content">{step.content}</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
