import { SPEECH_MODELS, type SpeechModelId } from "./models";

export interface VoiceSettings {
  model: SpeechModelId;
  language: "th" | "en" | "auto";
  voiceTh: string;
  voiceEn: string;
  rate: number;
  microphone: string;
  speakReplies: boolean;
}

const KEY = "superai-voice-settings";
export const defaultVoiceSettings: VoiceSettings = { model: "thai", language: "th", voiceTh: "", voiceEn: "", rate: 1, microphone: "", speakReplies: true };

export function loadVoiceSettings(): VoiceSettings {
  try {
    const saved = { ...defaultVoiceSettings, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    return saved.model in SPEECH_MODELS ? saved : { ...saved, model: defaultVoiceSettings.model };
  } catch { return defaultVoiceSettings; }
}
export function saveVoiceSettings(settings: VoiceSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}

export interface VoiceOption { id: string; name: string; lang: string; source: "system" | "browser" }

const useServer = () => window.superai?.platform === "win32";

function browserVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

// Windows: OneCore voices through the local server (includes Thai "Pattara").
// macOS / browser: the voices Chromium exposes (Thai "Kanya" on macOS).
export async function listVoices(refresh = false): Promise<VoiceOption[]> {
  if (useServer()) {
    const res = await fetch(`/api/speech/voices${refresh ? "?refresh=1" : ""}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "อ่านรายการเสียงพูดไม่ได้");
    return data.voices.map((v: any) => ({ id: v.id, name: v.name, lang: v.lang, source: "system" as const }));
  }
  return (await browserVoices()).map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang, source: "browser" as const }));
}

export const hasThai = (text: string) => /[฀-๿]/.test(text);

// Code and markup read aloud badly; the full answer stays on screen.
export function speakable(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " (ดูโค้ดบนหน้าจอ) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ลิงก์ ")
    .replace(/^\s*[#>*+-]+\s*/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

export class Speaker {
  private audio: HTMLAudioElement | null = null;
  private url = "";
  private cancelled = false;

  async speak(text: string, settings: VoiceSettings) {
    this.stop();
    this.cancelled = false;
    const clean = speakable(text);
    if (!clean) return;
    const lang = hasThai(clean) ? "th-TH" : "en-US";
    const voice = lang === "th-TH" ? settings.voiceTh : settings.voiceEn;
    if (useServer()) {
      const res = await fetch("/api/speech/synthesize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, lang, voice, rate: settings.rate }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "สร้างเสียงพูดไม่สำเร็จ");
      const blob = await res.blob();
      if (this.cancelled) return;
      this.url = URL.createObjectURL(blob);
      const audio = (this.audio = new Audio(this.url));
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onpause = () => resolve();
        audio.onerror = () => reject(new Error("เล่นเสียงไม่ได้"));
        audio.play().catch(reject);
      });
      return;
    }
    const voices = await browserVoices();
    const chosen = voices.find((v) => v.voiceURI === voice) || voices.find((v) => v.lang.replace("_", "-").startsWith(lang.slice(0, 2)));
    if (!chosen) throw new Error(lang === "th-TH" ? "ยังไม่มีเสียงพูดภาษาไทยในเครื่อง เพิ่มเสียงไทยในการตั้งค่าระบบ แล้วกดตรวจเสียงอีกครั้ง" : "ไม่พบเสียงพูดภาษาอังกฤษ");
    await new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.voice = chosen; utterance.lang = chosen.lang; utterance.rate = settings.rate;
      utterance.onend = () => resolve();
      utterance.onerror = (e) => (e.error === "interrupted" || e.error === "canceled" ? resolve() : reject(new Error(`อ่านออกเสียงไม่ได้: ${e.error}`)));
      speechSynthesis.speak(utterance);
    });
  }

  stop() {
    this.cancelled = true;
    if (this.audio) { this.audio.pause(); this.audio = null; }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = ""; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
}
