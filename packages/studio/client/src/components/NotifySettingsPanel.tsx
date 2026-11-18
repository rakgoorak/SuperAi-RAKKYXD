import { useEffect, useState } from "react";
import { loadNotifySettings, notifyDone, saveNotifySettings, type NotifySettings } from "../completionNotify";
import { loadNextPromptSettings, saveNextPromptSettings } from "../nextPrompt";
import { tr } from '../i18n';

export function NotifySettingsPanel() {
  const [settings, setSettings] = useState(loadNotifySettings);
  const [nextPrompt, setNextPrompt] = useState(loadNextPromptSettings);
  const [quickKey, setQuickKey] = useState<string | null>(null);
  useEffect(() => { void window.superai?.quickAsk?.("state").then(s => setQuickKey(s.key)).catch(() => {}); }, []);
  // Anonymous usage count lives in the desktop shell; absent in the browser UI and older shells.
  const [usage, setUsage] = useState<{ available: boolean; enabled: boolean; asked?: boolean } | null>(null);
  useEffect(() => { void window.superai?.usage?.("state").then(setUsage).catch(() => {}); }, []);
  const set = (key: keyof NotifySettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveNotifySettings(next);
  };
  const test = () => notifyDone({ tag: `test:${Date.now()}`, title: tr("ทดสอบการแจ้งเตือน"), body: tr("การแจ้งเตือนงานเสร็จทำงานปกติ"), failed: false,
    target: { kind: "session", id: "" } }, { force: true });

  return (
    <>
      <div className="settings-section-title">
        <h3>{tr("แจ้งเตือนเมื่องานเสร็จ")}</h3>
        <button className="text-button" disabled={!settings.enabled} onClick={test}>{tr("ทดสอบการแจ้งเตือน")}</button>
      </div>
      <p className="muted">{tr("เมื่อ Agent, Chat หรือแชทของ CLI ทำงานเสร็จระหว่างที่คุณอยู่หน้าต่างอื่น จะแสดงการแจ้งเตือนของระบบและไอคอนบน taskbar จะกะพริบ กดการแจ้งเตือนเพื่อกลับไปยังบทสนทนานั้น ถ้าคุณดูแอปอยู่จะไม่แจ้งเตือน")}</p>
      <label className="settings-toggle">
        <input type="checkbox" checked={settings.enabled} onChange={e => set("enabled", e.target.checked)} />
        {tr("แจ้งเตือนเมื่องานเสร็จหรือไม่สำเร็จ")}
      </label>
      <label className="settings-toggle">
        <input type="checkbox" checked={settings.sound} disabled={!settings.enabled} onChange={e => set("sound", e.target.checked)} />
        {tr("เล่นเสียงสั้น ๆ")}
      </label>
      <div className="settings-section-title">
        <h3>{tr("แนะนำข้อความถัดไป")}</h3>
      </div>
      <p className="muted">{tr("หลัง AI ตอบเสร็จ ช่องพิมพ์จะแสดงข้อความถัดไปที่น่าจะพิมพ์เป็นตัวอักษรสีเทา กด Tab เพื่อใช้ข้อความนั้น ถ้าคำตอบมีขั้นตอนถัดไปอยู่แล้วจะใช้ข้อนั้นทันที ถ้าไม่มีจะให้ AI รุ่นเล็กเดา (Claude ใช้ Haiku) ซึ่งใช้โควตาของบัญชีเล็กน้อยทุกครั้งที่ตอบเสร็จ")}</p>
      <label className="settings-toggle">
        <input type="checkbox" checked={nextPrompt.ai} onChange={e => { const next = { ai: e.target.checked }; setNextPrompt(next); saveNextPromptSettings(next); }} />
        {tr("ให้ AI เดาข้อความถัดไปเมื่อคำตอบไม่มีขั้นตอนถัดไป")}
      </label>
      {quickKey !== null && (
        <>
          <div className="settings-section-title">
            <h3>{tr("ถามด่วนจากที่ไหนก็ได้")}</h3>
            <button className="text-button" onClick={() => void window.superai?.quickAsk?.("open")}>{tr("เปิดกล่องถามด่วน")}</button>
          </div>
          <p className="muted">{quickKey ? tr`กด ${quickKey} ตอนใช้แอปไหนก็ได้ จะมีกล่องเล็กให้พิมพ์ถาม กด Enter แล้วข้อความจะไปเป็นแชทใหม่ในโปรแกรมนี้` : tr("ปุ่มลัดถูกแอปอื่นใช้อยู่ทั้งหมด ยังเปิดกล่องถามด่วนจากปุ่มด้านบนได้")}</p>
        </>
      )}
      {usage && (
        <>
          <div className="settings-section-title">
            <h3>{tr("นับจำนวนผู้ใช้แบบไม่ระบุตัวตน")}</h3>
          </div>
          <p className="muted">{tr("ช่วยให้หน้าดาวน์โหลดแสดงจำนวนคนที่ใช้ SuperAi อยู่จริง แอปส่งแค่รหัสสุ่มของเครื่องนี้ เวอร์ชันแอป และระบบปฏิบัติการ ไม่ส่งชื่อ บัญชี โปรเจกต์ หรือบทสนทนา")} {tr("ปิดไว้จนกว่าคุณจะอนุญาต และเมื่อปิด รหัสสุ่มจะถูกลบ")}</p>
          <label className="settings-toggle">
            <input type="checkbox" checked={usage.enabled} onChange={e => void window.superai?.usage?.("set", e.target.checked).then(setUsage).catch(() => {})} />
            {tr("ร่วมนับเครื่องนี้เป็นผู้ใช้งาน")}
          </label>
        </>
      )}
    </>
  );
}
