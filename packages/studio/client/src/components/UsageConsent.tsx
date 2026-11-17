import { useEffect, useState } from "react";
import { tr } from "../i18n";
import { openExternalLink } from "../previewLinks";

const PRIVACY = "https://github.com/rakgoorak/SuperAi-RAKKYXD/blob/main/PRIVACY.md#what-the-app-sends-to-us";

/**
 * Asked once, on first launch (and once for installs from before the question): may the app
 * count this computer as a user? Nothing is sent and no id exists until the answer is yes.
 * The same choice is in Settings › Notifications. Waits while another window is open.
 */
export function UsageConsent({ hidden }: { hidden: boolean }) {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    void window.superai?.usage?.("state").then(s => setAsk(!!s?.available && s.asked === false)).catch(() => {});
  }, []);
  if (!ask || hidden) return null;
  const answer = (yes: boolean) => {
    setAsk(false);
    void window.superai?.usage?.("set", yes).catch(() => {});
  };
  return (
    <aside className="update-toast usage-consent" role="dialog" aria-labelledby="usage-consent-title">
      <strong id="usage-consent-title">{tr("ช่วยนับจำนวนผู้ใช้ได้ไหม")}</strong>
      <small>{tr("ถ้าอนุญาต แอปจะส่งรหัสสุ่มของเครื่องนี้ เวอร์ชันแอป และระบบปฏิบัติการทุก 10 นาที เพื่อแสดงจำนวนผู้ใช้บนหน้าดาวน์โหลด ฝั่งรับบันทึกประเทศจากการเชื่อมต่อด้วย ไม่ส่งชื่อ บัญชี โปรเจกต์ หรือบทสนทนา เปลี่ยนได้ทุกเมื่อในการตั้งค่า")}</small>
      <div className="update-actions">
        <button className="primary" onClick={() => answer(true)}>{tr("อนุญาต")}</button>
        <button className="secondary" onClick={() => answer(false)}>{tr("ไม่อนุญาต")}</button>
        <button className="text-button" onClick={() => openExternalLink(PRIVACY)}>{tr("นโยบายความเป็นส่วนตัว")}</button>
      </div>
    </aside>
  );
}
