import type { StepStatus } from './api';

/** Active work wins; terminal outcomes must never look queued. */
export function agentCardState(tasks: readonly { status: StepStatus }[]): StepStatus | 'idle' {
  if (!tasks.length) return 'idle';
  for (const status of ['running', 'failed', 'pending', 'cancelled', 'skipped'] as const) {
    if (tasks.some(task => task.status === status)) return status;
  }
  return 'completed';
}
