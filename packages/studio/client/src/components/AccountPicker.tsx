import { useAccounts } from '../accounts';
import { tr } from '../i18n';

/**
 * Which account an AI uses. Shows the user's own accounts as buttons, the default (the first one
 * added, unless another was chosen) selected; the computer's own CLI login is not offered once the
 * user has accounts. With a single account there is nothing to choose, so nothing is shown.
 */
export function AccountPicker({ provider, value, onChange, disabled, label = tr("บัญชี AI") }: {
  provider: string; value?: string; onChange: (id: string | undefined) => void; disabled?: boolean; label?: string;
}) {
  const { providers, error } = useAccounts();
  const group = providers.find(p => p.provider === provider);
  if (!group?.supported) return null;
  const own = group.profiles.filter(p => !p.system);
  if (own.length < 2 && !(value && value !== own[0]?.id && own.length)) return error ? <small role="alert">{error}</small> : null;
  const selected = value && group.profiles.some(p => p.id === value) ? value : (group.profiles.find(p => p.isDefault) || own[0])?.id;
  // A room made earlier with the computer's login keeps showing it until another account is picked.
  const legacy = value === 'system' ? [{ id: 'system', name: tr("บัญชีหลักของเครื่อง") }] : [];
  const options = [...legacy, ...own];
  if (options.length > 5) return <label className="account-picker">{label}
    <select aria-label={label} value={value || selected || ''} disabled={disabled} onChange={e => onChange(e.target.value || undefined)}>
      {options.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
    {error && <small role="alert">{error}</small>}
  </label>;
  return <div className="account-picker account-chips" role="radiogroup" aria-label={label}>
    <span className="account-chips-label">{label}</span>
    <div className="account-chips-row">
      {options.map(p => {
        const on = (value || selected) === p.id;
        return <button key={p.id} type="button" role="radio" aria-checked={on} className={on ? 'on' : ''} disabled={disabled}
          onClick={() => onChange(p.id)}>{p.name}</button>;
      })}
    </div>
    {error && <small role="alert">{error}</small>}
  </div>;
}
