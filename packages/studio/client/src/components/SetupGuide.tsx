import { useCallback, useEffect, useState } from "react";
import { Check, Download, FolderPlus, LoaderCircle, MessageSquare, Settings2, Sparkles } from "lucide-react";
import { api, post, type Cli, type CliAuthStatus, type NodeStatus, type Workspace } from "../api";
import { ProviderAccess } from "./ProviderAccess";
import { ProviderDefaults } from "./ProviderDefaults";
import { SPEECH_MODELS } from "../voice/models";
import type { VoiceSettings } from "../voice/speech";
import { defaultsConfirmed } from "../providers";
import "../beginner-experience.css";

interface GitStatus { required: boolean; installed: boolean; version: string | null; }
interface Job { id: string; cliId: string; status: string; log: string; error?: string; }
const AI_CLIS = ["claude-code", "codex", "opencode", "antigravity", "freebuff"];
const ACK = "superai-setup-login:";
export function setupNeeded(clis: Cli[], workspaces: Workspace[]) {
  return !(clis[0]?.nodeReady ?? true) || !clis.some(c => AI_CLIS.includes(c.id) && c.available) || !workspaces.length || !defaultsConfirmed();
}
interface Props {
  clis: Cli[]; workspaces: Workspace[]; workspaceId?: string; voice: VoiceSettings;
  refreshClis: () => Promise<void>; addProject: () => void; openSkills: () => void;
  onStart: (cliId: string, workspaceId: string, draft: string) => Promise<void>;
  onGeneralChat?: () => Promise<Workspace>;
}
export function SetupGuide({ clis, workspaces, workspaceId, voice, refreshClis, addProject, openSkills, onStart, onGeneralChat }: Props) {
  const available = clis.filter(c => AI_CLIS.includes(c.id));
  const [assistant, setAssistant] = useState(() => available.find(c => c.available)?.id || available[0]?.id || "codex");
  const [folder, setFolder] = useState(workspaceId || workspaces[0]?.id || "");
  const [step, setStep] = useState(workspaces.length ? 1 : 0);
  const [accounts, setAccounts] = useState<Record<string, CliAuthStatus>>({});
  const onStatus = useCallback((status: CliAuthStatus) => setAccounts(current => ({ ...current, [status.id]: status })), []);
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>(() => {
    try { return Object.fromEntries(AI_CLIS.map(id => [id, localStorage.getItem(ACK + id) === "1"])); } catch { return {}; }
  });
  const [node, setNode] = useState<NodeStatus | null>(null);
  const [git, setGit] = useState<GitStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [problem, setProblem] = useState("");
  const [draft, setDraft] = useState("");
  useEffect(() => {
    if (available.length && !available.some(c => c.id === assistant)) setAssistant(available.find(c => c.available)?.id || available[0].id);
  }, [clis, assistant]);
  useEffect(() => {
    if (!workspaces.some(w => w.id === folder)) setFolder(workspaceId || workspaces[0]?.id || "");
  }, [workspaces, workspaceId, folder]);
  const check = useCallback(async () => {
    setChecking(true);
    try {
      const [n, g, currentJobs] = await Promise.all([
        api<NodeStatus>("/api/node/status"), api<GitStatus>("/api/git/status"),
        api<Job[]>("/api/cli-installs"), refreshClis(),
      ]);
      setNode(n); setGit(g); setJobs(currentJobs); setProblem("");
    } catch { setProblem("ตรวจความพร้อมไม่สำเร็จ ตรวจการเชื่อมต่อแล้วกดลองอีกครั้ง"); }
    finally { setChecking(false); }
  }, [refreshClis]);
  useEffect(() => { void check(); }, [check]);
  const running = jobs.find(job => job.status === "running");
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(async () => {
      try {
        const current = await api<Job[]>("/api/cli-installs"); setJobs(current);
        if (!current.some(job => job.status === "running")) void check();
      } catch { setProblem("ยังอ่านผลติดตั้งไม่ได้ กดตรวจอีกครั้งเพื่อติดตามผล ไม่ต้องเริ่มติดตั้งซ้ำ"); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, check]);
  const install = async (url: string) => {
    setInstalling(true); setProblem("");
    try {
      const job = await post<Job>(url); setJobs(current => [...current.filter(j => j.id !== job.id), job]);
      if (job.status !== "running") await check();
    } catch { setProblem("เริ่มติดตั้งไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง"); }
    finally { setInstalling(false); }
  };
  const selected = available.find(c => c.id === assistant);
  const workspace = workspaces.find(w => w.id === folder);
  const toolsReady = !!node?.ready && !!git && (!git.required || git.installed);
  const auth = accounts[assistant];
  const accountReady = auth?.status === "authenticated" || assistant === "opencode" || (auth?.status === "unknown" && acknowledged[assistant]);
  const assistantReady = toolsReady && !!selected?.available && !!accountReady;
  const busy = checking || installing || !!running || starting;
  const nextInstall = node && !node.ready ? "/api/node/install" : git?.required && !git.installed ? "/api/git/install" : null;
  const nextInstallName = node && !node.ready ? "เครื่องมือพื้นฐาน" : "เครื่องมือจัดการไฟล์";
  const lastFailed = jobs.at(-1)?.status === "failed" ? jobs.at(-1) : undefined;
  const markAccount = (value: boolean) => {
    try { localStorage.setItem(ACK + assistant, value ? "1" : "0"); setAcknowledged(current => ({ ...current, [assistant]: value })); }
    catch { setProblem("บันทึกการยืนยันไม่ได้ ตรวจพื้นที่จัดเก็บของแอปแล้วลองอีกครั้ง"); }
  };
  return <div className="beginner-setup">
    <p className="beginner-intro">เริ่มจากผู้ช่วย AI เพียงตัวเดียวก็พอ คุณไม่ต้องเขียนคำสั่งหรือตั้งค่ารุ่น AI เอง</p>
    <ol className="beginner-steps" aria-label="ขั้นตอนเริ่มใช้งาน">
      {[["เลือกโฟลเดอร์", !!workspace], ["เชื่อมต่อ AI", assistantReady], ["เริ่มคุย", false]].map(([label, done], index) => <li key={index}>
        <button aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}><span>{done ? <Check size={15} /> : index + 1}</span>{label}</button>
      </li>)}
    </ol>
    {problem && <div role="alert" className="beginner-problem">{problem}<button className="text-button" disabled={busy} onClick={() => void check()}>ลองตรวจอีกครั้ง</button></div>}
    {step === 0 && <section className="beginner-step" aria-label="เลือกโฟลเดอร์ทำงาน">
      <FolderPlus size={24} /><h3>อยากให้ AI ช่วยทำงานในโฟลเดอร์ไหน?</h3>
      <p>เลือกโฟลเดอร์เมื่อต้องการให้ AI ช่วยดูไฟล์งาน หรือเริ่มคุยทั่วไปได้โดยยังไม่เลือกโฟลเดอร์ของคุณ</p>
      {onGeneralChat && <button className="secondary" disabled={busy} onClick={async () => {
        setStarting(true); setProblem('');
        try { const ws = await onGeneralChat(); setFolder(ws.id); setStep(1); }
        catch (error) { setProblem((error as Error).message || 'เตรียมพื้นที่แชตไม่ได้ ลองอีกครั้ง'); }
        finally { setStarting(false); }
      }}><MessageSquare size={15} /> คุยทั่วไปโดยไม่เลือกโฟลเดอร์</button>}
      {workspaces.length > 0 && <label className="beginner-field">โฟลเดอร์ทำงาน<select aria-label="โฟลเดอร์ทำงาน" value={folder} onChange={event => setFolder(event.target.value)}>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select><small>{workspace?.rootPath}</small></label>}
      <div className="beginner-actions"><button className={workspace ? "secondary" : "primary"} onClick={addProject}><FolderPlus size={15} /> {workspace ? "เพิ่มโฟลเดอร์อื่น" : "เลือกโฟลเดอร์งาน"}</button>{workspace && <button className="primary" onClick={() => setStep(1)}>ถัดไป: เลือก AI</button>}</div>
    </section>}
    {step === 1 && <section className="beginner-step" aria-label="เลือกและเชื่อมต่อผู้ช่วย AI">
      <Sparkles size={24} /><h3>เลือก AI ที่คุณอยากคุยด้วย</h3><p>มีบัญชี ChatGPT หรือ Claude อยู่แล้ว เลือกผู้ช่วยที่ตรงกับบัญชีของคุณ ต้องมีผู้ช่วยที่พร้อมใช้อย่างน้อยหนึ่งตัว</p>
      <label className="beginner-field">ผู้ช่วย AI<select aria-label="ผู้ช่วยสำหรับเริ่มต้น" value={assistant} onChange={event => setAssistant(event.target.value)}>{available.map(c => <option key={c.id} value={c.id}>{c.name}{c.available ? " · ติดตั้งแล้ว" : " · ยังไม่ติดตั้ง"}</option>)}</select></label>
      {!available.length && <p role="status">ยังโหลดรายชื่อผู้ช่วยไม่ได้ <button className="secondary" disabled={busy} onClick={() => void check()}>โหลดรายชื่อใหม่</button></p>}
      {running && <p role="status"><LoaderCircle size={15} className="spin" /> กำลังติดตั้ง รอให้เสร็จแล้วแอปจะตรวจให้อีกครั้ง</p>}
      {lastFailed && !running && <p role="alert">ติดตั้งไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วกดติดตั้งอีกครั้ง</p>}
      {!toolsReady && <div className="beginner-readiness"><h4>เตรียมเครื่องก่อนเริ่ม</h4><p>แอปต้องใช้เครื่องมือพื้นฐานเพื่อเปิดผู้ช่วย เราจะติดตั้งเฉพาะส่วนที่ยังขาด</p>
        {nextInstall ? <button className="primary" disabled={busy} onClick={() => void install(nextInstall)}><Download size={15} /> ติดตั้ง{nextInstallName}</button> : <button className="secondary" disabled={busy} onClick={() => void check()}>{checking ? "กำลังตรวจความพร้อม…" : "ตรวจความพร้อมอีกครั้ง"}</button>}
      </div>}
      {toolsReady && selected && !selected.available && <button className="primary" disabled={busy} onClick={() => void install(`/api/clis/${assistant}/install`)}><Download size={15} /> ติดตั้ง {selected.name}</button>}
      {toolsReady && selected?.available && <div className="beginner-account"><h4>เชื่อมบัญชีของคุณ</h4><p>{auth?.status === "authenticated" ? "บัญชีนี้เชื่อมต่อแล้ว กดถัดไปเพื่อเริ่มคุยได้เลย" : "กดเข้าสู่ระบบ แล้วทำตามหน้าต่างที่เปิดขึ้น แอปจะไม่ขอรหัสผ่านของคุณในหน้านี้"}</p>
        <ProviderAccess key={assistant} provider={assistant} wsId={folder || undefined} onStatus={onStatus} friendly />
        {!folder && <p>เลือกโฟลเดอร์ในขั้นที่ 1 ก่อน จึงจะเปิดหน้าเข้าสู่ระบบได้</p>}
        {auth?.status === "unknown" && assistant !== "opencode" && <label className="setup-confirm"><input type="checkbox" checked={!!acknowledged[assistant]} onChange={event => markAccount(event.target.checked)} /> ฉันเข้าสู่ระบบผู้ช่วยนี้ในหน้าต่างที่เปิดแล้ว</label>}
        {assistant === "opencode" && <small>บางรุ่นใช้ฟรีได้โดยไม่เชื่อมบัญชี หากเลือกรุ่นที่ต้องใช้บัญชี ให้เข้าสู่ระบบก่อน</small>}
      </div>}
      <details className="beginner-details"><summary>รายละเอียดเครื่องมือ (สำหรับผู้ที่ต้องการตรวจเพิ่ม)</summary><dl><dt>Node.js</dt><dd>{node ? node.ready ? `พร้อมใช้ ${node.version || ""}` : "ยังต้องติดตั้ง" : "กำลังตรวจ"}</dd><dt>Git</dt><dd>{git ? !git.required ? "ไม่จำเป็นบนเครื่องนี้" : git.installed ? `พร้อมใช้ ${git.version || ""}` : "ยังต้องติดตั้ง" : "กำลังตรวจ"}</dd></dl></details>
      <div className="beginner-actions"><button className="secondary" onClick={() => setStep(0)}>ย้อนกลับ</button><button className="primary" disabled={!assistantReady || busy} onClick={() => setStep(2)}>ถัดไป: เริ่มคุย</button></div>
    </section>}
    {step === 2 && <section className="beginner-step" aria-label="เริ่มบทสนทนาแรก">
      <MessageSquare size={24} /><h3>บอกสิ่งที่อยากให้ AI ช่วย</h3><p>พิมพ์ด้วยภาษาปกติได้เลย เช่น เล่าเป้าหมายและผลลัพธ์ที่อยากได้ ไม่ต้องรู้ศัพท์เทคนิค</p>
      <div className="beginner-examples" aria-label="ตัวอย่างงานเริ่มต้น">{["ช่วยอธิบายว่าไฟล์ในโฟลเดอร์นี้มีไว้ทำอะไร โดยยังไม่แก้ไฟล์", "ช่วยวางแผนทำเว็บไซต์แนะนำร้านของฉัน", "ช่วยตรวจงานนี้และอธิบายจุดที่ควรปรับด้วยภาษาง่าย ๆ"].map(text => <button className="secondary" key={text} onClick={() => setDraft(text)}>{text}</button>)}</div>
      <label className="beginner-field">ข้อความแรก (จะตรวจอีกครั้งก่อนส่งก็ได้)<textarea aria-label="ข้อความแรก" value={draft} onChange={event => setDraft(event.target.value)} rows={3} placeholder="อยากให้ช่วยอะไร พิมพ์ตรงนี้ได้เลย…" /></label>
      <p className="beginner-summary">คุยกับ <strong>{selected?.name || "ผู้ช่วยที่เลือก"}</strong> ใน <strong>{workspace?.name || "โฟลเดอร์ที่เลือก"}</strong> · ใช้ค่ารุ่น AI เริ่มต้น</p>
      {(!assistantReady || !workspace) && <p role="status">ยังมีขั้นตอนที่ไม่พร้อม กลับไปเลือกโฟลเดอร์หรือเชื่อมต่อ AI ก่อนเริ่ม</p>}
      <div className="beginner-actions"><button className="secondary" onClick={() => setStep(1)}>ย้อนกลับ</button><button className="primary" disabled={!assistantReady || !workspace || busy} onClick={async () => {
        setStarting(true); setProblem("");
        try { await onStart(assistant, folder, draft); } catch (error) { setProblem((error as Error).message || "เปิดห้องคุยไม่สำเร็จ ลองอีกครั้ง"); } finally { setStarting(false); }
      }}>{starting ? <LoaderCircle size={15} className="spin" /> : <MessageSquare size={15} />} เปิดห้องคุยกับ AI</button></div><small>ยังไม่ส่งข้อความอัตโนมัติ คุณอ่านและแก้ก่อนกดส่งได้</small>
    </section>}
    <details className="beginner-details"><summary><Settings2 size={14} /> ตัวเลือกเพิ่มเติม — ไม่จำเป็นต้องตั้งก่อนเริ่ม</summary>
      <h4>รุ่น AI และระดับการคิด</h4><p>ใช้ค่าเริ่มต้นได้ หากต้องการปรับเองค่อยเปิดรายการด้านล่าง</p><details><summary>ปรับรุ่น AI เอง</summary><ProviderDefaults clis={clis} /></details>
      <h4>ความสามารถเสริม (Skills)</h4><p>เพิ่มคำแนะนำเฉพาะทางให้ AI เช่น ออกแบบหรือทดสอบเว็บ</p><button className="secondary" disabled={!workspace} onClick={openSkills}>เลือกความสามารถเสริม</button>
      <h4>พิมพ์ด้วยเสียง</h4><p>กดรูปไมค์ข้างช่องข้อความ ครั้งแรกอาจต้องดาวน์โหลดข้อมูลเสียง {SPEECH_MODELS[voice.model].size}</p>
    </details>
  </div>;
}
