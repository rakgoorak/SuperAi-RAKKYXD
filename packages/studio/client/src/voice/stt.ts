import type { SpeechModelId } from "./models";

type Pending = { resolve: (text: string) => void; reject: (error: Error) => void; progress?: (loaded: number, total: number) => void };

// One long-lived worker keeps the loaded model warm between turns.
export class SpeechRecognizer {
  private worker: Worker | null = null;
  private next = 1;
  private pending = new Map<number, Pending>();

  private ensure() {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const job = this.pending.get(data.id);
      if (!job) return;
      if (data.type === "progress") return job.progress?.(data.loaded, data.total);
      this.pending.delete(data.id);
      if (data.type === "error") job.reject(new Error(data.message));
      else job.resolve(data.text || "");
    };
    worker.onerror = (event) => {
      for (const job of this.pending.values()) job.reject(new Error(event.message || "ระบบแปลงเสียงหยุดทำงาน"));
      this.pending.clear();
      this.worker?.terminate();
      this.worker = null;
    };
    return (this.worker = worker);
  }

  private call(message: object, transfer: Transferable[] = [], progress?: Pending["progress"]) {
    const id = this.next++;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, progress });
      this.ensure().postMessage({ id, ...message }, transfer);
    });
  }

  load(model: SpeechModelId, progress?: Pending["progress"]) {
    return this.call({ type: "load", model }, [], progress).then(() => undefined);
  }

  transcribe(model: SpeechModelId, audio: Float32Array, language: string) {
    return this.call({ type: "transcribe", model, audio, language }, [audio.buffer]);
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    for (const job of this.pending.values()) job.reject(new Error("ปิดโหมดเสียงแล้ว"));
    this.pending.clear();
  }
}

// Loading a model takes ~10 s, so the worker outlives a single voice-mode visit.
let shared: SpeechRecognizer | null = null;
export const sharedRecognizer = () => (shared ??= new SpeechRecognizer());

// transformers.js caches weights in Cache Storage under this name.
export async function isModelCached(repo: string) {
  try {
    const cache = await caches.open("transformers-cache");
    const keys = await cache.keys();
    return keys.some((request) => request.url.includes(`/${repo}/`) && /\.onnx$/.test(request.url));
  } catch {
    return false;
  }
}
