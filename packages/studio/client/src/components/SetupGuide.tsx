import { useCallback, useEffect, useState } from "react";
import { Check, Download, FolderPlus, LoaderCircle, LogIn, RefreshCw, Terminal } from "lucide-react";
import { api, post, type Cli, type NodeStatus, type Workspace } from "../api";
import { SPEECH_MODELS } from "../voice/models";
import type { VoiceSettings } from "../voice/speech";
import { isModelCached } from "../voice/stt";
import { confirmDefaults, defaultsConfirmed } from "../providers";
import { ProviderDefaults } from "./ProviderDefaults";

interface GitStatus { required: boolean; installed: boolean; version: string | null }
interface Job { id: string; cliId: string; status: string; log: string; error?: string }

const AI_CLIS = ["claude-code", "codex", "opencode", "antigravity"];
const LOGIN_KEY = "superai-setup-login";

export function setupNeeded(clis: Cli[], workspaces: Workspace[]) {
  let loggedIn = false;
  try { loggedIn = localStorage.getItem(LOGIN_KEY) === "1"; } catch {}
  const node = clis[0]?.nodeReady ?? true;
  return !node || !clis.some((c) => AI_CLIS.includes(c.id) && c.available) || !workspaces.length || !loggedIn || !defaultsConfirmed();
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

export function SetupGuide({ clis, workspaces, voice, refreshClis, addProject, installCli, login, openSkills, onError }: Props) {
  const [defaultsDone, setDefaultsDone] = useState(defaultsConfirmed);
  const [node, setNode] = useState<NodeStatus | null>(null);
  const [git, setGit] = useState<GitStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loggedIn, setLoggedIn] = useState(() => { try { return localStorage.getItem(LOGIN_KEY) === "1"; } catch { return false; } });
  const [model, setModel] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const [n, g] = await Promise.all([api<NodeStatus>("/api/node/status"), api<GitStatus>("/api/git/status"), refreshClis()]);
      setNode(n); setGit(g);
      setModel(await isModelCached(SPEECH_MODELS[voice.model].repo));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }, [refreshClis, onError, voice.model]);

  useEffect(() => { void check(); }, [check]);

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
    try { const job = await post<Job>(url); setJobs((current) => [...current, job]); }
    catch (e) { onError((e as Error).message); }
  };
  const markLogin = (value: boolean) => {
    setLoggedIn(value);
    try { localStorage.setItem(LOGIN_KEY, value ? "1" : "0"); } catch {}
  };
  const lastJob = (id: string) => [...jobs].reverse().find((j) => j.cliId === id);
  const firstCli = clis.find((c) => AI_CLIS.includes(c.id) && c.available);
  const hasCli = !!firstCli;

  const steps = [
    {
      key: "node", title: "Node.js 22", done: !!node?.ready, optional: false,
      detail: node?.ready ? `พร้อมใช้ · ${node.version}` : node?.version ? `รุ่นปัจจุบัน ${node.version} เก่าเกินไป` : "จำเป็นสำหรับติดตั้ง CLI ของ AI · ติดตั้งในโฟลเดอร์ของ SuperAi ไม่แก้ระบบ",
      action: !node?.ready && <button className="secondary" disabled={!!running} onClick={() => void install("/api/node/install")}><Download size={14} /> ติดตั้งอัตโนมัติ</button>,
      job: lastJob("node"),
    },
    ...(git?.required ? [{
      key: "git", title: "Git for Windows", done: git.installed, optional: false,
      detail: git.installed ? `พร้อมใช้ · ${git.version || "Git Bash"}` : "Claude Code บน Windows ต้องใช้ Git Bash · ติดตั้งแบบพกพา ไม่ต้องใช้สิทธิ์ผู้ดูแล",
      action: !git.installed && <button className="secondary" disabled={!!running} onClick={() => void install("/api/git/install")}><Download size={14} /> ติดตั้งอัตโนมัติ</button>,
      job: lastJob("git"),
    }] : []),
    {
      key: "cli", title: "ผู้ช่วย AI อย่างน้อย 1 ตัว", done: hasCli, optional: false,
      detail: hasCli ? `พร้อมใช้: ${clis.filter((c) => AI_CLIS.includes(c.id) && c.available).map((c) => c.name).join(", ")}` : "Claude Code, Codex, OpenCode หรือ Antigravity CLI · OpenCode มีรุ่นฟรีให้ลอง",
      action: <button className="secondary" onClick={installCli}><Terminal size={14} /> {hasCli ? "เพิ่มตัวอื่น" : "เลือกและติดตั้ง"}</button>,
    },
    {
      key: "project", title: "โฟลเดอร์โปรเจกต์", done: workspaces.length > 0, optional: false,
      detail: workspaces.length ? `${workspaces.length} โปรเจกต์` : "เลือกโฟลเดอร์ที่จะให้ AI ทำงาน หรือสร้างโฟลเดอร์ใหม่",
      action: !workspaces.length && <button className="secondary" onClick={addProject}><FolderPlus size={14} /> เพิ่มโปรเจกต์</button>,
    },
    {
      key: "login", title: "เข้าสู่ระบบบัญชี AI", done: loggedIn, optional: false,
      detail: "เปิด session แล้วทำตามขั้นตอนเข้าสู่ระบบของ CLI นั้น เสร็จแล้วกดยืนยัน แอปไม่เก็บรหัสผ่านของคุณ",
      action: (
        <div className="inline">
          <button className="secondary" disabled={!firstCli || !workspaces.length} onClick={() => firstCli && login(firstCli.id)}><LogIn size={14} /> เปิด {firstCli?.name || "CLI"}</button>
          <label className="setup-confirm"><input type="checkbox" checked={loggedIn} onChange={(e) => markLogin(e.target.checked)} /> เข้าสู่ระบบแล้ว</label>
        </div>
      ),
    },
    {
      key: "defaults", title: "เลือก model และ effort เริ่มต้น", done: defaultsDone, optional: false,
      detail: hasCli
        ? "เลือกรุ่นและระดับความคิด (effort) ของแต่ละผู้ให้บริการ ใช้เป็นค่าตั้งต้นในโหมด Agent, Code และ Chat · เว้นว่างเพื่อใช้ค่าของ CLI"
        : "ติดตั้งผู้ช่วย AI ก่อน แล้วจึงเลือก model และ effort",
      content: hasCli && <ProviderDefaults clis={clis} onSaved={() => setDefaultsDone(true)} />,
      action: hasCli && !defaultsDone && (
        <button className="secondary" onClick={() => { confirmDefaults(); setDefaultsDone(true); }}>
          <Check size={14} /> ใช้ค่านี้
        </button>
      ),
    },
    {
      key: "skills", title: "Skills ที่จำเป็น (ไม่บังคับ)", done: false, optional: true,
      detail: "ให้ AI วิเคราะห์โปรเจกต์แล้วเสนอ skill จากแหล่งทางการ คุณกดยืนยันก่อนติดตั้งทุกครั้ง",
      action: workspaces.length > 0 && hasCli && <button className="secondary" onClick={openSkills}>เลือก skill</button>,
    },
    {
      key: "voice", title: "พูดเพื่อพิมพ์ (ไม่บังคับ)", done: !!model, optional: true,
      detail: model
        ? "โมเดลแปลงเสียงพร้อม · กดค้างปุ่มไมค์ในช่องพิมพ์แล้วพูด"
        : `กดปุ่มไมค์ในช่องพิมพ์ครั้งแรก แอปจะถามก่อนดาวน์โหลดโมเดลแปลงเสียง (${SPEECH_MODELS[voice.model].size}) ครั้งเดียว`,
      action: null,
    },
  ];
  const remaining = steps.filter((s) => !s.done && !s.optional).length;

  return (
    <div className="setup-guide">
      <div className="setup-summary">
        <strong>{remaining ? `เหลืออีก ${remaining} ขั้นตอน` : "พร้อมใช้งานแล้ว"}</strong>
        <button className="text-button" disabled={checking} onClick={() => void check()}><RefreshCw size={13} className={checking ? "spin" : ""} /> ตรวจอีกครั้ง</button>
      </div>
      <ol className="setup-steps">
        {steps.map((step, index) => (
          <li key={step.key} className={step.done ? "done" : ""}>
            <span className="setup-index">{step.done ? <Check size={14} /> : index + 1}</span>
            <div className="setup-body">
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
              {"content" in step && step.content}
              {"job" in step && step.job && (
                <div className={`setup-job ${step.job.status}`}>
                  {step.job.status === "running" && <LoaderCircle size={12} className="spin" />}
                  <span>{step.job.error || step.job.log.trim().split("\n").at(-1)}</span>
                </div>
              )}
            </div>
            {step.action && (!step.done || step.key === "cli") ? <div className="setup-action">{step.action}</div> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
