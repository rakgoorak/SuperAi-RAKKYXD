// Grey "next message" suggestion in the composer after a chat turn finishes; Tab puts it in the input.
import { api } from "./api";

export interface NextPromptSettings { ai: boolean }
const KEY = "superai-next-prompt";
const EVENT = "superai:next-prompt";

export function loadNextPromptSettings(): NextPromptSettings {
  try { return { ai: true, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ai: true }; }
}
export function saveNextPromptSettings(settings: NextPromptSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}

/** Publishes (or clears, with "") the suggestion for one chat session. */
export const publishNextPrompt = (sessionId: string, text: string) =>
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { sessionId, text } }));

export function onNextPrompt(callback: (sessionId: string, text: string) => void) {
  const handler = (event: Event) => { const { sessionId, text } = (event as CustomEvent<{ sessionId: string; text: string }>).detail; callback(sessionId, text); };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Whether a chat is answering, for the composer's send/stop button. */
export const publishChatRunning = (sessionId: string, running: boolean) =>
  window.dispatchEvent(new CustomEvent("superai:chat-running", { detail: { sessionId, running } }));
export function onChatRunning(callback: (sessionId: string, running: boolean) => void) {
  const handler = (event: Event) => { const { sessionId, running } = (event as CustomEvent<{ sessionId: string; running: boolean }>).detail; callback(sessionId, running); };
  window.addEventListener("superai:chat-running", handler);
  return () => window.removeEventListener("superai:chat-running", handler);
}

/** Asks a small model (Claude Haiku, or the session's CLI at low effort) to guess the next message. */
export async function predictNextPrompt(sessionId: string, signal: AbortSignal): Promise<string> {
  const reply = await api<{ text: string }>(`/api/terminals/${sessionId}/chat/next-prompt`, { method: "POST", body: "{}", signal });
  return reply.text || "";
}
