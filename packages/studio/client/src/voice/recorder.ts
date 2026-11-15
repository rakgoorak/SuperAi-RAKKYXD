import { tr } from '../i18n';
// Microphone capture at 16 kHz with energy-based end-of-utterance detection.
export interface UtteranceOptions {
  deviceId?: string;
  silenceMs?: number;
  maxMs?: number;
  onLevel?: (level: number) => void;
  onSpeechStart?: () => void;
}

export class Microphone {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private finish: ((audio: Float32Array | null) => void) | null = null;
  private flush: (() => void) | null = null;

  async open(deviceId?: string) {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error(tr("อุปกรณ์นี้ไม่รองรับไมโครโฟน"));
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { exact: deviceId } : undefined, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      const name = (error as DOMException).name;
      throw new Error(
        name === "NotAllowedError" ? tr("ไม่ได้รับสิทธิ์ใช้ไมโครโฟน กรุณาอนุญาตในการตั้งค่าความเป็นส่วนตัวของระบบ")
          : name === "NotFoundError" || name === "OverconstrainedError" ? tr("ไม่พบไมโครโฟน กรุณาเสียบไมค์หรือเลือกอุปกรณ์ใหม่")
          : tr`เปิดไมโครโฟนไม่ได้: ${(error as Error).message}`,
      );
    }
    this.context = new AudioContext({ sampleRate: 16000 });
    this.source = this.context.createMediaStreamSource(this.stream);
  }

  // Resolves with audio after the speaker pauses, or null if cancelled / nothing said.
  listen(options: UtteranceOptions = {}): Promise<Float32Array | null> {
    if (!this.context || !this.source) return Promise.reject(new Error(tr("ยังไม่ได้เปิดไมโครโฟน")));
    this.stopListening();
    const { silenceMs = 1100, maxMs = 28000, onLevel, onSpeechStart } = options;
    const context = this.context;
    void context.resume();
    const chunks: Float32Array[] = [];
    const preroll: Float32Array[] = [];
    let noise = 0.01, speaking = false, speechMs = 0, quietMs = 0, totalMs = 0;
    const processor = context.createScriptProcessor(2048, 1, 1);
    this.processor = processor;
    return new Promise((resolve) => {
      this.finish = (audio) => { this.stopListening(); resolve(audio); };
      this.flush = () => this.finish?.(speaking && chunks.length ? join(chunks) : null);
      processor.onaudioprocess = (event) => {
        const input = new Float32Array(event.inputBuffer.getChannelData(0));
        const ms = (input.length / context.sampleRate) * 1000;
        let sum = 0;
        for (const sample of input) sum += sample * sample;
        const rms = Math.sqrt(sum / input.length);
        onLevel?.(Math.min(1, rms * 12));
        const threshold = Math.max(0.012, noise * 2.8);
        if (!speaking) {
          noise = noise * 0.95 + rms * 0.05;
          preroll.push(input);
          if (preroll.length > 4) preroll.shift();
          if (rms > threshold) {
            speechMs += ms;
            if (speechMs > 120) { speaking = true; chunks.push(...preroll); onSpeechStart?.(); }
          } else speechMs = 0;
          return;
        }
        chunks.push(input);
        totalMs += ms;
        quietMs = rms > threshold ? 0 : quietMs + ms;
        if (quietMs >= silenceMs || totalMs >= maxMs) this.finish?.(join(chunks));
      };
      this.source!.connect(processor);
      processor.connect(context.destination);
    });
  }

  // Ends the current utterance now (tap to send).
  submit() { this.flush?.(); }
  cancel() { this.finish?.(null); }

  private stopListening() {
    if (!this.processor) return;
    this.processor.onaudioprocess = null;
    try { this.source?.disconnect(this.processor); this.processor.disconnect(); } catch {}
    this.processor = null;
    this.finish = null;
    this.flush = null;
  }

  close() {
    this.cancel();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close().catch(() => {});
    this.stream = null; this.context = null; this.source = null;
  }
}

function join(chunks: Float32Array[]) {
  const audio = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) { audio.set(chunk, offset); offset += chunk.length; }
  return audio;
}
