# Quiet CLI / Subagent handling

The user approved replacing the ten-minute inactivity kill with a warning and explicit actions. Implemented for Code chat CLI turns in `CliChatManager` and `ChatView`.

## Behavior

- After process output begins, ten minutes without stdout or stderr produces a transient `activity.quiet` warning. It does not kill the CLI, fail its unfinished tools, release turn ownership, or send queued messages.
- “รอต่อ” calls the originating session's `/chat/wait` endpoint, clears the warning, and rearms the warning deadline. It does not resend the prompt or spawn another process.
- Incoming stdout/stderr clears the warning. Reconnecting receives the current warning in the chat snapshot. Completion/cancellation removes transient activity rather than persisting a warning in history.
- “หยุดงาน” retains explicit process cancellation and pauses queued follow-ups. Startup silence retains the existing 90-second termination guard.
- “ดูไฟล์ที่เปลี่ยน” opens existing changes inspection. A headless chat process is separate from the Terminal process; this action avoids suggesting that opening Terminal can attach to the current headless process.
- Older persisted inactivity errors are labeled “รอบก่อนถูกหยุด” when a later user turn exists. The current indicator says “รอข้อมูล” while the warning is present.

## Experiment ledger

1. Existing five timeout tests passed and demonstrated that tool silence previously killed the process.
2. Changed expectations and added wait/manual-stop tests before implementation. The focused run failed three cases: silence killed the process, no quiet state existed, and no wait API existed.
3. Implemented the warning, transient snapshot state, wait route and controls. Focused timeout tests passed.
4. Broader cancellation tests exposed an incomplete fake child process without a `kill` method; the fixture now supplies that method. The combined suite passed 29 tests, including a simulated Antigravity Task with prolonged silence.
5. Renderer fixtures initially lost their synthetic quiet state when the changes dialog caused a reconnect. The fixture now retains the same snapshot state as the real manager. This verifies returning to the current warning and stopping the correct session.

## Final validation

- Studio TypeScript build: passed.
- Client TypeScript / Vite production build: passed.
- `node --import tsx --test packages/studio/test/cli-chat-timeout.test.ts packages/studio/test/cli-chat.test.ts packages/studio/test/chat-settings.test.ts`: 29 passed.
- `node packages/desktop/test/conversation-workspace-smoke.mjs`: 123 passed, no renderer errors.
- `git diff --check`: passed, with Git line-ending normalization notices only.
- Inspected `output/conversation-workspace/quiet-work-warning.png` and `quiet-work-warning-narrow.png` at 1440px and 1000px widths. Warning copy and all three actions fit.

These tests use fake processes, virtual timers and Chromium API/WebSocket fixtures; they do not call paid providers or stop any real user job. Real CLI child-process liveness cannot be inferred solely from silence: a genuinely stuck process now requires explicit Stop after the warning. No native packaged Electron release was built in this task. Unrelated concurrent work was preserved.
