import { SPEECH_MODELS, type SpeechModelId } from "./models";

// Settings for speak-to-type (the composer mic).
export interface VoiceSettings {
  model: SpeechModelId;
  language: "th" | "en" | "auto";
  microphone: string;
}

const KEY = "superai-voice-settings";
export const defaultVoiceSettings: VoiceSettings = { model: "thai", language: "th", microphone: "" };

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
