import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Mic, X } from "lucide-react";
import { SPEECH_MODELS } from "../voice/models";
import { Microphone } from "../voice/recorder";
import type { VoiceSettings } from "../voice/speech";
import { isModelCached, sharedRecognizer } from "../voice/stt";

type State = "idle" | "confirm" | "loading" | "recording" | "transcribing";

// Speak-to-type: click to record, click again to stop; the text is inserted, never sent.
export function DictationButton({ settings, onText, onError }: { settings: VoiceSettings; onText: (text: string) => void; onError: (message: string) => void }) {
  const [state, setState] = useState<State>("idle");
  const [level, setLevel] = useState(0);
  const [progress, setProgress] = useState(0);
  const mic = useRef<Microphone | null>(null);
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
      if (!audio || audio.length < 16000 * 0.3) { setState("idle"); return onError("ไม่ได้ยินเสียงพูด ลองพูดใกล้ไมค์อีกครั้ง"); }
      setState("transcribing");
      const text = (await sharedRecognizer().transcribe(settings.model, audio, settings.language)).trim();
      setState("idle");
      if (text) onText(text); else onError("แปลงเสียงไม่ได้ ลองพูดอีกครั้ง");
    } catch (e) {
      mic.current?.close();
      mic.current = null;
      setState("idle");
      onError((e as Error).message);
    }
  };

  const click = async () => {
    if (state === "recording") return mic.current?.submit();
    if (state !== "idle") return;
    if (await isModelCached(model.repo)) void record();
    else setState("confirm");
  };

  const title =
    state === "recording" ? "กำลังฟัง · กดอีกครั้งเพื่อหยุดและใส่ข้อความ"
      : state === "transcribing" ? "กำลังแปลงเสียงเป็นข้อความ…"
      : state === "loading" ? (progress > 0 && progress < 1 ? `กำลังดาวน์โหลดโมเดล ${Math.round(progress * 100)}%` : "กำลังเตรียมไมโครโฟน…")
      : "พูดเพื่อพิมพ์";

  return (
    <span className="dictation">
      {state === "confirm" && (
        <span className="dictation-confirm" role="dialog" aria-label="ดาวน์โหลดโมเดลแปลงเสียง">
          <span>ใช้ครั้งแรกต้องดาวน์โหลดโมเดลแปลงเสียง {model.size} ครั้งเดียว แล้วแปลงเสียงบนเครื่อง</span>
          <button className="primary compact" onClick={() => void record()}><Check size={13} /> ดาวน์โหลด</button>
          <button className="icon-button" title="ยกเลิก" onClick={() => setState("idle")}><X size={14} /></button>
        </span>
      )}
      {state === "loading" && progress > 0 && progress < 1 && <span className="dictation-progress">{Math.round(progress * 100)}%</span>}
      <button
        className={`icon-button dictation-button ${state}`}
        title={title}
        aria-label={title}
        aria-pressed={state === "recording"}
        disabled={state === "loading" || state === "transcribing"}
        onClick={() => void click()}
        style={state === "recording" ? { boxShadow: `0 0 0 ${2 + level * 6}px rgba(244, 166, 166, 0.35)` } : undefined}
      >
        {state === "loading" || state === "transcribing" ? <LoaderCircle size={15} className="spin" /> : <Mic size={15} />}
      </button>
    </span>
  );
}
