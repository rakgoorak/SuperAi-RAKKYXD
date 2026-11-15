import { useEffect, useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { tr } from '../i18n';

/**
 * "Let the AI control this computer": the AI may see the screen and use the mouse and keyboard.
 * Off by default; the desktop app keeps the switch, and the Stop bar shown while the AI acts
 * turns it off again.
 */
export function ComputerUsePanel({ onError }: { onError: (message: string) => void }) {
  const native = window.superai;
  const [state, setState] = useState<{ enabled: boolean; platform?: string } | null>(null);
  useEffect(() => {
    if (!native?.computer) return;
    native.computer('state').then(setState).catch((error) => onError((error as Error).message));
    return native.onComputer?.(setState);
  }, [native, onError]);
  if (!native?.computer) return <p className="muted">{tr("ใช้ได้เฉพาะแอป Desktop")}</p>;
  const change = (enabled: boolean) => native.computer!('set', enabled).then(setState).catch((error) => onError((error as Error).message));
  return <div className="computer-use-panel">
    <h3><MonitorSmartphone size={16} /> {tr("ให้ AI ควบคุมคอมพิวเตอร์")}</h3>
    <p>{tr("เมื่อเปิด AI ใน Claude, Codex และ OpenCode จะดูหน้าจอ ขยับเมาส์ คลิก และพิมพ์ได้เองเหมือนคนใช้งาน เพื่อทำงานในแอปอื่นของเครื่อง ระหว่างที่ AI ทำงานจะมีแถบ \"AI กำลังควบคุมคอมพิวเตอร์\" ด้านบนของจอ กด \"หยุด\" เพื่อปิดได้ทันที")}</p>
    <label className="tool-permission">
      <input type="checkbox" checked={!!state?.enabled} disabled={!state} onChange={(event) => void change(event.target.checked)} />
      {tr("อนุญาตให้ AI ควบคุมคอมพิวเตอร์เครื่องนี้")}
    </label>
    <p className="computer-use-warning">{tr("AI จะทำได้ทุกอย่างที่คุณทำได้บนเครื่องนี้ รวมถึงเปิดไฟล์ ส่งข้อความ หรือลบข้อมูล เปิดเฉพาะตอนที่ต้องใช้ ดูหน้าจอระหว่างที่ AI ทำงาน และปิดเมื่อเสร็จ")}</p>
    {state?.platform === 'darwin' && <p className="muted">{tr("บน macOS ต้องอนุญาต SuperAi ใน System Settings > Privacy & Security ทั้ง Accessibility และ Screen Recording")}</p>}
    <p className="muted">{tr("สำหรับหน้าเว็บ AI จะใช้ Browser ในแอปหรือ Chrome / Edge ซึ่งไม่ต้องเปิดตัวเลือกนี้")}</p>
  </div>;
}
