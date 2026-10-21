import { useId } from "react";
import { X } from "lucide-react";
import type { Cli, Seat } from "../api";
import { EFFORTS, EFFORT_LABEL, HEADLESS, PROVIDER_LABEL, loadDefaults, useModels } from "../providers";

interface Props {
  seat: Seat;
  onChange: (seat: Seat) => void;
  clis: Cli[];
  ollamaModels: string[];
  label: string;
  /** Show the name field (Agent/Chat seats) or hide it (Code sessions, defaults). */
  named?: boolean;
  onRemove?: () => void;
  disabled?: boolean;
  /** Hide the provider choice (setup defaults are per provider). */
  fixedProvider?: boolean;
}

/** Pick a provider, then a model and an effort level for it. */
export function SeatPicker({ seat, onChange, clis, ollamaModels, label, named = true, onRemove, disabled, fixedProvider }: Props) {
  const id = useId();
  const cli = seat.provider.startsWith("cli:") ? seat.provider.slice(4) : "";
  const { list, error } = useModels(cli);
  const efforts = (seat.model && list?.modelEfforts?.[seat.model]) || list?.efforts || EFFORTS[cli] || [];
  const pickProvider = (value: string) => {
    if (value === "ollama") return onChange({ ...seat, provider: ollamaModels[0] || "", model: "", effort: "" });
    const d = loadDefaults()[value.slice(4)] || { model: "", effort: "" };
    onChange({ ...seat, provider: value, model: d.model, effort: d.effort });
  };
  return (
    <div className={`seat-picker ${named ? "" : "unnamed"} ${fixedProvider ? "fixed" : ""}`}>
      {named && (
        <label>
          ชื่อ
          <input aria-label={`ชื่อ${label}`} value={seat.name} maxLength={60} disabled={disabled} onChange={(e) => onChange({ ...seat, name: e.target.value })} />
        </label>
      )}
      {!fixedProvider && <label>
        ผู้ให้บริการ
        <select aria-label={`ผู้ให้บริการของ${label}`} value={cli ? seat.provider : "ollama"} disabled={disabled} onChange={(e) => pickProvider(e.target.value)}>
          {HEADLESS.map((cliId) => {
            const found = clis.find((c) => c.id === cliId);
            return (
              <option key={cliId} value={`cli:${cliId}`} disabled={!found?.available}>
                {PROVIDER_LABEL[cliId]}
                {found?.available ? "" : " · ยังไม่ติดตั้ง"}
              </option>
            );
          })}
          <option value="ollama">Ollama บนเครื่อง</option>
        </select>
      </label>}
      <label>
        Model
        {cli ? (
          <input aria-label={`model ของ${label}`} value={seat.model} list={`${id}-models`} maxLength={200} placeholder="ค่าเริ่มต้นของ CLI" disabled={disabled}
            onChange={(e) => onChange({ ...seat, model: e.target.value.trim(), effort: efforts.includes(seat.effort) || !seat.effort ? seat.effort : "" })} />
        ) : (
          <input aria-label={`model ของ${label}`} value={seat.provider} list={`${id}-models`} maxLength={150} placeholder="ชื่อรุ่น Ollama" disabled={disabled}
            onChange={(e) => onChange({ ...seat, provider: e.target.value.trim() })} />
        )}
        <datalist id={`${id}-models`}>
          {(cli ? list?.models || [] : ollamaModels).map((m) => <option key={m} value={m} />)}
        </datalist>
      </label>
      <label>
        Effort
        <select aria-label={`effort ของ${label}`} value={seat.effort} disabled={disabled || !cli || !efforts.length} onChange={(e) => onChange({ ...seat, effort: e.target.value })}>
          <option value="">ค่าเริ่มต้น</option>
          {efforts.map((level) => <option key={level} value={level}>{EFFORT_LABEL[level] || level} ({level})</option>)}
        </select>
      </label>
      {onRemove && (
        <button className="icon-button seat-remove" title={`เอา${label}ออก`} disabled={disabled} onClick={onRemove}>
          <X size={14} />
        </button>
      )}
      {(error || list?.note) && <small className="seat-note">{error || list?.note}</small>}
    </div>
  );
}
