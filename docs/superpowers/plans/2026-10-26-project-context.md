# Project context implementation plan

**Goal:** Make the project instructions and pinned files advertised in the UI reach every structured AI request.
**Spec:** `output/claude-capability-audit-2026-10-26.md`, approved by the user on 2026-10-26.
**Architecture:** A bounded context builder validates real paths, snapshots textual contents and records file statuses. Server routes supply this snapshot to CLI chat and all Agent/Chat participants without changing stored user prompts. A compact preview exposes what is ready for the next send. Provider-managed terminal input remains terminal input.
**Constraints:** No new dependency, no external uploads on preview, no CLI process started by tests, no silent reading outside the selected project root, no hidden growth beyond the existing CLI prompt limit.

- [x] Add `server/ProjectContext.ts`, shared response-style contract and meaningful file/budget/isolation tests.
- [x] Wire context into `StudioServer.ts`, `CliChat.ts`, `AgentRunManager.ts`; persist the context snapshot with requests/runs. Inject into every participant and final summary, keeping planner protocol separate from response style.
- [x] Add a disclosure to the composer listing ready/omitted files. Read errors and budget omissions remain visible.
- [x] Build and verify with fake provider/HTTP tests, then continue to the organization and reading plans.
