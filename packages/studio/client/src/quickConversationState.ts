import type { Session } from './api';

export interface PendingQuickConversation { session: Session; wsId: string; accountSelection?: string }
interface QuickConversationState { aliases: Record<string, string>; pending?: PendingQuickConversation }
const KEY = 'superai-pending-conversation-v1';

/** Keep first-send recovery beside the existing persisted drafts, without storing file contents. */
export function loadQuickConversationState(): QuickConversationState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    const aliases = saved?.aliases && typeof saved.aliases === 'object' && !Array.isArray(saved.aliases)
      ? Object.fromEntries(Object.entries(saved.aliases).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {};
    const pending = saved?.pending;
    if (typeof pending?.wsId === 'string' && typeof pending.session?.id === 'string'
      && typeof pending.session.agentType === 'string' && typeof pending.session.name === 'string'
      && typeof pending.session.cwd === 'string' && pending.session.wsId === pending.wsId) return { aliases, pending };
    return { aliases };
  } catch { return { aliases: {} }; }
}

export function saveQuickConversationState(aliases: Map<string, string>, pending?: PendingQuickConversation) {
  try {
    if (!aliases.size && !pending) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ aliases: Object.fromEntries(aliases), pending }));
  } catch { /* Recovery still works in memory when local storage is unavailable. */ }
}
