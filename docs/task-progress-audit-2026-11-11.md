# Task progress audit — 2026-11-11

The ERP conversation shows one checklist (`t5-todos`) with its first task in progress and four pending tasks, alongside later edits and test commands. The recorded turn contains 40 edit-tool calls, including 30 calls targeting `Test\style.css`. These are calls, not 40 distinct edited files. The saved transcript cannot prove whether the agent omitted further updates or an upstream event was lost; it also does not prove the ERP acceptance criteria passed.

## Confirmed implementation issues

- Tool summaries counted calls but labelled them as numbers of files.
- Checklist cards did not distinguish the last agent report from subsequent work.
- Updating a checklist preserved its creation timestamp, preventing a reliable last-update indication.
- OpenCode task writes were accepted even when the tool reported an error. Empty task arrays were ignored, retaining obsolete lists.
- Outgoing turns did not explicitly request task reconciliation.

## Changes

Tool summaries now describe calls. Checklist cards report later activity within their own user turn without changing any task status. Accepted task updates refresh their timestamp in place. OpenCode task changes are accepted only after successful completion; empty arrays clear the card. Every outgoing turn asks the agent to update its native task list at task transitions and reconcile before the final response, using acceptance checks rather than call counts.

This improves reporting and instructs the agent; it cannot guarantee that a model follows the instruction or validate task semantics automatically. Existing session files and ERP source files were not rewritten. Already running requests retain their original prompts; the reminder applies on the next turn after the updated server starts.

## Verification

- Added failing regressions for rejected task writes, empty lists and missing reconciliation instructions, then verified them passing.
- Chat/parser/task-progress/questions/timeout/Codex approval/OpenCode approval tests: 39 passed.
- Server TypeScript build and client TypeScript/Vite build passed.
- Full studio suite did not finish after attachment tests; stopped the test runner. No claim of a complete suite pass.
- No live application screenshot verification was performed.

The previous checklist test covered successful nonempty task lists only. It did not cover failed writes, clearing, timestamps or the difference between activity and completion.
