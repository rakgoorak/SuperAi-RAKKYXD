/**
 * Per-session chat choices made in the bottom composer (model, effort, picked skill) and the
 * session's account state, so the composer's send can use them for whichever session it targets.
 */
import type { ResponseStyle } from './responseStyle';
import { tr } from './i18n';
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
}

export type ChatPermission = 'read' | 'edit' | 'auto' | 'review' | 'full' | 'ask' | 'approve_all';
const PERMISSION_VALUES = new Set<ChatPermission>(['read', 'edit', 'auto', 'review', 'full', 'ask', 'approve_all']);

/**
 * The choices the composer offers: the same three or four for every AI, most careful first. The
 * provider-specific modes behind them (Codex "review", "edit" without commands) are no longer
 * offered; a session that saved one falls back to "auto".
 */
export function permissionChoices(agent: string): { value: ChatPermission; label: string; hint: string }[] {
  const asks = ['claude-code', 'codex', 'opencode'].includes(agent);
  const full: ChatPermission | null = agent === 'claude-code' || agent === 'codex' ? 'full' : agent === 'opencode' || agent === 'antigravity' ? 'approve_all' : null;
  return [
    { value: 'read', label: tr("อ่านอย่างเดียว"), hint: tr("อ่านและวางแผนได้ ไม่แก้ไฟล์และไม่รันคำสั่ง") },
    ...(asks ? [{ value: 'ask' as const, label: tr("ถามก่อนทำ"), hint: tr("ขออนุญาตในแชตก่อนแก้ไฟล์หรือรันคำสั่งทุกครั้ง") }] : []),
    { value: 'auto', label: tr("ทำเองอัตโนมัติ"), hint: tr("แก้ไฟล์และรันคำสั่งในโฟลเดอร์โปรเจกต์ได้เอง (แนะนำ)") },
    ...(full ? [{ value: full, label: tr("เต็มสิทธิ์"), hint: tr("ไม่ถามและไม่จำกัดเฉพาะโฟลเดอร์โปรเจกต์ ใช้เมื่อไว้ใจงานนี้เท่านั้น") }] : []),
  ];
}
const isPermission = (value: unknown): value is ChatPermission => typeof value === 'string' && PERMISSION_VALUES.has(value as ChatPermission);

const prefs = new Map<string, ChatPrefs>();
const choices = new Set<string>();
const EMPTY: ChatPrefs = { model: '', effort: '', skillId: '', blocked: false, note: '', permission: 'auto', responseStyle: 'normal', includeProjectContext: true };

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
        prefs.set(sessionId, { ...EMPTY, model: saved.model, effort: saved.effort, permission: isPermission(saved.permission) ? saved.permission : 'auto', responseStyle: ['normal', 'concise', 'explanatory'].includes(saved.responseStyle) ? saved.responseStyle : 'normal', includeProjectContext: saved.includeProjectContext !== false });
        choices.add(sessionId);
      }
    } catch {}
  }
  return prefs.get(sessionId) || EMPTY;
}

export function setChatPrefs(sessionId: string, patch: Partial<ChatPrefs>) {
  if ("model" in patch || "effort" in patch) choices.add(sessionId);
  prefs.set(sessionId, { ...chatPrefs(sessionId), ...patch });
  if ("model" in patch || "effort" in patch || "permission" in patch || 'responseStyle' in patch || 'includeProjectContext' in patch) {
    try { const value = prefs.get(sessionId)!; localStorage.setItem(`superai-chat-prefs:${sessionId}`, JSON.stringify({ model: value.model, effort: value.effort, permission: value.permission, responseStyle: value.responseStyle, includeProjectContext: value.includeProjectContext })); } catch {}
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
