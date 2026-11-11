# Chat responsiveness — 2026-11-11

Scope: the graphical conversation inside Terminal mode, as shown in the user's screenshot.

## Changes

- Coalesce successive complete item snapshots over a 16 ms window. Within a batch, retain the latest version of each item and preserve first-seen order. Merge into history once per batch.
- Flush immediately for permission requests, questions, errors, turn-state changes and disconnects. Discard pending events on a replacement snapshot or session cleanup.
- Memoize Markdown rendering and grouped tool rows so elapsed-time updates do not reparse unchanged answers. Cache grouping while the item collection remains unchanged.
- Stop the elapsed-time timer for inactive panes. Detect updated output through collection identity rather than serializing potentially large tool output.
- Describe the observed working/waiting state beside the elapsed time.

This reduces application rendering work. It does not accelerate provider inference or create token streaming when the provider only supplies complete messages. The 16 ms timer is a scheduling target, not a latency guarantee under load or browser throttling.

## Validation

- Client TypeScript and Vite production build passed.
- Related batch/parser/questions/task-progress tests: 31 passed.
- Batch regression: 1,000 versions of one item plus another item schedule a single delivery with correct final values. Lifecycle tests cover flushing and discarding obsolete pending updates.
- Browser smoke `node packages/desktop/test/conversation-workspace-smoke.mjs --stream-only`: passed all five checks, including a 500-update burst, one final answer, an editable composer, visible work status and no renderer errors.
- Broader browser checks passed conversation drafts, attachments, preview, answer actions, slash selection, recipient targeting and quiet-work controls, then failed at `cancel restores the saved Chat summarizer` in team configuration. The complete browser suite is not reported as passing.
- Screenshots were inspected using deterministic fixtures. No live provider throughput or before/after end-to-end latency benchmark was performed.

Build artifacts are local. No installer/release package was produced, and the user's running conversation was not restarted.
