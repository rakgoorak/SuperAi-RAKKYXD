import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, LoaderCircle, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import { api, post, type Cli, type InstalledSkill, type Seat, type SkillInfo, type Workspace } from "../api";
import { HEADLESS, firstReady, seatFor } from "../providers";
import { SeatPicker } from "./SeatPicker";
import "../beginner-experience.css";

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

  const [tab, setTab] = useState<"catalog" | "skills.sh">("catalog");
  const [shQuery, setShQuery] = useState("");
  const [shResults, setShResults] = useState<SkillInfo[]>([]);
  const [shSearching, setShSearching] = useState(false);
  const [shHasSearched, setShHasSearched] = useState(false);
  const [shError, setShError] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [catalogError, setCatalogError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (!workspace) return;
    setLoading("catalog");
    setCatalogError("");
    try {
      const [c, i] = await Promise.all([
        api<SkillInfo[]>(`/api/skills/catalog${refresh ? "?refresh=1" : ""}`),
        api<InstalledSkill[]>(`/api/workspaces/${workspace.id}/skills`),
      ]);
      setCatalog(c);
      setInstalled(i);
    } catch (e) {
      setCatalogError((e as Error).message);
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
      await post(`/api/workspaces/${workspace.id}/skills`, {
        source: skill.source,
        name: skill.name,
        repo: skill.repo,
        branch: skill.branch,
        prefix: skill.prefix,
        files: skill.files,
      });
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

  const searchSkillsSh = async (e?: React.FormEvent, query = shQuery) => {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      onError("กรุณากรอกคำค้นหาอย่างน้อย 2 ตัวอักษร");
      return;
    }
    setShSearching(true);
    setShHasSearched(true);
    setShError(""); setSubmittedQuery(q); setShResults([]);
    try {
      const res = await api<SkillInfo[]>(`/api/skills/search?q=${encodeURIComponent(q)}`);
      setShResults(res);
    } catch (err: any) {
      setShError(err.message || "ค้นหาไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
    } finally {
      setShSearching(false);
    }
  };

  const card = (skill: SkillInfo) => (
    <li key={`${skill.source}/${skill.repo || ""}/${skill.name}`} className="skill-card">
      <div>
        <strong>{skill.name}</strong>
        <small>
          {skill.sourceLabel} · {skill.files.length} ไฟล์
          {skill.files.some((f) => /\.(py|js|sh|ps1|ts)$/i.test(f)) ? " · มีสคริปต์" : ""}
          {typeof skill.installs === "number" ? ` · ${skill.installs.toLocaleString()} ติดตั้ง` : ""}
        </small>
        {skill.reason && <p className="skill-reason">เหตุผล: {skill.reason}</p>}
        <p>{skill.description || "ไม่มีคำอธิบาย"}</p>
      </div>
      <div className="skill-actions">
        <a className="text-button" href={skill.url} target="_blank" rel="noreferrer" title="ดูไฟล์ทั้งหมดบน GitHub ก่อนติดตั้ง">
          <ExternalLink size={13} /> ดูไฟล์
        </a>
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
        Skills คือความสามารถเสริมให้ AI เช่น ออกแบบเว็บหรือทดสอบงาน เลือกติดตั้งเฉพาะที่ต้องใช้ในโปรเจกต์ <strong>{workspace.name}</strong> หรือเริ่มใช้งานโดยยังไม่ติดตั้งก็ได้
      </p>
      <details className="skills-recommend">
        <summary><Sparkles size={15} /> ให้ AI ช่วยเลือกให้ (ไม่บังคับ)</summary>
        <SeatPicker seat={seat} onChange={setSeat} label="ผู้แนะนำ skill" named={false} clis={clis} ollamaModels={ollamaModels} disabled={!!loading} />
        <div className="input-action">
          <input value={goal} maxLength={2000} placeholder="งานที่จะทำ (ไม่บังคับ) เช่น ทำเว็บขายของและทดสอบหน้าเว็บ" onChange={(e) => setGoal(e.target.value)} />
          <button className="primary" disabled={!!loading} onClick={() => void recommend()}>
            {loading === "recommend" ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />} วิเคราะห์โปรเจกต์
          </button>
        </div>
        {loading === "recommend" && <p className="muted">AI กำลังอ่านโครงสร้างโปรเจกต์และเลือก skill อาจใช้เวลาสักครู่…</p>}
        {picks && (picks.length ? <ul className="skill-list">{picks.map(card)}</ul> : <p className="muted">AI ไม่พบ skill ที่จำเป็นเพิ่มสำหรับโปรเจกต์นี้</p>)}
      </details>
      {installed.length > 0 && (
        <details className="skills-installed">
          <summary>ติดตั้งในโปรเจกต์นี้ ({installed.length})</summary>
          <ul className="installed-skills">
            {installed.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong>
                <small title={s.targets.join(", ")}>{s.managed ? "พร้อมใช้กับ AI" : "เพิ่มไว้แล้ว"}</small>
                {s.managed && (
                  <button className="icon-button" title={`ลบ ${s.name}`} disabled={!!loading} onClick={() => void remove(s.name)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="muted">AI จะเลือกใช้เมื่อเกี่ยวข้องกับงาน คุณไม่ต้องเปิดทีละตัว</p>
        </details>
      )}
      <section>
        <div className="skill-tabs">
          <button
            type="button"
            className={tab === "catalog" ? "active" : ""}
            onClick={() => setTab("catalog")}
          >
            รายการแนะนำ ({catalog.length})
          </button>
          <button
            type="button"
            className={tab === "skills.sh" ? "active" : ""}
            onClick={() => setTab("skills.sh")}
          >
            ค้นหาบน skills.sh
          </button>
        </div>

        {tab === "catalog" ? (
          <>
            <div className="settings-section-title">
              <span className="muted">เริ่มเลือกจากแหล่งทางการ: Anthropic, OpenAI, Vercel Labs และ Supabase</span>
              <button className="text-button" disabled={!!loading} onClick={() => void load(true)}>
                <RefreshCw size={13} className={loading === "catalog" ? "spin" : ""} /> โหลดใหม่
              </button>
            </div>
            <label className="project-search">
              <Search size={14} />
              <input placeholder="ค้นหาในแค็ตตาล็อกหลัก" aria-label="ค้นหา skill" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </label>
            {catalogError && <p role="alert">โหลดรายการไม่สำเร็จ กดโหลดใหม่เพื่อลองอีกครั้ง</p>}
            <ul className="skill-list">{shown.map(card)}</ul>
          </>
        ) : (
          <>
            <div className="settings-section-title">
              <span className="muted">เลือกหมวดงานหรือพิมพ์คำค้น เพื่อค้นหาเพิ่มเติมจาก skills.sh</span>
            </div>
            <form onSubmit={(e) => void searchSkillsSh(e)} className="skills-search-bar">
              <input
                aria-label="ค้นหาบน skills.sh"
                placeholder="พิมพ์ชื่อ skill เช่น browser, react, docker, python..."
                value={shQuery}
                onChange={(e) => setShQuery(e.target.value)}
                disabled={shSearching}
              />
              <button className="primary" type="submit" disabled={shSearching || shQuery.trim().length < 2}>
                {shSearching ? <LoaderCircle size={14} className="spin" /> : <Search size={14} />} ค้นหา
              </button>
            </form>
            <div className="skill-categories" aria-label="เลือกหมวดค้นหา">
              {[["ออกแบบเว็บ", "frontend"], ["ทดสอบเว็บ", "testing"], ["จัดการไฟล์", "files"], ["เขียน Python", "python"]].map(([label, query]) => <button key={query} className="secondary" disabled={shSearching} onClick={() => { setShQuery(query); void searchSkillsSh(undefined, query); }}>{label}</button>)}
              {shHasSearched && <button className="text-button" disabled={shSearching} onClick={() => { setShHasSearched(false); setShError(""); setShQuery(""); }}>กลับรายการเริ่มต้น</button>}
            </div>
            {shSearching && <p className="muted">กำลังค้นหาและดึงข้อมูลจาก skills.sh…</p>}
            {shError && <div role="alert" className="skills-search-error"><p>{shError}</p><button className="secondary" onClick={() => void searchSkillsSh(undefined, submittedQuery)}>ลองค้นหาอีกครั้ง</button></div>}
            {shHasSearched && !shSearching && !shError && (
              shResults.length > 0 ? (
                <ul className="skill-list">{shResults.map(card)}</ul>
              ) : (
                <p className="muted">ไม่พบ skill ที่ตรงกับคำค้นหา "{submittedQuery}" ลองใช้คำอื่นหรือเลือกหมวดงานด้านบน</p>
              )
            )}
            {!shHasSearched && (
              <><h3>รายการเริ่มต้นจากแค็ตตาล็อกของแอป</h3><p className="muted">เลือกติดตั้งจากรายการแนะนำได้เลย หรือเลือกหมวดงานด้านบนเพื่อค้นหาเพิ่มเติม</p>
                {loading === "catalog" ? <p role="status">กำลังโหลดรายการเริ่มต้น…</p> : catalog.length ? <ul className="skill-list">{catalog.slice(0, 12).map(card)}</ul> : <p>ยังโหลดรายการไม่ได้ <button className="secondary" onClick={() => void load(true)}>ลองโหลดอีกครั้ง</button></p>}</>
            )}
          </>
        )}
      </section>
    </div>
  );
}
