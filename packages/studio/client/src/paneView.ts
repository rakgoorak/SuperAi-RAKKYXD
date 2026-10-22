/** CLIs whose Code sessions can be shown as a chat (they stream JSON events headless). */
export const CHAT_CLIS = ['claude-code', 'codex', 'antigravity', 'opencode'];
export type PaneView = 'chat' | 'terminal';

/** The server keeps each session's view, so it survives restarts and both views share one conversation. */
export function paneView(session: { agentType?: string; view?: PaneView }): PaneView {
  return session.view === 'chat' && CHAT_CLIS.includes(session.agentType || '') ? 'chat' : 'terminal';
}
