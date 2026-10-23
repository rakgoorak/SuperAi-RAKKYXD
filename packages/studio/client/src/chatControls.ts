/**
 * Per-session chat choices made in the bottom composer (model, effort, picked skill) and the
 * session's account state, so the composer's send can use them for whichever session it targets.
 */
export interface ChatPrefs {
  model: string;
  effort: string;
  /** Skill picked from /skills; only used while the draft still starts with "/skill ". */
  skillId: string;
  /** Not signed in or not installed: sending would fail. */
  blocked: boolean;
  note: string;
}

const prefs = new Map<string, ChatPrefs>();
const choices = new Set<string>();
const EMPTY: ChatPrefs = { model: '', effort: '', skillId: '', blocked: false, note: '' };

export function hasChatPrefs(sessionId: string): boolean { return choices.has(sessionId); }

const listeners = new Map<string, Set<() => void>>();
export function subscribeChatPrefs(sessionId: string, listener: () => void): () => void {
  const group = listeners.get(sessionId) || new Set<() => void>();
  group.add(listener); listeners.set(sessionId, group);
  return () => { group.delete(listener); if (!group.size) listeners.delete(sessionId); };
}

export function chatPrefs(sessionId: string): ChatPrefs {
  return prefs.get(sessionId) || EMPTY;
}

export function setChatPrefs(sessionId: string, patch: Partial<ChatPrefs>) {
  if ("model" in patch || "effort" in patch) choices.add(sessionId);
  prefs.set(sessionId, { ...chatPrefs(sessionId), ...patch });
  listeners.get(sessionId)?.forEach(listener => listener());
}

/** Composer commands handled by the session's controls: open the skills list or sign in. */
export type ChatCommand = 'skills' | 'login';
const EVENT = 'superai:chat-command';

export function sendChatCommand(sessionId: string, command: ChatCommand) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { sessionId, command } }));
}

export function onChatCommand(listener: (sessionId: string, command: ChatCommand) => void): () => void {
  const handle = (event: Event) => {
    const { sessionId, command } = (event as CustomEvent<{ sessionId: string; command: ChatCommand }>).detail;
    listener(sessionId, command);
  };
  window.addEventListener(EVENT, handle);
  return () => window.removeEventListener(EVENT, handle);
}
