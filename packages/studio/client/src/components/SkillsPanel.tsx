import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, LoaderCircle, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import { api, post, type Cli, type InstalledSkill, type Seat, type SkillInfo, type Workspace } from "../api";
import { HEADLESS, firstReady, seatFor } from "../providers";
import { SeatPicker } from "./SeatPicker";

/**
 * Official Agent Skills for the active project. The chosen AI proposes skills; nothing is
 * installed until the user presses install on a specific skill.
 */
export function SkillsPanel({ workspace, clis, ollamaModels, onError, onNotice }: {
  workspace?: Workspace; clis: Cli[]; ollamaModels: string[]; onError: (m: string) => void; onNotice: (m: string) => void;
}) {
  const [catalog, setCatalog] = useState<SkillInfo[]>([]);
  const [installed, setInstalled] = useState<InstalledSkill[]>([]);
  const [picks, setPicks] = useState<SkillInfo[] | null>(null);
  const [seat, setSeat] = useState<Seat>(() => seatFor(firstReady(clis) || HEADLESS[0], "ผู้แนะนำ"));
  const [goal, setGoal] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (!workspace) return;
    setLoading("catalog");
    try {
      const [c, i] = await Promise.all([api<SkillInfo[]>(`/api/skills/catalog${refresh ? "?refresh=1" : ""}`), api<InstalledSkill[]>(`/api/workspaces/${workspace.id}/skills`)]);
      setCatalog(c);
      setInstalled(i);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading("");
    }
  }, [workspace, onError]);
  useEffect(() => { void load(); }, [load]);

  if (!workspace) return <p className="muted">เพิ่มโปรเจกต์ก่อน แล้วค่อยเลือก skill ให้โปรเจกต์นั้น</p>;
  const isInstalled = (name: string) => installed.some((s) => s.name === name);

  const recommend = async () => {
    setLoading("recommend");
    setPicks(null);
    try {
      setPicks(await post<SkillInfo[]>(`/api/workspaces/${workspace.id}/skills/recommend`, { seat, goal }));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading("");
    }
  };
  const install = async (skill: SkillInfo) => {
    setLoading(`install:${skill.name}`);
    try {
      await post(`/api/workspaces/${workspace.id}/skills`, { source: skill.source, name: skill.name });
      onNotice(`ติดตั้ง skill ${skill.name} แล้ว · AI จะเรียกใช้เองเมื่องานเกี่ยวข้อง`);
      await load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading("");
    }
  };
  const remove = async (name: string) => {
    setLoading(`remove:${name}`);
    try {
      await api(`/api/workspaces/${workspace.id}/skills/${encodeURIComponent(name)}`, { method: "DELETE" });
      onNotice(`ลบ skill ${name} แล้ว`);
      await load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading("");
    }
  };
  const card = (skill: SkillInfo) => (
    <li key={`${skill.source}/${skill.name}`} className="skill-card">
      <div>
        <strong>{skill.name}</strong>
        <small>{skill.sourceLabel} · {skill.files.length} ไฟล์{skill.files.some((f) => /\.(py|js|sh|ps1|ts)$/i.test(f)) ? " · มีสคริปต์" : ""}</small>
        {skill.reason && <p className="skill-reason">เหตุผล: {skill.reason}</p>}
        <p>{skill.description || "ไม่มีคำอธิบาย"}</p>
      </div>
      <div className="skill-actions">
        <a className="text-button" href={skill.url} target="_blank" rel="noreferrer" title="ดูไฟล์ทั้งหมดบน GitHub ก่อนติดตั้ง"><ExternalLink size={13} /> ดูไฟล์</a>
        {isInstalled(skill.name) ? (
          <span className="success-text">ติดตั้งแล้ว</span>
        ) : (
          <button className="secondary" disabled={!!loading} onClick={() => void install(skill)}>
            {loading === `install:${skill.name}` ? <LoaderCircle size={13} className="spin" /> : <Download size={13} />} ติดตั้ง
          </button>
        )}
      </div>
    </li>
  );
  const shown = catalog.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="skills-panel">
      <p className="muted">
        Skill คือชุดคำแนะนำ/สคริปต์ที่ AI เรียกใช้เองเมื่องานเกี่ยวข้อง ดึงจากแหล่งทางการของ Anthropic และ OpenAI เท่านั้น ติดตั้งลงโปรเจกต์
        <code>{workspace.name}</code> ที่ <code>.claude/skills</code> (Claude, OpenCode) และ <code>.agents/skills</code> (Codex) · ติดตั้งเมื่อคุณกดยืนยันเท่านั้น
      </p>
      <section className="skills-recommend">
        <h3><Sparkles size={15} /> ให้ AI เลือก skill ที่จำเป็น</h3>
        <SeatPicker seat={seat} onChange={setSeat} label="ผู้แนะนำ skill" named={false} clis={clis} ollamaModels={ollamaModels} disabled={!!loading} />
        <div className="input-action">
          <input value={goal} maxLength={2000} placeholder="งานที่จะทำ (ไม่บังคับ) เช่น ทำเว็บขายของและทดสอบหน้าเว็บ" onChange={(e) => setGoal(e.target.value)} />
          <button className="primary" disabled={!!loading} onClick={() => void recommend()}>
            {loading === "recommend" ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />} วิเคราะห์โปรเจกต์
          </button>
        </div>
        {loading === "recommend" && <p className="muted">AI กำลังอ่านโครงสร้างโปรเจกต์และเลือก skill อาจใช้เวลาสักครู่…</p>}
        {picks && (picks.length ? <ul className="skill-list">{picks.map(card)}</ul> : <p className="muted">AI ไม่พบ skill ที่จำเป็นเพิ่มสำหรับโปรเจกต์นี้</p>)}
      </section>
      {installed.length > 0 && (
        <section>
          <h3>ติดตั้งในโปรเจกต์นี้ ({installed.length})</h3>
          <ul className="installed-skills">
            {installed.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong>
                <small>{s.targets.join(", ")}{s.managed ? "" : " · เพิ่มเอง"}</small>
                {s.managed && (
                  <button className="icon-button" title={`ลบ ${s.name}`} disabled={!!loading} onClick={() => void remove(s.name)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <div className="settings-section-title">
          <h3>skill ทั้งหมด ({catalog.length})</h3>
          <button className="text-button" disabled={!!loading} onClick={() => void load(true)}>
            <RefreshCw size={13} className={loading === "catalog" ? "spin" : ""} /> โหลดใหม่
          </button>
        </div>
        <label className="project-search">
          <Search size={14} />
          <input placeholder="ค้นหา skill" aria-label="ค้นหา skill" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
        <ul className="skill-list">{shown.map(card)}</ul>
      </section>
    </div>
  );
}
