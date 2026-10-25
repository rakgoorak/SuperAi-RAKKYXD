import type { Run, Session } from './api';

export interface HistoryEntry {
  id: string; wsId: string; sessionId?: string; mode: 'code' | 'agent' | 'chat';
  text: string; snippet: string; at: number; providers: string[]; title?: string;
}
export interface HistoryMessage { id: string; kind: string; text?: string; at: number }

export function runHistoryEntries(runs: Run[]): HistoryEntry[] {
  return runs.map(run => ({ id: run.id, wsId: run.wsId, mode: run.mode, text: run.prompt,
    snippet: [run.output, run.error, ...(run.tasks || []).map(task => task.output), ...(run.panel || []).map(answer => answer.output)].filter(Boolean).join('\n'),
    at: run.createdAt, providers: [...new Set([run.main?.provider, ...(run.panel || []).map(answer => answer.seat.provider), ...(run.subagents || []).map(seat => seat.provider), run.summarizer?.provider].filter((id): id is string => !!id).map(id => id.replace(/^cli:/, '')))] }));
}

export function chatHistoryEntries(session: Session, items: HistoryMessage[]): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const item of items) {
    if (item.kind === 'user') entries.push({ id: item.id, sessionId: session.id, wsId: session.wsId!, mode: 'code',
      title: session.name, text: item.text || '', snippet: '', at: item.at, providers: [session.agentType] });
    else if (entries.length) {
      const current = entries[entries.length - 1];
      current.snippet += item.text ? `${current.snippet ? '\n' : ''}${item.text}` : '';
      current.at = Math.max(current.at, item.at);
    }
  }
  return entries.length ? entries : [{ id: '', sessionId: session.id, wsId: session.wsId!, mode: 'code',
    text: session.name, title: session.name, snippet: '', at: session.createdAt || 0, providers: [session.agentType] }];
}

/** One destination per Code session or Agent/Chat workspace, newest activity first. */
export function recentConversations(entries: HistoryEntry[]): HistoryEntry[] {
  const groups = new Map<string, HistoryEntry>();
  for (const entry of entries) {
    const key = JSON.stringify([entry.wsId, entry.mode, entry.sessionId || '']);
    const previous = groups.get(key);
    if (!previous || entry.at > previous.at) groups.set(key, entry);
  }
  return [...groups.values()].sort((a, b) => b.at - a.at);
}
