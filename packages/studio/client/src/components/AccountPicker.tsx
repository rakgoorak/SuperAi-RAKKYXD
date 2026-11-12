import { useAccounts } from '../accounts';
import { tr } from '../i18n';

export function AccountPicker({ provider, value, onChange, disabled, label = tr("บัญชี AI") }: {
  provider: string; value?: string; onChange: (id: string | undefined) => void; disabled?: boolean; label?: string;
}) {
  const { providers, error } = useAccounts();
  const group = providers.find(p => p.provider === provider);
  if (!group?.supported) return null;
  const defaultProfile = group.profiles.find(p => p.isDefault);
  const missing = value && !group.profiles.some(p => p.id === value);
  return <label className="account-picker">{label}
    <select aria-label={label} value={value || ''} disabled={disabled} onChange={e => onChange(e.target.value || undefined)}>
      <option value="">{tr("ใช้บัญชีเริ่มต้น ·")} {defaultProfile?.name || tr("บัญชีเดิมของเครื่อง")}</option>
      {missing && <option value={value}>{tr("บัญชีไม่พร้อม · เลือกใหม่")}</option>}
      {group.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
    {error && <small role="alert">{error}</small>}
  </label>;
}
