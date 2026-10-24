import { useEffect, useState } from "react";
import { api, type Cli, type ModelList, type Seat } from "./api";

/** CLIs that can answer without a terminal; Freebuff only works in Code mode. */
export const HEADLESS = ["claude-code", "codex", "antigravity", "opencode"];
export const PROVIDER_LABEL: Record<string, string> = {
  "claude-code": "Claude",
  codex: "ChatGPT (Codex)",
  antigravity: "Antigravity",
  opencode: "OpenCode",
  freebuff: "Freebuff",
  terminal: "Terminal",
};
export const EFFORT_LABEL: Record<string, string> = {
  minimal: "น้อยที่สุด",
  low: "ต่ำ",
  medium: "กลาง",
  high: "สูง",
  xhigh: "สูงมาก",
  max: "สูงสุด",
  ultra: "อัลตรา",
};

/** Effort levels each CLI accepts; shown while the live model list is still loading. */
export const EFFORTS: Record<string, string[]> = {
  "claude-code": ["low", "medium", "high", "xhigh", "max"],
  codex: ["low", "medium", "high", "xhigh", "max", "ultra"],
  antigravity: ["low", "medium", "high", "xhigh", "max"],
  opencode: ["minimal", "low", "medium", "high", "max"],
};

export function providerName(provider: string) {
  return provider.startsWith("cli:") ? PROVIDER_LABEL[provider.slice(4)] || provider.slice(4) : `Ollama · ${provider}`;
}
export function seatSummary(seat: Seat) {
  return [providerName(seat.provider), seat.model || (seat.provider.startsWith("cli:") ? "รุ่นเริ่มต้น" : ""), seat.effort && `effort ${EFFORT_LABEL[seat.effort] || seat.effort}`]
    .filter(Boolean)
    .join(" · ");
}

export type ProviderDefaults = Record<string, { model: string; effort: string }>;
const DEFAULTS_KEY = "superai-provider-defaults-v1";
export function loadDefaults(): ProviderDefaults {
  try {
    const value = JSON.parse(localStorage.getItem(DEFAULTS_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
export function saveDefaults(value: ProviderDefaults) {
  try {
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(value));
  } catch {}
}
const CONFIRMED_KEY = "superai-defaults-confirmed";
/** True once the user has looked at (or accepted) default model/effort in setup or settings. */
export function defaultsConfirmed() {
  try {
    return localStorage.getItem(CONFIRMED_KEY) === "1";
  } catch {
    return false;
  }
}
export function confirmDefaults() {
  try {
    localStorage.setItem(CONFIRMED_KEY, "1");
  } catch {}
}

/** A seat for a CLI using the model/effort chosen in setup. */
export function seatFor(cliId: string, name: string, defaults = loadDefaults()): Seat {
  const d = defaults[cliId] || { model: "", effort: "" };
  return { name, provider: `cli:${cliId}`, model: d.model, effort: d.effort };
}
/** First installed headless CLI, preferring the order the user is most likely to want. */
export function firstReady(clis: Cli[], skip: string[] = []) {
  const ready = HEADLESS.filter((id) => clis.some((c) => c.id === id && c.available));
  return ready.find((id) => !skip.includes(id)) || ready[0] || "";
}

const cache = new Map<string, Promise<ModelList>>();
export function fetchModels(id: string, refresh = false) {
  if (refresh || !cache.has(id)) {
    const request = api<ModelList>(`/api/providers/${id}/models`);
    if (refresh) request.then(() => window.dispatchEvent(new CustomEvent("superai:models-refreshed", { detail: id })), () => {});
    request.catch(() => cache.delete(id));
    cache.set(id, request);
  }
  return cache.get(id)!;
}
export function useModels(id: string) {
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<ModelList | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const refreshed = (event: Event) => { if ((event as CustomEvent<string>).detail === id) setRevision((n) => n + 1); };
    window.addEventListener("superai:models-refreshed", refreshed);
    return () => window.removeEventListener("superai:models-refreshed", refreshed);
  }, [id]);
  useEffect(() => {
    if (!id) return setList(null);
    let ignore = false;
    setList(null);
    setError("");
    fetchModels(id)
      .then((value) => !ignore && setList(value))
      .catch((e) => !ignore && setError((e as Error).message));
    return () => {
      ignore = true;
    };
  }, [id, revision]);
  return { list, error };
}
