/**
 * Per-session chat choices made in the bottom composer (model, effort, picked skill) and the
 * session's account state, so the composer's send can use them for whichever session it targets.
 */
import type { ResponseStyle } from './responseStyle';
export interface ChatPrefs {
  responseStyle: ResponseStyle;
  includeProjectContext: boolean;
  model: string;
  effort: string;
  /** Skill picked from /skills; only used while the draft still starts with "/skill ". */
  skillId: string;
  /** Not signed in or not installed: sending would fail. */
  blocked: boolean;
  note: string;
  /** What the CLI may do on its own: read only, edit files, or edit and run commands. */
  permission: ChatPermission;
  /** Ask all open questions (as a choice card) before starting any work. */
  askFirst: boolean;
}

export type ChatPermission = 'read' | 'edit' | 'auto' | 'review' | 'full' | 'ask' | 'approve_all';
export const PERMISSION_LABEL: Record<ChatPermission, string> = { read: 'อ่านอย่างเดียว', edit: 'แก้ไฟล์ได้', auto: 'อัตโนมัติ', review: 'Approve for me', full: 'Full access', ask: 'Ask for approval', approve_all: 'อนุมัติเครื่องมืออัตโนมัติ' };
const isPermission = (value: unknown): value is ChatPermission => typeof value === 'string' && Object.prototype.hasOwnProperty.call(PERMISSION_LABEL, value);

const prefs = new Map<string, ChatPrefs>();
const choices = new Set<string>();
const EMPTY: ChatPrefs = { model: '', effort: '', skillId: '', blocked: false, note: '', permission: 'auto', responseStyle: 'normal', includeProjectContext: true, askFirst: false };

export function hasChatPrefs(sessionId: string): boolean { chatPrefs(sessionId); return choices.has(sessionId); }

const listeners = new Map<string, Set<() => void>>();
export function subscribeChatPrefs(sessionId: string, listener: () => void): () => void {
  const group = listeners.get(sessionId) || new Set<() => void>();
  group.add(listener); listeners.set(sessionId, group);
  return () => { group.delete(listener); if (!group.size) listeners.delete(sessionId); };
}

export function chatPrefs(sessionId: string): ChatPrefs {
  if (!prefs.has(sessionId)) {
    try {
      const saved = JSON.parse(localStorage.getItem(`superai-chat-prefs:${sessionId}`) || 'null');
      if (saved && typeof saved.model === 'string' && typeof saved.effort === 'string') {
        prefs.set(sessionId, { ...EMPTY, model: saved.model, effort: saved.effort, permission: isPermission(saved.permission) ? saved.permission : 'auto', responseStyle: ['normal', 'concise', 'explanatory'].includes(saved.responseStyle) ? saved.responseStyle : 'normal', includeProjectContext: saved.includeProjectContext !== false, askFirst: saved.askFirst === true });
        choices.add(sessionId);
      }
    } catch {}
  }
  return prefs.get(sessionId) || EMPTY;
}

export function setChatPrefs(sessionId: string, patch: Partial<ChatPrefs>) {
  if ("model" in patch || "effort" in patch) choices.add(sessionId);
  prefs.set(sessionId, { ...chatPrefs(sessionId), ...patch });
  if ("model" in patch || "effort" in patch || "permission" in patch || 'responseStyle' in patch || 'includeProjectContext' in patch || 'askFirst' in patch) {
    try { const value = prefs.get(sessionId)!; localStorage.setItem(`superai-chat-prefs:${sessionId}`, JSON.stringify({ model: value.model, effort: value.effort, permission: value.permission, responseStyle: value.responseStyle, includeProjectContext: value.includeProjectContext, askFirst: value.askFirst })); } catch {}
  }
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
