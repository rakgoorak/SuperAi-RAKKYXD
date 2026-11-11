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
  deepseek: "DeepSeek",
  groq: "Groq",
  openrouter: "OpenRouter",
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
  antigravity: ["low", "medium", "high"],
  opencode: ["minimal", "low", "medium", "high", "max"],
};

/** API providers connected with the user's own key (Settings > API Key). */
export const CLOUD = ["openrouter", "deepseek", "groq"];
export const isCloud = (provider: string) => CLOUD.includes(provider);
export interface CloudKeyStatus { id: string; name: string; hasKey: boolean; source: "settings" | "env" | null; keyPage: string; hint?: string }
const CLOUD_EVENT = "superai:cloud-keys-changed";
export function notifyCloudKeysChanged() {
  for (const id of CLOUD) {
    for (const key of cache.keys()) if (key.startsWith(`${id}:`)) { cache.delete(key); fetchedAt.delete(key); }
  }
  window.dispatchEvent(new Event(CLOUD_EVENT));
}
/** Which API providers have a key; refreshed when a key is saved or removed. */
export function useCloudKeys() {
  const [keys, setKeys] = useState<CloudKeyStatus[]>([]);
  useEffect(() => {
    let live = true;
    const load = () => void api<CloudKeyStatus[]>("/api/cloud-keys").then((k) => live && setKeys(k)).catch(() => {});
    load();
    window.addEventListener(CLOUD_EVENT, load);
    return () => { live = false; window.removeEventListener(CLOUD_EVENT, load); };
  }, []);
  return keys;
}

export function providerName(provider: string) {
  if (provider.startsWith("cli:")) return PROVIDER_LABEL[provider.slice(4)] || provider.slice(4);
  if (PROVIDER_LABEL[provider]) return PROVIDER_LABEL[provider];
  return `Ollama · ${provider}`;
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
const fetchedAt = new Map<string, number>();
const pending = new Set<string>();
export function fetchModels(id: string, refresh = false, accountId?: string) {
  const key = `${id}:${accountId || ""}`;
  if (!pending.has(key) && (refresh || !cache.has(key) || Date.now() - (fetchedAt.get(key) || 0) > 60_000)) {
    pending.add(key);
    const request = api<ModelList>(`/api/providers/${id}/models${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`);
    request.then(() => { fetchedAt.set(key, Date.now()); pending.delete(key); }, () => { pending.delete(key); cache.delete(key); });
    if (refresh) request.then(() => window.dispatchEvent(new CustomEvent("superai:models-refreshed", { detail: key })), () => {});
    cache.set(key, request);
  }
  return cache.get(key)!;
}
export function useModels(id: string, accountId?: string) {
  const key = `${id}:${accountId || ""}`;
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<ModelList | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const refreshed = (event: Event) => { if ((event as CustomEvent<string>).detail === key) setRevision((n) => n + 1); };
    window.addEventListener("superai:models-refreshed", refreshed);
    return () => window.removeEventListener("superai:models-refreshed", refreshed);
  }, [key]);
  useEffect(() => {
    if (!id) return setList(null);
    let ignore = false;
    setList(null);
    setError("");
    fetchModels(id, false, accountId)
      .then((value) => !ignore && setList(value))
      .catch((e) => !ignore && setError((e as Error).message));
    return () => {
      ignore = true;
    };
  }, [id, accountId, revision]);
  const refresh = () => {
    if (id) void fetchModels(id, true, accountId).then(() => setError(''), e => setError((e as Error).message));
  };
  return { list, error, refresh };
}
