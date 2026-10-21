import { useState } from "react";
import type { Cli } from "../api";
import { HEADLESS, PROVIDER_LABEL, confirmDefaults, loadDefaults, saveDefaults, type ProviderDefaults as Defaults } from "../providers";
import { SeatPicker } from "./SeatPicker";

/** Default model and effort per provider; every new Agent/Chat/Code seat starts from these. */
export function ProviderDefaults({ clis, onSaved }: { clis: Cli[]; onSaved?: () => void }) {
  const [values, setValues] = useState<Defaults>(loadDefaults);
  const installed = HEADLESS.filter((id) => clis.some((c) => c.id === id && c.available));
  const update = (id: string, model: string, effort: string) => {
    const next = { ...values, [id]: { model, effort } };
    setValues(next);
    saveDefaults(next);
    confirmDefaults();
    onSaved?.();
  };
  if (!installed.length) return <p className="muted">ติดตั้ง CLI ของ AI อย่างน้อย 1 ตัวก่อน แล้วกลับมาเลือก model และ effort</p>;
  return (
    <div className="provider-defaults">
      {installed.map((id) => {
        const d = values[id] || { model: "", effort: "" };
        return (
          <div className="seat-row" key={id}>
            <span className="seat-badge">{PROVIDER_LABEL[id]}</span>
            <SeatPicker named={false} fixedProvider label={PROVIDER_LABEL[id]} clis={clis.filter((c) => c.id === id)} ollamaModels={[]}
              seat={{ name: id, provider: `cli:${id}`, model: d.model, effort: d.effort }}
              onChange={(seat) => update(id, seat.model, seat.effort)} />
          </div>
        );
      })}
    </div>
  );
}
