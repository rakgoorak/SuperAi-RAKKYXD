import { useEffect, useState } from "react";
import { SPEECH_MODELS, type SpeechModelId } from "../voice/models";
import type { VoiceSettings } from "../voice/speech";
import { tr } from '../i18n';

export function VoiceSettingsPanel({ settings, onChange }: { settings: VoiceSettings; onChange: (next: VoiceSettings) => void }) {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const set = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => onChange({ ...settings, [key]: value });

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.()
      .then((devices) => setMics(devices.filter((d) => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default")))
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="settings-section-title">
        <h3>{tr("พูดเพื่อพิมพ์")}</h3>
      </div>
      <p className="muted">{tr("กดค้างปุ่มไมค์ในช่องพิมพ์แล้วพูด ปล่อยเพื่อใส่ข้อความ (หรือกดหนึ่งครั้งเพื่อเริ่ม/หยุด) แปลงเสียงบนเครื่องด้วย Whisper ไม่ต้องใช้ Python หรือ API key ข้อความจะไม่ถูกส่งเองจนกว่าคุณกดส่ง")}</p>
      <div className="voice-settings-grid">
        <label className="settings-label">{tr("โมเดลแปลงเสียง")}
          <select value={settings.model} onChange={(e) => set("model", e.target.value as SpeechModelId)}>
            {Object.entries(SPEECH_MODELS).map(([id, m]) => <option key={id} value={id}>{speechModelLabel(id as SpeechModelId)} · {m.size}</option>)}
          </select>
        </label>
        <label className="settings-label">{tr("ภาษาที่พูด")}
          <select value={settings.language} onChange={(e) => set("language", e.target.value as VoiceSettings["language"])}>
            <option value="th">{tr("ภาษาไทย")}</option><option value="en">English</option><option value="auto">{tr("ตรวจอัตโนมัติ")}</option>
          </select>
        </label>
        <label className="settings-label">{tr("ไมโครโฟน")}
          <select value={settings.microphone} onChange={(e) => set("microphone", e.target.value)}>
            <option value="">{tr("ค่าเริ่มต้นของระบบ")}</option>
            {mics.map((m) => <option key={m.deviceId} value={m.deviceId}>{m.label || tr("ไมโครโฟน")}</option>)}
          </select>
        </label>
      </div>
    </>
  );
}

function speechModelLabel(id: SpeechModelId) {
  switch (id) {
    case "thai": return tr("Thonburian · ไทยแม่นที่สุด");
    case "base": return tr("Base · เร็ว เน้นอังกฤษ");
    case "small": return tr("Small · หลายภาษา");
  }
}
