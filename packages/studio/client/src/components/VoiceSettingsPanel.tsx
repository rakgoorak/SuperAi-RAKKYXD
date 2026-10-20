import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Volume2 } from "lucide-react";
import { SPEECH_MODELS, type SpeechModelId } from "../voice/models";
import { listVoices, Speaker, type VoiceOption, type VoiceSettings } from "../voice/speech";

export function VoiceSettingsPanel({ settings, onChange, onError }: { settings: VoiceSettings; onChange: (next: VoiceSettings) => void; onError: (message: string) => void }) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState("");
  const speaker = useRef(new Speaker());
  const set = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => onChange({ ...settings, [key]: value });

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      setVoices(await listVoices(refresh));
      setMics((await navigator.mediaDevices?.enumerateDevices?.() || []).filter((d) => d.kind === "audioinput"));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onError]);
  useEffect(() => { void load(); const s = speaker.current; return () => s.stop(); }, [load]);

  const thai = voices.filter((v) => v.lang.toLowerCase().startsWith("th"));
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const test = async (lang: "th" | "en") => {
    setTesting(lang);
    try { await speaker.current.speak(lang === "th" ? "สวัสดีครับ นี่คือเสียงของ SuperAi" : "Hello, this is SuperAi speaking.", settings); }
    catch (e) { onError((e as Error).message); }
    finally { setTesting(""); }
  };

  return (
    <>
      <div className="settings-section-title">
        <h3>โหมดเสียง</h3>
        <button className="text-button" disabled={loading} onClick={() => void load(true)}><RefreshCw size={13} className={loading ? "spin" : ""} /> ตรวจเสียง</button>
      </div>
      <p className="muted">คุยกับผู้ช่วยด้วยเสียงแบบต่อเนื่อง แปลงเสียงพูดเป็นข้อความบนเครื่องด้วย Whisper ไม่ต้องใช้ Python หรือ API key อ่านคำตอบด้วยเสียงพูดของระบบปฏิบัติการ</p>
      <div className="voice-settings-grid">
        <label className="settings-label">โมเดลแปลงเสียง
          <select value={settings.model} onChange={(e) => set("model", e.target.value as SpeechModelId)}>
            {Object.entries(SPEECH_MODELS).map(([id, m]) => <option key={id} value={id}>{m.label} · {m.size}</option>)}
          </select>
        </label>
        <label className="settings-label">ภาษาที่พูด
          <select value={settings.language} onChange={(e) => set("language", e.target.value as VoiceSettings["language"])}>
            <option value="th">ภาษาไทย</option><option value="en">English</option><option value="auto">ตรวจอัตโนมัติ</option>
          </select>
        </label>
        <label className="settings-label">ไมโครโฟน
          <select value={settings.microphone} onChange={(e) => set("microphone", e.target.value)}>
            <option value="">ค่าเริ่มต้นของระบบ</option>
            {mics.filter((m) => m.deviceId && m.deviceId !== "default").map((m) => <option key={m.deviceId} value={m.deviceId}>{m.label || "ไมโครโฟน"}</option>)}
          </select>
        </label>
        <label className="settings-label">ความเร็วเสียงพูด
          <select value={settings.rate} onChange={(e) => set("rate", Number(e.target.value))}>
            {[0.8, 0.9, 1, 1.15, 1.3].map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
        </label>
        <label className="settings-label">เสียงภาษาไทย
          <div className="input-action">
            <select value={settings.voiceTh} onChange={(e) => set("voiceTh", e.target.value)} disabled={!thai.length}>
              <option value="">{thai.length ? "อัตโนมัติ" : "ยังไม่มีเสียงไทยในระบบ"}</option>
              {thai.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <button className="icon-button" title="ทดลองเสียงไทย" disabled={!thai.length || !!testing} onClick={() => void test("th")}><Volume2 size={15} /></button>
          </div>
        </label>
        <label className="settings-label">เสียงภาษาอังกฤษ
          <div className="input-action">
            <select value={settings.voiceEn} onChange={(e) => set("voiceEn", e.target.value)}>
              <option value="">อัตโนมัติ</option>
              {english.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <button className="icon-button" title="ทดลองเสียงอังกฤษ" disabled={!english.length || !!testing} onClick={() => void test("en")}><Volume2 size={15} /></button>
          </div>
        </label>
      </div>
      <label className="tool-permission"><input type="checkbox" checked={settings.speakReplies} onChange={(e) => set("speakReplies", e.target.checked)} /> อ่านคำตอบออกเสียง</label>
      {!thai.length && !loading && (
        <p className="muted">
          ยังไม่มีเสียงพูดภาษาไทย · {window.superai?.platform === "darwin" ? "เพิ่ม Kanya ใน การตั้งค่าระบบ → การช่วยการเข้าถึง → เนื้อหาที่พูด" : "เพิ่มใน การตั้งค่า Windows → เวลาและภาษา → เสียงพูด → เพิ่มเสียง → ไทย"}
          {window.superai && <> · <button className="text-button" onClick={() => void window.superai!.openSpeechSettings().catch((e) => onError(e.message))}>เปิดการตั้งค่าเสียงพูด</button></>}
        </p>
      )}
    </>
  );
}
