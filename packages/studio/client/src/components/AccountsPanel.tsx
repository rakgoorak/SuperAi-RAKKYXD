import { useState } from 'react';
import { api, post } from '../api';
import { accountsChanged, useAccounts, type AccountProfile } from '../accounts';
import { PROVIDER_LABEL } from '../providers';
import { ProviderAccess } from './ProviderAccess';
import { tr } from '../i18n';

export function AccountsPanel({ wsId }: { wsId?: string }) {
  const { providers, error } = useAccounts();
  const [names, setNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<AccountProfile | null>(null);
  const [rename, setRename] = useState('');
  const [removing, setRemoving] = useState<AccountProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true); setProblem('');
    try { await action(); await accountsChanged(); }
    catch (e) { setProblem((e as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="accounts-panel">
    <div className="settings-section-title"><h3>{tr("บัญชี AI")}</h3></div>
    <p className="muted">{tr("เพิ่มบัญชีแล้วเลือกใช้ตอนเปิดห้องคุยหรือจัดทีม AI บัญชีเริ่มต้นใช้กับงานใหม่ ส่วนห้องเดิมยังใช้บัญชีเดิม")}</p>
    <p className="muted">{tr("โปรไฟล์ใหม่เริ่มด้วยการตั้งค่าและประวัติแยกกัน ต้องเข้าสู่ระบบและติดตั้ง Skills/Plugins ที่ต้องการในโปรไฟล์นั้น")}</p>
    {(error || problem) && <p role="alert">{problem || error}</p>}
    {!providers.length && !error && <p role="status">{tr("กำลังโหลดบัญชี…")}</p>}
    {providers.map(group => <section className="account-provider" key={group.provider}>
      <h4>{PROVIDER_LABEL[group.provider] || group.provider}</h4>
      <p className="muted">{group.note}</p>
      {group.profiles.map(profile => <article className="account-card" key={profile.id}>
        <div className="account-card-heading"><strong>{profile.name}</strong>{profile.isDefault && <span className="account-default">{tr("เริ่มต้นสำหรับงานใหม่")}</span>}</div>
        {editing?.id === profile.id ? <form className="account-actions" onSubmit={e => { e.preventDefault(); void act(async () => { await api(`/api/accounts/${group.provider}/${profile.id}`, { method: 'PATCH', body: JSON.stringify({ name: rename }) }); setEditing(null); }); }}>
          <input aria-label={tr("ชื่อบัญชีใหม่")} value={rename} maxLength={60} onChange={e => setRename(e.target.value)} autoFocus />
          <button className="secondary" disabled={busy || !rename.trim()}>{tr("บันทึกชื่อ")}</button><button type="button" className="text-button" onClick={() => setEditing(null)}>{tr("ยกเลิก")}</button>
        </form> : <div className="account-actions">
          {!profile.isDefault && <button type="button" className="text-button" disabled={busy} onClick={() => void act(() => post(`/api/accounts/${group.provider}/${profile.id}/default`))}>{tr("ใช้เป็นบัญชีเริ่มต้น")}</button>}
          {!profile.system && <><button type="button" className="text-button" disabled={busy} onClick={() => { setEditing(profile); setRename(profile.name); }}>{tr("เปลี่ยนชื่อ")}</button>
            <button type="button" className="text-button" disabled={busy} onClick={() => setRemoving(profile)}>{tr("นำออก")}</button></>}
        </div>}
        <ProviderAccess provider={group.provider} accountId={profile.id} wsId={wsId} />
        {removing?.id === profile.id && <div className="account-remove" role="group" aria-label={tr`ยืนยันนำ ${profile.name} ออก`}>
          <p>{tr("นำ “")}{profile.name}{tr("” ออกจากรายการ? ไฟล์ล็อกอินและประวัติของ CLI ยังคงอยู่ในเครื่อง")}</p>
          <button type="button" className="secondary" disabled={busy} onClick={() => void act(async () => { await api(`/api/accounts/${group.provider}/${profile.id}`, { method: 'DELETE' }); setRemoving(null); })}>{tr("ยืนยันนำออก")}</button>
          <button type="button" className="text-button" disabled={busy} onClick={() => setRemoving(null)}>{tr("ยกเลิก")}</button>
        </div>}
      </article>)}
      {group.supported && <form className="account-actions" onSubmit={e => { e.preventDefault(); void act(async () => { await post(`/api/accounts/${group.provider}`, { name: names[group.provider] || '' }); setNames(n => ({ ...n, [group.provider]: '' })); }); }}>
        <input aria-label={tr`ชื่อบัญชีใหม่ ${PROVIDER_LABEL[group.provider]}`} placeholder={tr("ชื่อบัญชี เช่น งาน / ส่วนตัว")} maxLength={60} value={names[group.provider] || ''} onChange={e => setNames(n => ({ ...n, [group.provider]: e.target.value }))} />
        <button className="secondary" disabled={busy || !names[group.provider]?.trim()}>{tr("เพิ่มบัญชี")}</button>
      </form>}
    </section>)}
    {!wsId && <p className="muted">{tr("เลือกโปรเจกต์ก่อนกดเข้าสู่ระบบ")}</p>}
  </div>;
}
