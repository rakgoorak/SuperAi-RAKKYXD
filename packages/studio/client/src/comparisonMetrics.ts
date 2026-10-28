import type { PanelAnswer } from "./api.js";

export function formatLatency(answer: PanelAnswer): string {
  if (answer.startedAt && answer.completedAt) {
    const diff = (answer.completedAt - answer.startedAt) / 1000;
    return `${Math.max(0.1, diff).toFixed(1)}s`;
  }
  if (answer.startedAt && answer.status === "running") {
    const diff = (Date.now() - answer.startedAt) / 1000;
    return `${Math.max(0.1, diff).toFixed(1)}s`;
  }
  return "—";
}

export function formatTtft(answer: PanelAnswer): string {
  if (answer.startedAt && answer.firstChunkAt) {
    const diff = Math.max(0, answer.firstChunkAt - answer.startedAt) / 1000;
    return `${diff.toFixed(1)}s`;
  }
  return "—";
}

export function estimateTokenCount(answer: PanelAnswer): number {
  if (typeof answer.tokenCount === "number" && answer.tokenCount > 0) {
    return answer.tokenCount;
  }
  if (answer.output) {
    return Math.max(1, Math.ceil(answer.output.length / 4));
  }
  return 0;
}

export function formatTokens(answer: PanelAnswer): string {
  return answer.status === "completed" ? "ไม่มีข้อมูล token จริง" : "—";
}

export function formatArenaError(error: string): string {
  if (!error) return "";
  let clean = error.trim();
  clean = clean.replace(/^(?:cli:[a-z0-9-_]+|[a-z0-9-_]+):\s*(?:error:\s*)?/i, "");
  if (/RESOURCE_EXHAUSTED|Individual quota reached/i.test(clean)) {
    const resetMatch = clean.match(/Resets in ([0-9a-zA-Z\s]+?)(?:\.|$|,)/i);
    const resetInfo = resetMatch ? ` (รีเซ็ตใน ${resetMatch[1].trim()})` : "";
    return `โควตาการใช้งานเต็มแล้ว${resetInfo} กรุณารอหรือสลับไปใช้โมเดลอื่น`;
  }
  if (/Unexpected server error/i.test(clean)) {
    return "เซิร์ฟเวอร์ของผู้ให้บริการมีปัญหาชั่วคราว (Unexpected server error) กรุณาลองใหม่อีกครั้งหรือสลับโมเดล";
  }
  return clean;
}
