import { useEffect, useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { tr } from '../i18n';
import type { ComputerState } from '../desktop';

/**
 * "Let the AI control this computer": the AI may see the screen and use the mouse and keyboard.
 * Off by default. When on, each chat still has to be allowed in an Allow / Deny window the first
 * time it wants control; the list here shows the chats allowed so far and can take it back.
 * The Stop bar shown while the AI acts turns the whole thing off again.
 */
export function ComputerUsePanel({ onError }: { onError: (message: string) => void }) {
  const native = window.superai;
  const [state, setState] = useState<ComputerState | null>(null);
  useEffect(() => {
    if (!native?.computer) return;
    const refresh = () => native.computer!('state').then(setState).catch((error) => onError((error as Error).message));
    refresh();
    // macOS permissions change in System Settings, outside the app: check again on coming back.
    window.addEventListener('focus', refresh);
    const off = native.onComputer?.(setState);
    return () => { window.removeEventListener('focus', refresh); off?.(); };
  }, [native, onError]);
  if (!native?.computer) return <p className="muted">{tr("ใช้ได้เฉพาะแอป Desktop")}</p>;
  const call = (action: 'set' | 'revoke' | 'os-settings', value?: boolean | 'accessibility' | 'screen') =>
    native.computer!(action, value).then(setState).catch((error) => onError((error as Error).message));
  const mac = state?.platform === 'darwin';
  const allowed = state?.allowed || [];
  const osRow = (kind: 'accessibility' | 'screen', label: string) => {
    const granted = state?.os?.[kind] === 'granted';
    return <div>
      <span>{label}: <b className={granted ? 'granted' : 'missing'}>{granted ? tr("อนุญาตแล้ว") : tr("ยังไม่อนุญาต")}</b></span>
      {!granted && <button type="button" className="text-button" onClick={() => void call('os-settings', kind)}>{tr("เปิด System Settings")}</button>}
    </div>;
  };
  return <div className="computer-use-panel">
    <h3><MonitorSmartphone size={16} /> {tr("ให้ AI ควบคุมคอมพิวเตอร์")}</h3>
    <p>{tr("เมื่อเปิด AI ใน Claude, Codex และ OpenCode จะดูหน้าจอ ขยับเมาส์ คลิก และพิมพ์ได้เองเหมือนคนใช้งาน เพื่อทำงานในแอปอื่นของเครื่อง ระหว่างที่ AI ทำงานจะมีแถบ \"AI กำลังควบคุมคอมพิวเตอร์\" ด้านบนของจอ กด \"หยุด\" เพื่อปิดได้ทันที")}</p>
    <label className="tool-permission">
      <input type="checkbox" checked={!!state?.enabled} disabled={!state} onChange={(event) => void call('set', event.target.checked)} />
      {tr("อนุญาตให้ AI ควบคุมคอมพิวเตอร์เครื่องนี้")}
    </label>
    <p className="muted">{tr("ครั้งแรกที่แชตไหนจะควบคุมคอมพิวเตอร์ จะมีหน้าต่างให้กด \"อนุญาต\" หรือ \"ปฏิเสธ\" ก่อนเสมอ")}</p>
    <p className="computer-use-warning">{tr("AI จะทำได้ทุกอย่างที่คุณทำได้บนเครื่องนี้ รวมถึงเปิดไฟล์ ส่งข้อความ หรือลบข้อมูล เปิดเฉพาะตอนที่ต้องใช้ ดูหน้าจอระหว่างที่ AI ทำงาน และปิดเมื่อเสร็จ")}</p>
    {mac && <div className="computer-use-os">
      <p className="muted">{tr("macOS ต้องอนุญาต SuperAi ใน System Settings > Privacy & Security")}</p>
      {osRow('accessibility', tr("Accessibility (เมาส์และคีย์บอร์ด)"))}
      {osRow('screen', tr("Screen Recording (ดูหน้าจอ)"))}
    </div>}
    {allowed.length > 0 && <div className="computer-use-allowed">
      <span>{tr("แชตที่อนุญาตแล้ว")}</span>
      <ul>{allowed.map((a) => <li key={a.chatId || '-'}>{a.chatName || tr("AI ในแชต")} · {a.scope === 'chat' ? tr("ตลอดแชตนี้") : tr("งานนี้")}</li>)}</ul>
      <button type="button" className="text-button" onClick={() => void call('revoke')}>{tr("ยกเลิกสิทธิ์ทั้งหมด")}</button>
    </div>}
    {!mac && <p className="muted">{tr("Windows: AI สั่งงานหน้าต่างที่เปิดแบบ Administrator ไม่ได้ ถ้าต้องใช้ ให้เปิดแอปนั้นแบบปกติ")}</p>}
    <p className="muted">{tr("สำหรับหน้าเว็บ AI จะใช้ Browser ในแอปหรือ Chrome / Edge ซึ่งไม่ต้องเปิดตัวเลือกนี้")}</p>
  </div>;
}
