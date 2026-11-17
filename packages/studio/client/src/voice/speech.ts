import { SPEECH_MODELS, type SpeechModelId } from "./models";
import { getLocale } from "../i18n";

// Settings for speak-to-type (the composer mic).
export interface VoiceSettings {
  model: SpeechModelId;
  language: "th" | "en" | "auto";
  microphone: string;
}

const KEY = "superai-voice-settings";
// Thai app: the Thai-tuned model; other languages: the multilingual model, listening for that language.
const locale = getLocale();
export const defaultVoiceSettings: VoiceSettings = locale === "th"
  ? { model: "thai", language: "th", microphone: "" }
  : { model: "small", language: locale === "en" ? "en" : "auto", microphone: "" };

export function loadVoiceSettings(): VoiceSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    const settings: VoiceSettings = {
      model: saved.model in SPEECH_MODELS ? saved.model : defaultVoiceSettings.model,
      language: ["th", "en", "auto"].includes(saved.language) ? saved.language : defaultVoiceSettings.language,
      microphone: typeof saved.microphone === "string" ? saved.microphone : "",
    };
    return settings;
  } catch {
    return defaultVoiceSettings;
  }
}

export function saveVoiceSettings(settings: VoiceSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}
