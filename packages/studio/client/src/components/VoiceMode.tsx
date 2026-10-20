import { useCallback, useEffect, useRef, useState } from "react";
import { Download, LoaderCircle, Mic, MicOff, Settings, Square, X } from "lucide-react";
import type { Run } from "../api";
import { SPEECH_MODELS } from "../voice/models";
import { Microphone } from "../voice/recorder";
import { Speaker, type VoiceSettings } from "../voice/speech";
import { isModelCached, sharedRecognizer, type SpeechRecognizer } from "../voice/stt";

type Phase = "checking" | "download" | "loading" | "listening" | "hearing" | "transcribing" | "thinking" | "speaking" | "paused" | "error";

const phaseText: Record<Phase, string> = {
  checking: "กำลังเตรียมโหมดเสียง…",
  download: "ต้องดาวน์โหลดโมเดลแปลงเสียงหนึ่งครั้ง",
  loading: "กำลังโหลดโมเดลแปลงเสียง…",
  listening: "พูดได้เลย ฟังอยู่",
  hearing: "กำลังฟัง…",
  transcribing: "กำลังแปลงเสียงเป็นข้อความ…",
  thinking: "กำลังคิดคำตอบ…",
  speaking: "กำลังพูด · แตะวงกลมเพื่อพูดแทรก",
  paused: "ปิดไมค์อยู่ · แตะไมค์เพื่อพูดต่อ",
  error: "เกิดข้อผิดพลาด",
};

interface Props {
  runs: Run[];
  target: string;
  settings: VoiceSettings;
  submit: (text: string) => Promise<Run>;
  cancel: (id: string) => Promise<void>;
  openSettings: () => void;
  close: () => void;
}

export function VoiceMode({ runs, target, settings, submit, cancel, openSettings, close }: Props) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [level, setLevel] = useState(0);
  const [progress, setProgress] = useState(0);
  const [heard, setHeard] = useState("");
  const [runId, setRunId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const recognizer = useRef<SpeechRecognizer | null>(null);
  const mic = useRef<Microphone | null>(null);
  const speaker = useRef(new Speaker());
  const session = useRef(0);
  const runsRef = useRef(runs);
  runsRef.current = runs;
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const model = SPEECH_MODELS[settings.model];
  const run = runs.find((r) => r.id === runId);

  const waitForRun = useCallback(async (id: string, token: number) => {
    while (session.current === token) {
      const current = runsRef.current.find((r) => r.id === id);
      if (current && current.status !== "running") return current;
      await new Promise((r) => setTimeout(r, 300));
    }
    return null;
  }, []);

  // One conversational turn after another until closed or muted.
  const converse = useCallback(async (token: number) => {
    const alive = () => session.current === token;
    while (alive()) {
      setPhase("listening"); setLevel(0);
      const audio = await mic.current!.listen({
        onLevel: setLevel,
        onSpeechStart: () => alive() && setPhase("hearing"),
      });
      if (!alive()) return;
      if (!audio || audio.length < 16000 * 0.4) continue;
      setPhase("transcribing"); setLevel(0);
      const s = settingsRef.current;
      const text = (await recognizer.current!.transcribe(s.model, audio, s.language)).trim();
      if (!alive()) return;
      // Whisper hallucinates short filler on noise; ignore it.
      if (!text || /^[\s.,!?…\-()[\]]*$/.test(text) || /^\(.*\)$|^\[.*\]$/.test(text)) { setNotice("ไม่ได้ยินชัด ลองพูดอีกครั้ง"); continue; }
      setNotice(""); setHeard(text);
      setPhase("thinking");
      const started = await submitRef.current(text);
      setRunId(started.id);
      const done = await waitForRun(started.id, token);
      if (!alive() || !done) return;
      if (done.status !== "completed") {
        setNotice(done.error || "ผู้ช่วยตอบไม่สำเร็จ");
        continue;
      }
      if (settingsRef.current.speakReplies && done.output.trim()) {
        setPhase("speaking");
        try { await speaker.current.speak(done.output, settingsRef.current); }
        catch (e) { if (alive()) setNotice((e as Error).message); }
      }
    }
  }, [waitForRun]);

  const start = useCallback(async () => {
    const token = ++session.current;
    setError("");
    try {
      setPhase("loading");
      await recognizer.current!.load(settingsRef.current.model, (loaded, total) => total && setProgress(loaded / total));
      if (session.current !== token) return;
      mic.current ??= new Microphone();
      await mic.current.open(settingsRef.current.microphone || undefined);
      await converse(token);
    } catch (e) {
      if (session.current !== token) return;
      setError((e as Error).message);
      setPhase("error");
    }
  }, [converse]);

  useEffect(() => {
    recognizer.current = sharedRecognizer();
    let ignore = false;
    void isModelCached(SPEECH_MODELS[settingsRef.current.model].repo).then((cached) => {
      if (ignore) return;
      if (cached) void start(); else setPhase("download");
    });
    const speakerNow = speaker.current;
    return () => {
      ignore = true;
      session.current++;
      speakerNow.stop();
      mic.current?.close();
    };
  }, [start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const pause = () => {
    session.current++;
    speaker.current.stop();
    mic.current?.cancel();
    setLevel(0);
    setPhase("paused");
  };
  const tapOrb = () => {
    if (phase === "speaking") { speaker.current.stop(); return; }
    if (phase === "hearing") { mic.current?.submit(); return; }
    if (phase === "paused" || phase === "error") void start();
  };
  const stopThinking = async () => {
    if (run?.status === "running") await cancel(run.id).catch((e) => setNotice((e as Error).message));
  };

  const busy = ["checking", "loading", "transcribing", "thinking"].includes(phase);
  const scale = 1 + (phase === "hearing" || phase === "listening" ? level * 0.45 : 0);

  return (
    <div className="voice-mode" role="dialog" aria-modal="true" aria-label="โหมดเสียง">
      <div className="voice-top">
        <span className="voice-target">คุยกับ {target}</span>
        <button className="icon-button" title="ตั้งค่าเสียง" onClick={openSettings}><Settings size={18} /></button>
      </div>
      <div className="voice-center">
        {phase === "download" ? (
          <div className="voice-download">
            <h2>ดาวน์โหลดโมเดลแปลงเสียง</h2>
            <p>โหมดเสียงแปลงเสียงพูดเป็นข้อความบนเครื่องของคุณด้วย Whisper ไม่ต้องติดตั้ง Python หรือใช้ API key ดาวน์โหลดครั้งเดียวจาก Hugging Face แล้วใช้แบบออฟไลน์ได้</p>
            <p className="muted">โมเดล {model.label} · {model.size} · เปลี่ยนได้ในตั้งค่าเสียง</p>
            <button className="primary" onClick={() => void start()}><Download size={16} /> ดาวน์โหลดและเริ่มคุย</button>
          </div>
        ) : (
          <>
            <button
              className={`voice-orb ${phase}`}
              style={{ transform: `scale(${scale})` }}
              onClick={tapOrb}
              aria-label={phase === "speaking" ? "หยุดพูด" : phase === "hearing" ? "ส่งเสียงทันที" : "เริ่มฟัง"}
            >
              {busy && <LoaderCircle size={34} className="spin" />}
            </button>
            <p className="voice-status" role="status">
              {phase === "loading" && progress > 0 && progress < 1 ? `กำลังดาวน์โหลดโมเดล ${Math.round(progress * 100)}%` : phaseText[phase]}
            </p>
            {error && <p className="voice-error" role="alert">{error}</p>}
            {notice && !error && <p className="voice-notice">{notice}</p>}
            {heard && (
              <div className="voice-transcript">
                <p className="voice-you">“{heard}”</p>
                {run?.output && run.status !== "running" && <p className="voice-reply">{run.output}</p>}
              </div>
            )}
          </>
        )}
      </div>
      <div className="voice-controls">
        {phase === "thinking" ? (
          <button className="voice-control" title="หยุดคำตอบ" onClick={() => void stopThinking()}><Square size={20} /></button>
        ) : (
          <button
            className={`voice-control ${phase === "paused" ? "muted" : ""}`}
            title={phase === "paused" ? "เปิดไมค์" : "ปิดไมค์"}
            disabled={phase === "download" || phase === "checking" || phase === "loading"}
            onClick={phase === "paused" || phase === "error" ? () => void start() : pause}
          >
            {phase === "paused" ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
        )}
        <button className="voice-control end" title="ออกจากโหมดเสียง (Esc)" onClick={close}><X size={22} /></button>
      </div>
      <p className="voice-footnote">แปลงเสียงบนเครื่อง · คำถามถูกส่งให้ผู้ช่วยที่คุณเลือกในโหมดสนทนา</p>
    </div>
  );
}
