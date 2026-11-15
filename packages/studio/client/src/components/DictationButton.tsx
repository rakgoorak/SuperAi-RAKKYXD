import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Mic, X } from "lucide-react";
import type { MouseEvent, PointerEvent } from "react";
import { SPEECH_MODELS } from "../voice/models";
import { Microphone } from "../voice/recorder";
import type { VoiceSettings } from "../voice/speech";
import { isModelCached, sharedRecognizer } from "../voice/stt";
import { tr } from '../i18n';

type State = "idle" | "confirm" | "loading" | "recording" | "transcribing";

const HOLD_MS = 450;

// Speak-to-type like Claude: press and hold to record (release to finish), or tap to
// start and tap again to finish. Right-click picks the microphone and language.
// The text is inserted into the composer, never sent.
export function DictationButton({ settings, onText, onError, onSettingsChange }: {
  settings: VoiceSettings;
  onText: (text: string) => void;
  onError: (message: string) => void;
  onSettingsChange: (next: VoiceSettings) => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [level, setLevel] = useState(0);
  const [progress, setProgress] = useState(0);
  const mic = useRef<Microphone | null>(null);
  const press = useRef<{ at: number; stop: boolean } | null>(null);
  const [menu, setMenu] = useState(false);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const model = SPEECH_MODELS[settings.model];

  useEffect(() => () => mic.current?.close(), []);

  const record = async () => {
    try {
      setState("loading");
      await sharedRecognizer().load(settings.model, (loaded, total) => total && setProgress(loaded / total));
      mic.current = new Microphone();
      await mic.current.open(settings.microphone || undefined);
      setState("recording");
      const audio = await mic.current.listen({ silenceMs: 60000, maxMs: 120000, onLevel: setLevel });
      mic.current.close();
      mic.current = null;
      setLevel(0);
      if (!audio || audio.length < 16000 * 0.3) { setState("idle"); return onError(tr("ไม่ได้ยินเสียงพูด ลองพูดใกล้ไมค์อีกครั้ง")); }
      setState("transcribing");
      const text = (await sharedRecognizer().transcribe(settings.model, audio, settings.language)).trim();
      setState("idle");
      if (text) onText(text); else onError(tr("แปลงเสียงไม่ได้ ลองพูดอีกครั้ง"));
    } catch (e) {
      mic.current?.close();
      mic.current = null;
      setState("idle");
      onError((e as Error).message);
    }
  };

  const begin = async () => {
    if (await isModelCached(model.repo)) void record();
    else setState("confirm");
  };
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    setMenu(false);
    if (state === "recording") { press.current = { at: Date.now(), stop: true }; return; }
    if (state !== "idle") return;
    press.current = { at: Date.now(), stop: false };
    void begin();
  };
  const up = () => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    // A tap during recording ends it; a long press that started it ends on release.
    if (p.stop || Date.now() - p.at >= HOLD_MS) mic.current?.submit();
  };
  // Keyboard activation (Enter/Space) has no pointer events: plain toggle.
  const keyClick = (e: MouseEvent) => {
    if (e.detail !== 0) return;
    if (state === "recording") mic.current?.submit();
    else if (state === "idle") void begin();
  };
  const openMenu = async (e: MouseEvent) => {
    e.preventDefault();
    try { setMics((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput" && d.deviceId !== "default")); } catch {}
    setMenu(true);
  };

  const title =
    state === "recording" ? tr("กำลังฟัง · ปล่อยปุ่มหรือกดอีกครั้งเพื่อใส่ข้อความ")
      : state === "transcribing" ? tr("กำลังแปลงเสียงเป็นข้อความ…")
      : state === "loading" ? (progress > 0 && progress < 1 ? tr`กำลังดาวน์โหลดโมเดล ${Math.round(progress * 100)}%` : tr("กำลังเตรียมไมโครโฟน…"))
      : tr("กดค้างเพื่ออัดเสียง หรือกดหนึ่งครั้งเพื่อเริ่ม/หยุด · คลิกขวาเพื่อตั้งค่าไมโครโฟน");

  return (
    <span className="dictation">
      {state === "confirm" && (
        <span className="dictation-confirm" role="dialog" aria-label={tr("ดาวน์โหลดโมเดลแปลงเสียง")}>
          <span>{tr("ใช้ครั้งแรกต้องดาวน์โหลดโมเดลแปลงเสียง")} {model.size} {tr("ครั้งเดียว แล้วแปลงเสียงบนเครื่อง")}</span>
          <button className="primary compact" onClick={() => void record()}><Check size={13} /> {tr("ดาวน์โหลด")}</button>
          <button className="icon-button" title={tr("ยกเลิก")} onClick={() => setState("idle")}><X size={14} /></button>
        </span>
      )}
      {menu && (
        <span className="dictation-menu" role="menu" aria-label={tr("ตั้งค่าไมโครโฟน")} onMouseLeave={() => setMenu(false)}>
          <strong>{tr("ไมโครโฟน")}</strong>
          {[{ deviceId: "", label: tr("ค่าเริ่มต้นของระบบ") }, ...mics].map((m) => (
            <button key={m.deviceId || "default"} role="menuitemradio" aria-checked={settings.microphone === m.deviceId}
              onClick={() => { onSettingsChange({ ...settings, microphone: m.deviceId }); setMenu(false); }}>
              {settings.microphone === m.deviceId ? <Check size={13} /> : <span className="menu-gap" />} {m.label || tr("ไมโครโฟน")}
            </button>
          ))}
          <strong>{tr("ภาษาที่พูด")}</strong>
          {([["th", tr("ภาษาไทย")], ["en", "English"], ["auto", tr("ตรวจอัตโนมัติ")]] as const).map(([value, label]) => (
            <button key={value} role="menuitemradio" aria-checked={settings.language === value}
              onClick={() => { onSettingsChange({ ...settings, language: value }); setMenu(false); }}>
              {settings.language === value ? <Check size={13} /> : <span className="menu-gap" />} {label}
            </button>
          ))}
        </span>
      )}
      {state === "loading" && progress > 0 && progress < 1 && <span className="dictation-progress">{Math.round(progress * 100)}%</span>}
      <button
        className={`icon-button dictation-button ${state}`}
        title={title}
        aria-label={title}
        aria-pressed={state === "recording"}
        aria-disabled={state === "loading" || state === "transcribing"}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={keyClick}
        onContextMenu={(e) => void openMenu(e)}
        style={state === "recording" ? { boxShadow: `0 0 0 ${2 + level * 6}px rgba(244, 166, 166, 0.35)` } : undefined}
      >
        {state === "loading" || state === "transcribing" ? <LoaderCircle size={15} className="spin" /> : <Mic size={15} />}
      </button>
    </span>
  );
}
