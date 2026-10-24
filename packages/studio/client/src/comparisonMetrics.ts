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
  const count = estimateTokenCount(answer);
  return count > 0 ? `${count.toLocaleString()} tokens` : "—";
}
