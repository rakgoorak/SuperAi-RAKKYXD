import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatHandoffPrompt,
  filterHandoffTargets,
  formatSessionLabel,
  buildHandoffPayload,
  dispatchHandoff,
  getQuickAgentTargets,
} from '../client/src/handoffUtils.js';

test('formatHandoffPrompt: formats with positional arguments', () => {
  const result = formatHandoffPrompt(
    'Claude Code',
    'function solve() { return 42; }',
    'ช่วยเขียน unit test ให้ด้วย'
  );

  const expected =
    'จากข้อสรุป / ผลลัพธ์ของ Claude Code:\n\n' +
    'function solve() { return 42; }\n\n' +
    'ช่วยดำเนินการขั้นถัดไป: ช่วยเขียน unit test ให้ด้วย';

  assert.equal(result, expected);
});

test('formatHandoffPrompt: formats without instruction, leaving prompt open for typing', () => {
  const result = formatHandoffPrompt('Codex', 'API schema defined successfully.');

  const expected =
    'จากข้อสรุป / ผลลัพธ์ของ Codex:\n\n' +
    'API schema defined successfully.\n\n' +
    'ช่วยดำเนินการขั้นถัดไป: ';

  assert.equal(result, expected);
});

test('formatHandoffPrompt: formats with object options (nextInstruction)', () => {
  const result = formatHandoffPrompt({
    agentName: 'Antigravity',
    text: 'export const config = { port: 8080 };',
    nextInstruction: 'ช่วยทำ deploy script ต่อ',
  });

  const expected =
    'จากข้อสรุป / ผลลัพธ์ของ Antigravity:\n\n' +
    'export const config = { port: 8080 };\n\n' +
    'ช่วยดำเนินการขั้นถัดไป: ช่วยทำ deploy script ต่อ';

  assert.equal(result, expected);
});

test('formatHandoffPrompt: formats with object options (instruction alias)', () => {
  const result = formatHandoffPrompt({
    agentName: 'OpenCode',
    text: 'Refactored database queries.',
    instruction: 'ตรวจสอบ performance',
  });

  const expected =
    'จากข้อสรุป / ผลลัพธ์ของ OpenCode:\n\n' +
    'Refactored database queries.\n\n' +
    'ช่วยดำเนินการขั้นถัดไป: ตรวจสอบ performance';

  assert.equal(result, expected);
});

test('formatHandoffPrompt: handles edge cases (empty or missing agentName, text, whitespace)', () => {
  // Empty agentName falls back to 'AI'
  const fallback = formatHandoffPrompt('', 'Some text', 'ต่อ');
  assert.equal(
    fallback,
    'จากข้อสรุป / ผลลัพธ์ของ AI:\n\nSome text\n\nช่วยดำเนินการขั้นถัดไป: ต่อ'
  );

  // Trims unnecessary leading/trailing whitespace
  const trimmed = formatHandoffPrompt('  Claude  ', '  \nline 1\nline 2\n  ', '  เริ่มทำเลย  ');
  assert.equal(
    trimmed,
    'จากข้อสรุป / ผลลัพธ์ของ Claude:\n\nline 1\nline 2\n\nช่วยดำเนินการขั้นถัดไป: เริ่มทำเลย'
  );

  // Empty text and empty instruction
  const empty = formatHandoffPrompt('', '');
  assert.equal(
    empty,
    'จากข้อสรุป / ผลลัพธ์ของ AI:\n\n\n\nช่วยดำเนินการขั้นถัดไป: '
  );
});

test('filterHandoffTargets: excludes the current session', () => {
  const mockSessions = [
    { id: 's-1', name: 'Claude Code 1', wsId: 'ws-a', status: 'running', view: 'chat' },
    { id: 's-2', name: 'Codex 2', wsId: 'ws-a', status: 'running', view: 'chat' },
    { id: 's-3', name: 'Antigravity 3', wsId: 'ws-b', status: 'running', view: 'terminal' },
  ];

  const targets = filterHandoffTargets(mockSessions, { currentSessionId: 's-1' });
  assert.equal(targets.length, 2);
  assert.ok(!targets.some((s) => s.id === 's-1'));
  assert.ok(targets.some((s) => s.id === 's-2'));
  assert.ok(targets.some((s) => s.id === 's-3'));
});

test('filterHandoffTargets: filters by workspaceId when supplied', () => {
  const mockSessions = [
    { id: 's-1', name: 'Claude Code 1', wsId: 'ws-a', status: 'running', view: 'chat' },
    { id: 's-2', name: 'Codex 2', wsId: 'ws-a', status: 'running', view: 'chat' },
    { id: 's-3', name: 'Antigravity 3', wsId: 'ws-b', status: 'running', view: 'terminal' },
  ];

  const targets = filterHandoffTargets(mockSessions, {
    currentSessionId: 's-1',
    workspaceId: 'ws-a',
  });
  assert.equal(targets.length, 1);
  assert.equal(targets[0].id, 's-2');
});

test('filterHandoffTargets: filters activeOnly sessions', () => {
  const mockSessions = [
    { id: 's-1', name: 'Active Chat', status: 'running', view: 'chat' },
    { id: 's-2', name: 'Saved Chat', status: 'exited', view: 'chat' }, // chat views remain interactive
    { id: 's-3', name: 'Exited Terminal', status: 'exited', view: 'terminal' },
  ];

  const targets = filterHandoffTargets(mockSessions, { activeOnly: true });
  assert.equal(targets.length, 2);
  assert.ok(targets.some((s) => s.id === 's-1'));
  assert.ok(targets.some((s) => s.id === 's-2'));
  assert.ok(!targets.some((s) => s.id === 's-3'));
});

test('formatSessionLabel: formats labels for chat and terminal sessions', () => {
  const chatSession = {
    name: 'Backend Dev',
    agentType: 'claude-code',
    view: 'chat',
  };
  assert.equal(formatSessionLabel(chatSession), 'Backend Dev (claude-code · แชต)');

  const terminalSession = {
    name: 'Build Tool',
    agentType: 'antigravity',
    view: 'terminal',
  };
  assert.equal(formatSessionLabel(terminalSession), 'Build Tool (antigravity · Terminal)');

  const simpleSession = {
    name: 'Shell',
    view: 'terminal',
  };
  assert.equal(formatSessionLabel(simpleSession), 'Shell (Terminal)');
});

test('buildHandoffPayload: constructs payload with default and custom options', () => {
  const defaultPayload = buildHandoffPayload('s-target', 'handoff prompt text');
  assert.deepEqual(defaultPayload, {
    sessionId: 's-target',
    text: 'handoff prompt text',
    mode: 'code',
    expand: true,
  });

  const customPayload = buildHandoffPayload('s-target', 'agent prompt', {
    mode: 'agent',
    expand: false,
  });
  assert.deepEqual(customPayload, {
    sessionId: 's-target',
    text: 'agent prompt',
    mode: 'agent',
    expand: false,
  });
});

test('dispatchHandoff: dispatches custom events in browser environment', () => {
  const eventsDispatched: Array<{ type: string; detail: any }> = [];

  // Mock window and CustomEvent in Node environment
  const originalWindow = (globalThis as any).window;
  (globalThis as any).CustomEvent = class MockCustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
  (globalThis as any).window = {
    dispatchEvent(event: any) {
      eventsDispatched.push({ type: event.type, detail: event.detail });
      return true;
    },
  };

  try {
    const payload = dispatchHandoff('target-123', 'handoff message');
    assert.equal(payload.sessionId, 'target-123');
    assert.equal(payload.text, 'handoff message');
    assert.equal(eventsDispatched.length, 2);
    assert.equal(eventsDispatched[0].type, 'superai:prepare-composer');
    assert.equal(eventsDispatched[0].detail.sessionId, 'target-123');
    assert.equal(eventsDispatched[1].type, 'superai:prepare-message');
    assert.equal(eventsDispatched[1].detail.sessionId, 'target-123');
  } finally {
    (globalThis as any).window = originalWindow;
    delete (globalThis as any).CustomEvent;
  }
});

test('getQuickAgentTargets: identifies existing sessions and provides presets for others', () => {
  const availableSessions = [
    { id: 'sess-codex', name: 'Codex Main', agentType: 'codex' },
    { id: 'sess-claude', name: 'Claude Code 1', agentType: 'claude-code' },
  ];

  const quickTargets = getQuickAgentTargets(availableSessions);

  assert.equal(quickTargets.length, 4);

  const codexTarget = quickTargets.find((t) => t.agentType === 'codex');
  assert.ok(codexTarget);
  assert.equal(codexTarget.existing, true);
  assert.equal(codexTarget.id, 'sess-codex');
  assert.equal(codexTarget.label, 'ส่งต่อให้ Codex Main');

  const claudeTarget = quickTargets.find((t) => t.agentType === 'claude-code');
  assert.ok(claudeTarget);
  assert.equal(claudeTarget.existing, true);
  assert.equal(claudeTarget.id, 'sess-claude');

  const antigravityTarget = quickTargets.find((t) => t.agentType === 'antigravity');
  assert.ok(antigravityTarget);
  assert.equal(antigravityTarget.existing, false);
  assert.equal(antigravityTarget.label, 'ส่งต่อให้ Antigravity');
});
