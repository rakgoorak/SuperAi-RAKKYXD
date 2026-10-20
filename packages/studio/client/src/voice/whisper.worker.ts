/// <reference lib="webworker" />
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { SPEECH_MODELS, type SpeechModelId } from "./models";

// Runtime files are served by the app (scripts/copy-ort.mjs); only weights are downloaded.
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm!.wasmPaths = `${self.location.origin}/ort/`;
// Desktop enables SharedArrayBuffer, which lets ONNX use several cores.
env.backends.onnx.wasm!.numThreads = typeof SharedArrayBuffer !== "undefined" ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 1;

type Request =
  | { id: number; type: "load"; model: SpeechModelId }
  | { id: number; type: "transcribe"; model: SpeechModelId; audio: Float32Array; language: string };

let current: { model: SpeechModelId; asr: Promise<AutomaticSpeechRecognitionPipeline> } | null = null;

// WASM only: on low-end GPUs WebGPU was slower and returned empty decodes.
function load(model: SpeechModelId, id: number) {
  if (current?.model === model) return current.asr;
  const spec = SPEECH_MODELS[model];
  const files = new Map<string, { loaded: number; total: number }>();
  const asr = pipeline("automatic-speech-recognition", spec.repo, {
    revision: spec.revision,
    dtype: spec.dtype,
    device: "wasm",
    progress_callback: (event: any) => {
      if (event.status !== "progress" || !event.file) return;
      files.set(event.file, { loaded: event.loaded || 0, total: event.total || 0 });
      let loaded = 0, total = 0;
      for (const f of files.values()) { loaded += f.loaded; total += f.total; }
      self.postMessage({ id, type: "progress", loaded, total });
    },
  }) as Promise<AutomaticSpeechRecognitionPipeline>;
  current = { model, asr };
  asr.catch(() => { if (current?.asr === asr) current = null; });
  return asr;
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    const asr = await load(request.model, request.id);
    if (request.type === "load") return self.postMessage({ id: request.id, type: "done" });
    const output: any = await asr(request.audio, {
      language: request.language === "auto" ? undefined : request.language,
      task: "transcribe",
      chunk_length_s: 30,
      return_timestamps: false,
      // Small models can loop on Thai; bound output by clip length.
      max_new_tokens: Math.min(440, Math.round(24 + (request.audio.length / 16000) * 22)),
      repetition_penalty: 1.15,
    } as any);
    const text = (Array.isArray(output) ? output.map((o) => o.text).join(" ") : output.text) || "";
    self.postMessage({ id: request.id, type: "done", text: collapseRepeats(text) });
  } catch (error) {
    self.postMessage({ id: request.id, type: "error", message: (error as Error).message || String(error) });
  }
};

// "การการการการ..." → "การ": a runaway decode, not speech.
export function collapseRepeats(text: string) {
  return text.replace(/(.{1,12}?)(?:\s*\1){3,}/gu, "$1").replace(/\s+/g, " ").trim();
}
