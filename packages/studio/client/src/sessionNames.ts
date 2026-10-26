import type { Session } from './api';
export function sessionAliases(): Record<string, string> {
  try { const data: unknown = JSON.parse(localStorage.getItem('superai-pane-names') || '{}'); return data && typeof data === 'object' && !Array.isArray(data) ? Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === 'string' && value.trim())) : {}; }
  catch { return {}; }
}
/** Old local aliases remain visible consistently until the user explicitly saves a canonical name. */
export function namedSessions(sessions: Session[]): Session[] {
  const aliases = sessionAliases(); return sessions.map(session => aliases[session.id] ? { ...session, name: aliases[session.id] } : session);
}
