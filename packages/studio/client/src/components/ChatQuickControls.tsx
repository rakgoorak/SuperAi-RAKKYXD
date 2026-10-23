import type { Cli } from "../api";
import type { ChatConfig } from "./ChatPanel";
import { SeatPicker } from "./SeatPicker";
import { ProviderAccess } from "./ProviderAccess";
import { providerName } from "../providers";

/** Per-message team controls; skills use the composer's shared slash picker. */
export function ChatQuickControls({ workspaceId, config, onChange, clis, ollamaModels, disabled, onDraft }: {
  workspaceId: string; config: ChatConfig; onChange: (value: ChatConfig) => void; clis: Cli[]; ollamaModels: string[];
  disabled: boolean; onDraft: (value: string) => void;
}) {
  const providers = [...new Set(config.panel.filter(seat => seat.provider.startsWith('cli:')).map(seat => seat.provider.slice(4)))];
  return <div className="chat-quick-controls">
    {config.panel.map((seat, index) => <div key={index} className="chat-quick-seat"><strong>{seat.name}<small>{providerName(seat.provider)}</small></strong>
      <SeatPicker seat={seat} onChange={next => onChange({ ...config, panel: config.panel.map((current, at) => at === index ? next : current) })}
        named={false} fixedProvider label={`ข้อความถัดไป ${seat.name}`} clis={clis} ollamaModels={ollamaModels} disabled={disabled} />
    </div>)}
    <details><summary>บัญชีผู้ให้บริการ</summary>{providers.map(id => <ProviderAccess key={id} provider={id} wsId={workspaceId} />)}</details>
    <button type="button" className="text-button" disabled={disabled} onClick={() => onDraft('/')}>/skills · เลือก skill</button>
  </div>;
}
