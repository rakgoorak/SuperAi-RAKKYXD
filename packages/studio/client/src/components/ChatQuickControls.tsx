import { useEffect, useState } from "react";
import { api, type ChatSkill, type Cli } from "../api";
import { type ChatConfig } from "./ChatPanel";
import { SeatPicker } from "./SeatPicker";
import { ProviderAccess } from "./ProviderAccess";
import { PROVIDER_LABEL, providerName } from "../providers";

/** The same controlled seats as Chat settings, next to the message being sent. */
export function ChatQuickControls({ workspaceId, config, onChange, clis, ollamaModels, disabled, draft, onDraft }: {
  workspaceId: string; config: ChatConfig; onChange: (value: ChatConfig) => void; clis: Cli[]; ollamaModels: string[];
  disabled: boolean; draft: string; onDraft: (value: string) => void;
}) {
  const [skills, setSkills] = useState<(ChatSkill & { provider: string })[]>([]);
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState("");
  const providers = [...new Set(config.panel.filter((s) => s.provider.startsWith('cli:')).map((s) => s.provider.slice(4)))];
  const signature = providers.join(',');
  const load = async () => {
    setOpen(true); setProblem('');
    try {
      const lists = await Promise.all(providers.map(async (provider) => (await api<ChatSkill[]>(`/api/workspaces/${workspaceId}/chat-skills/${provider}`)).map((s) => ({ ...s, provider }))));
      // /skill name resolves the nearest matching skill separately for each provider.
      setSkills(lists.flat().filter((s, index, all) => all.findIndex((other) => other.name === s.name && other.provider === s.provider) === index));
    } catch (e) { setProblem((e as Error).message); }
  };
  useEffect(() => {
    if (/^\/skills?\s*$/.test(draft)) void load();
  }, [draft, workspaceId, signature]);
  return <div className="chat-quick-controls">
    {config.panel.map((seat, index) => <div key={index} className="chat-quick-seat"><strong>{seat.name}<small>{providerName(seat.provider)}</small></strong>
      <SeatPicker seat={seat} onChange={(next) => onChange({ ...config, panel: config.panel.map((current, at) => at === index ? next : current) })}
        named={false} fixedProvider label={`ข้อความถัดไป ${seat.name}`} clis={clis} ollamaModels={ollamaModels} disabled={disabled} />
    </div>)}
    <details><summary>บัญชีผู้ให้บริการ</summary>{providers.map((id) => <ProviderAccess key={id} provider={id} wsId={workspaceId} />)}</details>
    <button type="button" className="text-button" disabled={disabled} onClick={() => void load()}>/skills · เลือก skill</button>
    {open && <div className="chat-skill-menu" aria-label="Skills สำหรับข้อความถัดไป">
      <div><strong>เลือก skill</strong><button type="button" className="text-button" onClick={() => setOpen(false)}>ปิด</button></div>
      <small>แต่ละ AI ใช้ skill ชื่อนี้จากรายการของตนเอง โหมด Chat อ่านไฟล์ได้ · งานที่ต้องแก้ไฟล์ให้ใช้โหมด Code</small>
      {problem && <p role="alert">{problem}</p>}
      {!skills.length && <p>ยังไม่พบ skill ที่เรียกใช้ได้ ติดตั้งเพิ่มจากหน้า Skills</p>}
      {skills.map((s) => <button type="button" key={`${s.provider}:${s.id}`} title={s.path} onClick={() => { onDraft(`/skill ${s.name} `); setOpen(false); }}><strong>/{s.name}</strong><small>{PROVIDER_LABEL[s.provider]} · {s.source} · {s.description}</small></button>)}
    </div>}
  </div>;
}
