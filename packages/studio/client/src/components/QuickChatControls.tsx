import type { Cli } from '../api';
import { HEADLESS, loadDefaults } from '../providers';
import { providerIdentity } from '../providerIdentity';
import { ProviderBadge } from './ProviderBadge';
import { AccountPicker } from './AccountPicker';
import { ComposerOptions } from './ComposerOptions';
import { ResponseStyleSelect } from './ResponseStyleSelect';
import type { ResponseStyle } from '../responseStyle';

export function QuickChatControls({ clis, provider, onProvider, accountId, onAccount, disabled, onSetup, style = 'normal', onStyle }: {
  clis: Cli[]; provider: string; onProvider: (id: string) => void; disabled: boolean; onSetup: () => void; style?: ResponseStyle; onStyle?: (value: ResponseStyle) => void;
  accountId?: string; onAccount?: (id: string | undefined) => void;
}) {
  const ready = clis.filter(cli => cli.available && HEADLESS.includes(cli.id));
  const defaults = loadDefaults()[provider];
  return <div className="quick-chat-controls">
    {provider && <ProviderBadge provider={provider} />}
    <label>ผู้ช่วย AI<select aria-label="AI สำหรับบทสนทนาใหม่" value={provider} onChange={event => onProvider(event.target.value)} disabled={disabled || !ready.length}>
      {!ready.length && <option value="">ยังไม่มี AI พร้อมใช้</option>}
      {ready.map(cli => <option key={cli.id} value={cli.id}>{providerIdentity(cli.id).label}</option>)}
    </select></label>
    {onAccount && <AccountPicker provider={provider} value={accountId} onChange={onAccount} disabled={disabled} label="บัญชีสำหรับบทสนทนาใหม่" />}
    <span className="quick-chat-model" title="ใช้รุ่นและระดับการคิดจากการตั้งค่าของคุณ">{defaults?.model || 'ใช้รุ่นที่ตั้งไว้'}</span>
    <ComposerOptions label="ตัวเลือกบทสนทนาใหม่">
      {onStyle && <ResponseStyleSelect value={style} onChange={onStyle} disabled={disabled} />}
      {provider && <><strong>{providerIdentity(provider).label}</strong><p>{providerIdentity(provider).connection}</p><p>{providerIdentity(provider).attachments}</p></>}
      <p>เริ่มด้วยสิทธิ์อ่านและวางแผน ปรับสิทธิ์แก้ไฟล์และรันคำสั่งได้ในห้องคุย</p>
      <small>มุมมองนี้ใช้ CLI ความสามารถจึงอาจต่างจากแอป Desktop ของผู้ให้บริการ</small>
    </ComposerOptions>
    {!ready.length && <button type="button" className="text-button" disabled={disabled} onClick={onSetup}>เชื่อมต่อ AI</button>}
  </div>;
}
