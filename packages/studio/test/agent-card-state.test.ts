import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agentCardState } from '../client/src/agentCardState.js';
import type { StepStatus } from '../client/src/api.js';
const tasks = (...states: StepStatus[]) => states.map(status => ({ status }));
for (const [states, expected] of [
  [['cancelled'], 'cancelled'], [['skipped'], 'skipped'],
  [['completed', 'cancelled'], 'cancelled'], [['completed', 'skipped'], 'skipped'],
  [['failed', 'skipped'], 'failed'], [['running', 'failed'], 'running'],
  [['pending', 'completed'], 'pending'], [['completed'], 'completed'], [[], 'idle'],
] as [StepStatus[], string][]) {
  test(`agent card reflects ${states.join(',') || 'unassigned'} tasks`, () => {
    assert.equal(agentCardState(tasks(...states)), expected);
  });
}
