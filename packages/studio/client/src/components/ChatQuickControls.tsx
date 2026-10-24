import type { Cli } from "../api";
import type { ChatConfig } from "./ChatPanel";
import { SeatPicker } from "./SeatPicker";
import { ProviderAccess } from "./ProviderAccess";
import { providerName } from "../providers";
import { useEffect, useRef } from "react";
import { Bot, ChevronDown } from "lucide-react";

/** Per-message team controls; skills use the composer's shared slash picker. */
export function ChatQuickControls({ workspaceId, config, onChange, clis, ollamaModels, disabled, onDraft }: {
  workspaceId: string; config: ChatConfig; onChange: (value: ChatConfig) => void; clis: Cli[]; ollamaModels: string[];
  disabled: boolean; onDraft: (value: string) => void;
}) {
  const providers = [...new Set(config.panel.filter(seat => seat.provider.startsWith('cli:')).map(seat => seat.provider.slice(4)))];
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      if (!menu.current?.open) return;
      if (event instanceof KeyboardEvent && event.key === 'Escape') { menu.current.open = false; menu.current.querySelector('summary')?.focus(); }
      else if (event.type === 'pointerdown' && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, []);
  return <div className="chat-quick-controls">
    <details ref={menu} className="chat-model-menu"><summary><Bot size={14} />{config.panel.length} AI · ตัวเลือกข้อความ<ChevronDown size={12} /></summary>
    <div className="chat-model-popover">
    {config.panel.map((seat, index) => <div key={index} className="chat-quick-seat"><strong>{seat.name}<small>{providerName(seat.provider)}</small></strong>
      <SeatPicker seat={seat} onChange={next => onChange({ ...config, panel: config.panel.map((current, at) => at === index ? next : current) })}
        named={false} fixedProvider label={`ข้อความถัดไป ${seat.name}`} clis={clis} ollamaModels={ollamaModels} disabled={disabled} />
    </div>)}
    <details><summary>บัญชีผู้ให้บริการ</summary>{providers.map(id => <ProviderAccess key={id} provider={id} wsId={workspaceId} />)}</details>
    <button type="button" className="text-button" disabled={disabled} onClick={() => { if (menu.current) menu.current.open = false; onDraft('/'); }}>/skills · เลือก skill</button>
    </div></details>
  </div>;
}
