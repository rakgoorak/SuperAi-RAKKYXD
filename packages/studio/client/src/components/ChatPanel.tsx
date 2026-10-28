import { MessagesSquare, Plus, Sparkles } from "lucide-react";
import type { Cli, Run, Seat } from "../api";
import { HEADLESS, firstReady, seatFor } from "../providers";
import { SeatPicker } from "./SeatPicker";
import { ConfigShell } from "./ConfigShell";
import { useTeamDraft } from "./useTeamDraft";
import { ProviderAccess } from "./ProviderAccess";
import { ComparisonArena } from "./ComparisonArena";

export { ComparisonArena };

export interface ChatConfig { panel: Seat[]; summarizer: Seat | null; style: "merge" | "best"; }
const MAX_PANEL = 5;

function validSeat(s: any): s is Seat {
  return s && ["name", "provider", "model", "effort"].every((k) => typeof s[k] === "string");
}
function defaultConfig(clis: Cli[]): ChatConfig {
  const ready = HEADLESS.filter((id) => clis.some((c) => c.id === id && c.available));
  const id = ready[0] || HEADLESS[0];
  return { panel: [seatFor(id, "Main 1")], summarizer: null, style: "merge" };
}

export function ChatConfigEditor({ workspaceId, clis, ollamaModels, disabled, onChange }: {
  workspaceId: string; clis: Cli[]; ollamaModels: string[]; disabled: boolean; onChange: (c: ChatConfig) => void;
}) {
  const key = `superai-chat-v1:${workspaceId}`;
  const team = useTeamDraft<ChatConfig>(key, () => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved && Array.isArray(saved.panel) && saved.panel.length && saved.panel.every(validSeat) && (saved.summarizer === null || validSeat(saved.summarizer))) return { ...saved, style: saved.style === "best" ? "best" : "merge" };
    } catch {}
    return defaultConfig(clis);
  }, onChange);
  const { config, saved, edit: setConfig } = team;
  const edit = (index: number, seat: Seat) => setConfig((c) => ({ ...c, panel: c.panel.map((s, i) => (i === index ? seat : s)) }));
  return (
    <ConfigShell label="ตั้งค่าทีม Chat" title={<><MessagesSquare size={19} /> ทีม Chat</>}
      description="เลือก AI ที่ร่วมตอบคำถามเดียวกัน และกำหนดว่าจะให้ใครสรุปผล"
      summary={`${saved.panel.length} AI · ${saved.summarizer ? "มีผู้สรุป" : "แยกคำตอบ"}`}
      disabled={disabled} onOpen={team.begin} onSave={team.save} onCancel={team.cancel}>
      <section aria-label="AI ที่ร่วมตอบ"><h3>AI ที่ร่วมตอบ</h3>
      <p className="team-section-description">แต่ละตัวได้รับคำถามแยกกัน และใช้โควตาของตัวเอง</p>
      {config.panel.map((seat, index) => (
        <div className="seat-row" key={index}>
          <span className="seat-badge">Main {index + 1}</span>
          <SeatPicker seat={seat} label={`Main ${index + 1}`} clis={clis} ollamaModels={ollamaModels} disabled={disabled}
            onChange={(s) => edit(index, s)}
            onRemove={config.panel.length > 1 ? () => setConfig((c) => ({ ...c, panel: c.panel.filter((_, i) => i !== index) })) : undefined} />
        </div>
      ))}
      <button className="text-button add-seat" disabled={disabled || config.panel.length >= MAX_PANEL}
        onClick={() => setConfig((c) => ({ ...c, panel: [...c.panel, seatFor(firstReady(clis, c.panel.map((s) => s.provider.slice(4))) || HEADLESS[0], `Main ${c.panel.length + 1}`)] }))}>
        <Plus size={13} /> เพิ่ม Main ({config.panel.length}/{MAX_PANEL})
      </button>
      </section>
      <section aria-label="สรุปคำตอบ"><h3>สรุปคำตอบ</h3>
      <p className="team-section-description">เรียก AI เพิ่มอีกครั้งเพื่ออ่านคำตอบทั้งหมดและสรุปผล</p>
      <div className="summarizer-row">
        <label className="tool-permission">
          <input type="checkbox" checked={!!config.summarizer} disabled={disabled}
            onChange={(e) => setConfig((c) => ({ ...c, summarizer: e.target.checked ? seatFor(c.panel[0]?.provider.slice(4) || HEADLESS[0], "ผู้สรุป") : null }))} />
          ให้ AI สรุปผลรวม
        </label>
        {config.summarizer && (
          <select aria-label="วิธีสรุป" value={config.style} disabled={disabled} onChange={(e) => setConfig((c) => ({ ...c, style: e.target.value as ChatConfig["style"] }))}>
            <option value="merge">รวมทุกความเห็น</option>
            <option value="best">คัดส่วนที่ดี ตัดส่วนที่อ่อนออก</option>
          </select>
        )}
      </div>
      {config.summarizer && (
        <div className="seat-row">
          <span className="seat-badge"><Sparkles size={13} /> ผู้สรุป</span>
          <SeatPicker seat={config.summarizer} label="ผู้สรุป" clis={clis} ollamaModels={ollamaModels} disabled={disabled}
            onChange={(summarizer) => setConfig((c) => ({ ...c, summarizer }))} />
        </div>
      )}
      </section>
      <div className="team-access" aria-label="ความพร้อมของทีม">{Array.from(new Set([...config.panel, ...(config.summarizer ? [config.summarizer] : [])].map(s => s.provider).filter(p => p.startsWith("cli:")).map(p => p.slice(4)))).map(provider => <ProviderAccess key={provider} provider={provider} wsId={workspaceId} compact />)}</div>
    </ConfigShell>
  );
}

export function ChatRunView({ run }: { run: Run }) {
  return <ComparisonArena run={run} />;
}
