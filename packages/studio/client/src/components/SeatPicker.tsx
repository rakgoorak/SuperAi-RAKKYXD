import { X } from "lucide-react";
import { AccountPicker } from "./AccountPicker";
import { ModelCombo } from "./ModelCombo";
import type { Cli, Seat } from "../api";
import { CLOUD, EFFORTS, effortLabel, HEADLESS, PROVIDER_LABEL, isCloud, loadDefaults, useCloudKeys, useModels } from "../providers";
import { tr } from '../i18n';

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
  showAccount?: boolean;
}

/** Pick a provider, then a model and an effort level for it. */
export function SeatPicker({ seat, onChange, clis, ollamaModels, label, named = true, onRemove, disabled, fixedProvider, showAccount = true }: Props) {
  const cli = seat.provider.startsWith("cli:") ? seat.provider.slice(4) : "";
  // API providers (OpenRouter, DeepSeek, Groq) have a model list like a CLI but no effort levels.
  const cloud = isCloud(seat.provider) ? seat.provider : "";
  const cloudKeys = useCloudKeys();
  const { list, error, refresh: refreshModels } = useModels(cli || cloud, seat.accountId);
  const efforts = cloud ? [] : (seat.model && list?.modelEfforts?.[seat.model]) || list?.efforts || EFFORTS[cli] || [];
  const pickProvider = (value: string) => {
    if (isCloud(value)) return onChange({ ...seat, provider: value, accountId: undefined, model: "", effort: "" });
    if (value === "ollama") return onChange({ ...seat, provider: ollamaModels[0] || "", accountId: undefined, model: "", effort: "" });
    const d = loadDefaults()[value.slice(4)] || { model: "", effort: "" };
    onChange({ ...seat, provider: value, accountId: undefined, model: d.model, effort: d.effort });
  };
  return (
    <div className={`seat-picker ${named ? "" : "unnamed"} ${fixedProvider ? "fixed" : ""}`}>
      {named && (
        <label>
          {tr("ชื่อ")}
          <input aria-label={tr`ชื่อ${label}`} value={seat.name} maxLength={60} disabled={disabled} onChange={(e) => onChange({ ...seat, name: e.target.value })} />
        </label>
      )}
      {!fixedProvider && <label>
        {tr("ผู้ให้บริการ")}
        <select aria-label={tr`ผู้ให้บริการของ${label}`} value={cli ? seat.provider : cloud || "ollama"} disabled={disabled} onChange={(e) => pickProvider(e.target.value)}>
          {HEADLESS.map((cliId) => {
            const found = clis.find((c) => c.id === cliId);
            return (
              <option key={cliId} value={`cli:${cliId}`} disabled={!found?.available}>
                {PROVIDER_LABEL[cliId]}
                {found?.available ? "" : tr(" · ยังไม่ติดตั้ง")}
              </option>
            );
          })}
          <option value="ollama">{tr("Ollama บนเครื่อง")}</option>
          <optgroup label={tr("API ภายนอก (ใช้ key ของคุณ)")}>
            {[...new Set([...CLOUD, ...cloudKeys.map(key => key.id)])].map((id) => {
              const ready = cloudKeys.find((k) => k.id === id)?.hasKey;
              return <option key={id} value={id} disabled={!ready && cloud !== id}>{cloudKeys.find(key => key.id === id)?.name || PROVIDER_LABEL[id] || id}{ready ? "" : tr(" · ยังไม่ใส่ API Key")}</option>;
            })}
          </optgroup>
        </select>
      </label>}
      {cli && showAccount && <AccountPicker provider={cli} value={seat.accountId} disabled={disabled} label={tr`บัญชีของ${label}`} onChange={accountId => onChange({ ...seat, accountId })} />}
      <label>
        {tr("รุ่น AI (Model)")}
        {cli || cloud ? (
          <ModelCombo label={tr`model ของ${label}`} value={seat.model} options={list?.models || []} onOpen={refreshModels} placeholder={tr("ใช้รุ่นเริ่มต้นได้")} disabled={disabled}
            onChange={(model) => onChange({ ...seat, model: model.trim(), effort: efforts.includes(seat.effort) || !seat.effort ? seat.effort : "" })} />
        ) : (
          <ModelCombo label={tr`model ของ${label}`} value={seat.provider} options={ollamaModels} maxLength={150} placeholder={tr("ชื่อรุ่น Ollama")} disabled={disabled}
            onChange={(model) => onChange({ ...seat, provider: model.trim() })} />
        )}
      </label>
      <label>
        {tr("ระดับการคิด (Effort)")}
        <select aria-label={tr`effort ของ${label}`} value={seat.effort} disabled={disabled || !cli || !efforts.length} onChange={(e) => onChange({ ...seat, effort: e.target.value })}>
          <option value="">{tr("ค่าเริ่มต้น")}</option>
          {efforts.map((level) => <option key={level} value={level}>{effortLabel(level)} ({level})</option>)}
        </select>
      </label>
      {onRemove && (
        <button className="icon-button seat-remove" title={tr`เอา${label}ออก`} disabled={disabled} onClick={onRemove}>
          <X size={14} />
        </button>
      )}
      {(error || list?.note) && <small className="seat-note">{error || list?.note}</small>}
    </div>
  );
}
