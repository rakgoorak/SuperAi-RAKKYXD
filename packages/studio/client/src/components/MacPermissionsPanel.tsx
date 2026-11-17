import { useCallback, useEffect, useState } from "react";
import { Camera, Check, ExternalLink, HardDrive, LoaderCircle, Mic, Monitor, RefreshCw, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { MacPermissionPane, MacPermissionStatus } from "../desktop";
import { tr } from "../i18n";

type RequestablePermission = "microphone" | "camera" | "screen" | "accessibility";
type PermissionIcon = typeof Mic;

const levelLabel = (level: MacPermissionStatus["microphone"]): string => ({
  "not-determined": tr("ยังไม่เคยอนุญาต"),
  granted: tr("อนุญาตแล้ว"),
  denied: tr("ยังไม่อนุญาต"),
  restricted: tr("ถูกจำกัดโดยระบบ"),
  unknown: tr("ตรวจไม่พบสถานะ"),
})[level];

function PermissionRow({
  icon: Icon,
  title,
  description,
  status,
  statusKind,
  children,
}: {
  icon: PermissionIcon;
  title: string;
  description: string;
  status: string;
  statusKind: "granted" | "pending" | "manual";
  children: ReactNode;
}) {
  return (
    <article className="mac-permission-row">
      <span className="mac-permission-icon"><Icon size={17} strokeWidth={1.7} /></span>
      <div className="mac-permission-main">
        <div className="mac-permission-heading"><strong>{title}</strong><span className={`mac-permission-status ${statusKind}`}>{status}</span></div>
        <p>{description}</p>
      </div>
      <div className="mac-permission-actions">{children}</div>
    </article>
  );
}

export function MacPermissionsPanel() {
  const [status, setStatus] = useState<MacPermissionStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const api = window.superai?.macPermissions;
    if (!api) return;
    setError("");
    try {
      setStatus(await api.status());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("อ่านสถานะสิทธิ์ macOS ไม่สำเร็จ"));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const request = async (permission: RequestablePermission) => {
    const api = window.superai?.macPermissions;
    if (!api) return;
    setBusy(permission);
    setMessage("");
    setError("");
    try {
      const result = await api.request(permission);
      setStatus(result.status);
      if (permission === "accessibility") {
        setMessage(result.granted
          ? tr("macOS อนุญาต Accessibility แล้ว")
          : tr("macOS เปิดหน้าต่างจัดการ Accessibility แล้ว ให้เปิดสวิตช์ SuperAi ใน System Settings"));
      } else if (permission === "screen") {
        setMessage(result.granted
          ? tr("macOS อนุญาตการบันทึกหน้าจอแล้ว")
          : tr("ยังไม่ได้รับอนุญาต หากไม่เห็นหน้าต่าง macOS ให้เปิด Screen & System Audio Recording ใน Settings"));
      } else {
        setMessage(result.granted
          ? (permission === "microphone" ? tr("macOS อนุญาตไมโครโฟนแล้ว") : tr("macOS อนุญาตกล้องแล้ว"))
          : tr("ยังไม่ได้รับอนุญาต หากเคยกดไม่อนุญาตแล้ว ให้เปิดสิทธิ์ใน System Settings และเริ่มแอปใหม่"));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("ขอสิทธิ์จาก macOS ไม่สำเร็จ"));
    } finally {
      setBusy(null);
    }
  };

  const openSettings = async (permission: MacPermissionPane) => {
    const api = window.superai?.macPermissions;
    if (!api) return;
    setBusy(`settings:${permission}`);
    setError("");
    try {
      await api.openSettings(permission);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("เปิด System Settings ไม่สำเร็จ"));
    } finally {
      setBusy(null);
    }
  };

  const mediaAction = (permission: "microphone" | "camera", level: MacPermissionStatus["microphone"]) => {
    if (level === "granted") return <span className="mac-permission-granted"><Check size={14} /> {tr("พร้อมใช้")}</span>;
    if (level === "not-determined") {
      return <button className="secondary compact" disabled={busy !== null} onClick={() => void request(permission)}>
        {busy === permission ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />} {tr("ขอ Allow")}
      </button>;
    }
    return <button className="secondary compact" disabled={busy !== null} onClick={() => void openSettings(permission)}>
      {busy === `settings:${permission}` ? <LoaderCircle className="spin" size={14} /> : <ExternalLink size={14} />} {tr("เปิด Settings")}
    </button>;
  };

  const screenAction = (level: MacPermissionStatus["screen"] | undefined) => {
    if (level === "granted") return <span className="mac-permission-granted"><Check size={14} /> {tr("พร้อมใช้")}</span>;
    if (level === "not-determined") return <button className="secondary compact" disabled={busy !== null} onClick={() => void request("screen")}>
      {busy === "screen" ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />} {tr("ส่งคำขอให้ macOS")}
    </button>;
    return <button className="secondary compact" disabled={busy !== null} onClick={() => void openSettings("screen")}>
      {busy === "settings:screen" ? <LoaderCircle className="spin" size={14} /> : <ExternalLink size={14} />} {tr("เปิด Settings")}
    </button>;
  };

  const mediaStatus = (value: MacPermissionStatus["microphone"] | undefined) => value ? levelLabel(value) : tr("กำลังตรวจสถานะ…");

  return (
    <div className="mac-permissions-panel">
      <div className="settings-section-title mac-permissions-title">
        <h3>{tr("ความเป็นส่วนตัวใน macOS")}</h3>
        <button className="text-button" disabled={busy !== null} onClick={() => void refresh()}>
          <RefreshCw size={13} /> {tr("ตรวจสอบอีกครั้ง")}
        </button>
      </div>
      <p className="muted mac-permissions-intro">
        {tr("ไมโครโฟนและกล้องเรียกหน้าต่าง Allow/Deny ของ macOS ได้เมื่อกดขอครั้งแรก การบันทึกหน้าจอส่งคำขอระบบและอาจพาไป Settings ส่วน Accessibility และ Full Disk Access ต้องเปิดใน Settings เอง")}
      </p>

      <div className="mac-permission-list">
        <PermissionRow icon={Mic} title={tr("ไมโครโฟน")} description={tr("ใช้ Dictation แปลงเสียงพูดเป็นข้อความบนเครื่อง")} status={mediaStatus(status?.microphone)} statusKind={status?.microphone === "granted" ? "granted" : "pending"}>
          {status && mediaAction("microphone", status.microphone)}
        </PermissionRow>
        <PermissionRow icon={Camera} title={tr("กล้อง")} description={tr("macOS จะแสดง Allow เมื่อกดขอสิทธิ์; ตอนนี้แอปยังไม่มีฟีเจอร์ที่เรียกใช้กล้อง")} status={mediaStatus(status?.camera)} statusKind={status?.camera === "granted" ? "granted" : "pending"}>
          {status && mediaAction("camera", status.camera)}
        </PermissionRow>
        <PermissionRow icon={Monitor} title={tr("บันทึกหน้าจอ")} description={tr("ส่งคำขอจับภาพหน้าจอให้ macOS; ระบบอาจให้เปิดสิทธิ์ใน Settings")} status={mediaStatus(status?.screen)} statusKind={status?.screen === "granted" ? "granted" : status?.screen === "not-determined" ? "pending" : "manual"}>
          {screenAction(status?.screen)}
        </PermissionRow>
        <PermissionRow icon={ShieldCheck} title="Accessibility" description={tr("กดขอให้ macOS แสดงหน้าต่างยืนยันได้ แต่ต้องเปิดสวิตช์ SuperAi ใน System Settings เอง")} status={status ? status.accessibility ? tr("อนุญาตแล้ว") : tr("ยังไม่อนุญาต") : tr("กำลังตรวจสถานะ…")} statusKind={status?.accessibility ? "granted" : "manual"}>
          {status?.accessibility ? <span className="mac-permission-granted"><Check size={14} /> {tr("พร้อมใช้")}</span> : <>
            <button className="secondary compact" disabled={busy !== null} onClick={() => void request("accessibility")}>
              {busy === "accessibility" ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />} {tr("ขอสิทธิ์จาก macOS")}
            </button>
            <button className="text-button" disabled={busy !== null} onClick={() => void openSettings("accessibility")}>{tr("เปิด Settings")}</button>
          </>}
        </PermissionRow>
        <PermissionRow icon={HardDrive} title="Full Disk Access" description={tr("macOS ไม่เปิดเผยสถานะนี้ให้แอปตรวจอัตโนมัติ; ใช้เฉพาะเมื่อคุณต้องการให้เข้าถึงไฟล์ที่ได้รับการป้องกัน")} status={tr("ตรวจสอบใน Settings")} statusKind="manual">
          <button className="secondary compact" disabled={busy !== null} onClick={() => void openSettings("fullDiskAccess")}>
            {busy === "settings:fullDiskAccess" ? <LoaderCircle className="spin" size={14} /> : <ExternalLink size={14} />} {tr("เปิด Settings")}
          </button>
        </PermissionRow>
      </div>
      {message && <p className="mac-permissions-message" role="status">{message}</p>}
      {error && <p className="inline-error mac-permissions-error" role="alert">{error}</p>}
      <p className="muted mac-permissions-note">{tr("หากเคยปฏิเสธไมค์ กล้อง หรือการบันทึกหน้าจอ macOS จะไม่ถามซ้ำจากปุ่มนี้ ให้เปลี่ยนใน Settings แล้วเริ่มแอปใหม่")}</p>
    </div>
  );
}
