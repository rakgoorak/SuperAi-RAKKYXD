export type SpeechModelId = "thai" | "base" | "small";

export interface SpeechModel {
  repo: string;
  revision?: string;
  label: string;
  size: string;
  dtype: Record<string, "fp32" | "q8">;
}

// Encoder quantization hurts Whisper accuracy more than decoder quantization,
// so Base keeps an fp32 encoder; the Small variants use q8 throughout.
export const SPEECH_MODELS: Record<SpeechModelId, SpeechModel> = {
  // Thonburian Whisper (Mahidol University, Apache-2.0) fine-tuned for Thai, exported
  // for transformers.js by a third party, so it is pinned to the audited commit.
  thai: {
    repo: "phagehunter/whisper-th-small-onnx",
    revision: "12acd0b6c50021194c71487cd5f62c1497800dfd",
    label: "Thonburian · ไทยแม่นที่สุด",
    size: "≈290 MB",
    dtype: { encoder_model: "q8", decoder_model_merged: "q8" },
  },
  base: {
    repo: "onnx-community/whisper-base",
    label: "Base · เร็ว เน้นอังกฤษ",
    size: "≈135 MB",
    dtype: { encoder_model: "fp32", decoder_model_merged: "q8" },
  },
  small: {
    repo: "onnx-community/whisper-small",
    label: "Small · หลายภาษา",
    size: "≈250 MB",
    dtype: { encoder_model: "q8", decoder_model_merged: "q8" },
  },
};
