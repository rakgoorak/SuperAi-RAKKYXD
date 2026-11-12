import { useCallback, useEffect, useState } from "react";
import { ArrowUpCircle, Check, LoaderCircle, RefreshCw } from "lucide-react";
import { api, post } from "../api";
import { tr } from '../i18n';

export interface CliVersion {
  id: string; name: string; installed: string | null; latest: string | null;
  status: "latest" | "outdated" | "unknown" | "not-installed" | "error"; note?: string; checkedAt: number;
}
interface UpdateJob { id: string; cliId: string; status: "running" | "completed" | "failed"; log: string; error?: string; before: string | null; after?: string | null; }

/** Installed vs latest version of each AI CLI, with update jobs that refresh themselves. */
export function useCliVersions(onError: (m: string) => void) {
  const [versions, setVersions] = useState<CliVersion[]>([]);
  const [jobs, setJobs] = useState<UpdateJob[]>([]);
  const [checking, setChecking] = useState(false);
  const load = useCallback(async (refresh = false) => {
    setChecking(true);
    try {
      setVersions(await api<CliVersion[]>(`/api/cli-versions${refresh ? "?refresh=1" : ""}`));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);
  const running = jobs.some((j) => j.status === "running");
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      try {
        const next = await api<UpdateJob[]>("/api/cli-updates");
        setJobs(next);
        if (!next.some((j) => j.status === "running")) void load();
      } catch {}
    }, 1200);
    return () => clearInterval(timer);
  }, [running, load]);
  const update = useCallback(async (id: string) => {
    try {
      const job = await post<UpdateJob>(`/api/cli-versions/${id}/update`);
      setJobs((current) => [...current.filter((j) => j.cliId !== id), job]);
    } catch (e) {
      onError((e as Error).message);
    }
  }, [onError]);
  const jobFor = (id: string) => [...jobs].reverse().find((j) => j.cliId === id);
  return { versions, checking, load, update, jobFor };
}

export function CliVersionsPanel({ onError }: { onError: (m: string) => void }) {
  const { versions, checking, load, update, jobFor } = useCliVersions(onError);
  const outdated = versions.filter((v) => v.status === "outdated");
  return (
    <div className="cli-versions">
      <div className="settings-section-title">
        <h3>{tr("เวอร์ชัน CLI")}</h3>
        <div className="inline">
          {outdated.length > 1 && (
            <button className="text-button" onClick={() => outdated.forEach((v) => void update(v.id))}>
              <ArrowUpCircle size={13} /> {tr("อัปเดตทั้งหมด (")}{outdated.length})
            </button>
          )}
          <button className="text-button" disabled={checking} onClick={() => void load(true)}>
            <RefreshCw size={13} className={checking ? "spin" : ""} /> {tr("ตรวจอีกครั้ง")}
          </button>
        </div>
      </div>
      <p className="muted">{tr("CLI ที่เก่าจะอัปเดตตัวเองตอนเปิดแท็บแล้วปิดไป อัปเดตจากที่นี่ก่อนจะราบรื่นกว่า ใช้คำสั่งอัปเดตของแต่ละ CLI เอง ต้องปิดแท็บของตัวนั้นก่อน")}</p>
      <ul className="cli-version-list">
        {versions.length === 0 && <li className="muted">{checking ? tr("กำลังตรวจเวอร์ชัน…") : tr("ยังไม่มีข้อมูล")}</li>}
        {versions.map((v) => {
          const job = jobFor(v.id);
          const busy = job?.status === "running";
          return (
            <li key={v.id} className={`cli-version status-${v.status}`}>
              <div className="cli-version-main">
                <strong>{v.name}</strong>
                <span>
                  {v.status === "not-installed" ? tr("ยังไม่ได้ติดตั้ง") : v.installed ? `v${v.installed}` : "—"}
                  {v.status === "outdated" && v.latest && <> → <b>v{v.latest}</b></>}
                </span>
                <span className={`cli-version-badge ${v.status}`}>
                  {v.status === "latest" ? <><Check size={11} /> {tr("ล่าสุด")}</> : v.status === "outdated" ? tr("มีเวอร์ชันใหม่") : v.status === "unknown" ? tr("ไม่ทราบล่าสุด") : v.status === "error" ? tr("ตรวจไม่ได้") : ""}
                </span>
                {v.status !== "not-installed" && (
                  <button className={v.status === "outdated" ? "primary compact" : "secondary"} disabled={busy} onClick={() => void update(v.id)}>
                    {busy ? <LoaderCircle size={13} className="spin" /> : <ArrowUpCircle size={13} />} {busy ? tr("กำลังอัปเดต") : tr("อัปเดต")}
                  </button>
                )}
              </div>
              {v.note && v.status !== "latest" && <small className="muted">{v.note}</small>}
              {job && (
                <div className={`cli-version-job ${job.status}`}>
                  {job.status === "completed" && <span className="success-text">{tr("อัปเดตเสร็จ")}{job.after ? tr` · ตอนนี้ v${job.after}` : ""}</span>}
                  {job.status === "failed" && <span className="danger-text">{job.error}</span>}
                  {job.log.trim() && <pre>{job.log.trim().split("\n").slice(-4).join("\n")}</pre>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Warning in the "open session" dialog when the chosen CLI is outdated. */
export function OutdatedNotice({ cliId, onError }: { cliId: string; onError: (m: string) => void }) {
  const { versions, update, jobFor } = useCliVersions(onError);
  const v = versions.find((x) => x.id === cliId);
  const job = jobFor(cliId);
  if (!v || (v.status !== "outdated" && (!job || (v.status === "latest" && job.status === "failed")))) return null;
  const lastLogLine = job?.status === "failed" ? job.log.trim().split("\n").filter(Boolean).slice(-1)[0] : "";
  return (
    <div className={`outdated-notice ${job?.status || ""}`} role="status">
      <ArrowUpCircle size={16} />
      <span>
        {job?.status === "running" ? tr`กำลังอัปเดต ${v.name}…`
          : job?.status === "completed" ? tr`อัปเดต ${v.name} แล้ว${job.after ? ` (v${job.after})` : ""} เปิด session ได้เลย`
          : job?.status === "failed" ? <>{job.error}{lastLogLine ? <small className="block muted">{lastLogLine}</small> : null}</>
          : <>{v.name} {tr("มีเวอร์ชันใหม่")} <b>v{v.latest}</b> {tr("(ติดตั้งอยู่ v")}{v.installed}{tr(") ถ้าไม่อัปเดตก่อน CLI อาจอัปเดตตัวเองตอนเปิดแท็บแล้วปิดไป")}</>}
      </span>
      {(!job || job.status === "failed") && <button className="secondary" onClick={() => void update(cliId)}>{tr("อัปเดตก่อนเปิด")}</button>}
      {job?.status === "running" && <LoaderCircle size={14} className="spin" />}
    </div>
  );
}
