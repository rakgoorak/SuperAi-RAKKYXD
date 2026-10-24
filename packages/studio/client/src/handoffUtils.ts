export interface HandoffOptions {
  agentName?: string;
  text?: string;
  nextInstruction?: string;
  instruction?: string;
}

export interface FilterTargetsOptions {
  currentSessionId?: string;
  workspaceId?: string;
  activeOnly?: boolean;
}

export interface HandoffPayload {
  sessionId: string;
  text: string;
  mode: 'code' | 'agent';
  expand: boolean;
}

export interface QuickHandoffTarget {
  id?: string;
  name: string;
  agentType: string;
  label: string;
  existing: boolean;
}

/**
 * Formats a transition handoff prompt string from one agent's output to another.
 *
 * Supports both signatures:
 * 1) formatHandoffPrompt(agentName: string, text: string, instruction?: string): string
 * 2) formatHandoffPrompt(options: HandoffOptions): string
 */
export function formatHandoffPrompt(
  agentName: string,
  text: string,
  instruction?: string
): string;
export function formatHandoffPrompt(options: HandoffOptions): string;
export function formatHandoffPrompt(
  agentNameOrOptions: string | HandoffOptions,
  text?: string,
  instruction?: string
): string {
  let agentName = '';
  let content = '';
  let nextInstruction = '';

  if (typeof agentNameOrOptions === 'object' && agentNameOrOptions !== null) {
    agentName = agentNameOrOptions.agentName || 'AI';
    content = agentNameOrOptions.text || '';
    nextInstruction =
      agentNameOrOptions.nextInstruction ?? agentNameOrOptions.instruction ?? '';
  } else {
    agentName = agentNameOrOptions || 'AI';
    content = text || '';
    nextInstruction = instruction || '';
  }

  const cleanName = agentName.trim() || 'AI';
  const cleanContent = content.trim();
  const cleanNext = nextInstruction.trim();

  const nextSection = cleanNext
    ? `ช่วยดำเนินการขั้นถัดไป: ${cleanNext}`
    : 'ช่วยดำเนินการขั้นถัดไป: ';

  return `จากข้อสรุป / ผลลัพธ์ของ ${cleanName}:\n\n${cleanContent}\n\n${nextSection}`;
}

/**
 * Filters available sessions to eligible handoff targets.
 * Excludes the current session, and optionally filters by workspace and active status.
 */
export function filterHandoffTargets<
  T extends { id: string; wsId?: string; status?: string; view?: string; agentType?: string }
>(
  sessions: T[],
  options?: FilterTargetsOptions
): T[] {
  const currentId = options?.currentSessionId;
  const wsId = options?.workspaceId;
  const activeOnly = options?.activeOnly ?? false;

  return sessions.filter((s) => {
    // Exclude current session
    if (currentId && s.id === currentId) return false;

    // Filter by workspace if specified
    if (wsId && s.wsId && s.wsId !== wsId) return false;

    // Filter active only if requested
    if (activeOnly) {
      const isRunning = s.status === 'running' || s.view === 'chat' || s.status !== 'exited';
      if (!isRunning) return false;
    }

    return true;
  });
}

/**
 * Formats a user-friendly label for a session in the handoff target menu.
 */
export function formatSessionLabel(session: {
  name: string;
  agentType?: string;
  view?: string;
}): string {
  const type = session.agentType ? `${session.agentType} · ` : '';
  const viewKind = session.view === 'chat' ? 'แชต' : 'Terminal';
  return `${session.name} (${type}${viewKind})`;
}

/**
 * Builds the event payload for superai:prepare-composer and superai:prepare-message.
 */
export function buildHandoffPayload(
  targetSessionId: string,
  text: string,
  options?: { mode?: 'code' | 'agent'; expand?: boolean }
): HandoffPayload {
  return {
    sessionId: targetSessionId,
    text,
    mode: options?.mode || 'code',
    expand: options?.expand ?? true,
  };
}

/**
 * Dispatches the handoff events to switch active session and pre-populate the composer.
 */
export function dispatchHandoff(
  targetSessionId: string,
  text: string,
  options?: { mode?: 'code' | 'agent'; expand?: boolean }
): HandoffPayload {
  const payload = buildHandoffPayload(targetSessionId, text, options);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('superai:prepare-composer', { detail: payload })
    );
    window.dispatchEvent(
      new CustomEvent('superai:prepare-message', { detail: payload })
    );
  }

  return payload;
}

/**
 * Prepares quick handoff targets for common AI providers (Codex, Claude Code, Antigravity, OpenCode).
 * If a matching session already exists in targetSessions, it binds to that session's ID.
 */
export function getQuickAgentTargets(
  availableSessions: Array<{ id: string; name: string; agentType?: string }>
): QuickHandoffTarget[] {
  const knownAgents = [
    { agentType: 'codex', name: 'Codex' },
    { agentType: 'claude-code', name: 'Claude Code' },
    { agentType: 'antigravity', name: 'Antigravity' },
    { agentType: 'opencode', name: 'OpenCode' },
  ];

  return knownAgents.map((agent) => {
    const match = availableSessions.find(
      (s) =>
        s.agentType?.toLowerCase() === agent.agentType.toLowerCase() ||
        s.name.toLowerCase().includes(agent.agentType.toLowerCase()) ||
        s.name.toLowerCase().includes(agent.name.toLowerCase())
    );

    if (match) {
      return {
        id: match.id,
        name: match.name,
        agentType: agent.agentType,
        label: `ส่งต่อให้ ${match.name}`,
        existing: true,
      };
    }

    return {
      name: agent.name,
      agentType: agent.agentType,
      label: `ส่งต่อให้ ${agent.name}`,
      existing: false,
    };
  });
}
