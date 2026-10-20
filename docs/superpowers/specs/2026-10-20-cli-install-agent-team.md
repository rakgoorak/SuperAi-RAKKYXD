# CLI installation and configurable Agent teams

Status: user approved sequential leader/team execution in chat on 2026-10-20.

## User request
Add real install buttons for missing CLI tools in New Session, and let Agent mode choose a leader and teammates/models. Leader plans, delegates, receives results and summarizes for the user. Retain Thai, own brand, Windows/macOS and existing sessions.

## New Session installation
Each CLI row shows installed/not found/installing/failed. Missing AI CLIs have an explicit Install action separate from selecting the row; installed ones have Open / login through their own CLI. Terminal is supplied by the OS and has no fake installer. Show fixed package/source, Node prerequisite, progress/log, cancel and retry, followed by a fresh executable check. No arbitrary package names or shell input from the renderer. Use official npm packages in a per-user managed prefix: @anthropic-ai/claude-code, @openai/codex, @google/gemini-cli, opencode-ai, freebuff. Claude's officially supported npm route installs its native binary. Node.js 22+ / npm is a prerequisite; when missing, show a working official Node download link and recheck. Do not install anything during authoring/testing except an isolated verified fixture unless the user clicks Install.

Installer manager owns one job at a time and validates CLI identifiers before spawn. Read-only status polling, cancellation, bounded output, timeout and process-tree cleanup. Reject conflicting installation while that CLI is in use so installed binaries are not replaced under live sessions. Add managed-prefix bin paths to discovery and child PATH; do not alter global shell profiles or require administrator access. Installation complete means exit0 plus verified executable availability, not successful account login.

## Agent team editor
One leader and one to three enabled teammates with roles Coder / Tester / Reviewer. Each seat has a display name, installed CLI or local Ollama provider, and optional model override. Initial defaults use the currently selected provider; preserve existing chat mode behavior. Unsupported headless CLI adapters must remain clearly unavailable for team selection, with a reason; interactive terminal installation support must not imply headless/team support. Discover OpenCode/Ollama models where available; other CLI model overrides use vendor-supported flags, with vendor defaults selectable.

Preferred execution: sequential tasks in the leader's plan, avoiding same-worktree concurrent edits. Alternative requested from user: concurrency only for analysis/read-only work; file edits stay sequential. No external accounts, automatic schedules, or hidden quota purchases. Freebuff remains capped at one managed session and must not be added as a headless provider without a verified protocol and shared reservation.

## Team orchestration
Leader provider plans and summarizes with read-only permission. Create each enabled specialist with its own provider. Validate plan assignments against enabled roles, bounded task counts and real instructions. Pass accumulated colleague results to subsequent tasks, and all outputs/statuses to leader synthesis. A failed/cancelled task must not be reported as a successful overall run. Show actual stage, current owner, task status and expandable outputs/errors; persist the team snapshot with the run. Cancellation aborts current task and prevents further workers/synthesis. A successful summary still reports any individual failures accurately. Settings changes do not rewrite the team of a running or historic task.

## Files / responsibilities
- CliCatalog: official install metadata, headless capability, managed bin discovery.
- CliInstallManager: whitelisted per-user install jobs; API routes in StudioServer.
- SupervisorAgent: optional per-role providers and enabled role list; validated plans / full result synthesis.
- AgentRunManager: team schema validation, provider factory, snapshots and structured progress.
- CliProvider: validated per-seat model overrides for supported CLIs.
- Dedicated React CLI installer and TeamEditor / TeamProgress components, preserving existing session canvas and chat.

## Verification
Installer tests use fake child processes/isolated fixture package: unknown IDs, duplicate jobs, missing prerequisites, successful install+discovery, nonzero exit, cancellation and timeout; no global installation or login changes. Team tests prove different models receive their own assignments, leader receives real results, only enabled roles run, invalid plans/config fail before execution, read-only head cannot edit, cancellation stops remaining work, and state survives reload. Electron test install/progress UI with fixture responses, team editor persistence, task timeline and outputs. Keep existing desktop / release checks; rebuild and publish a new private GitHub release for Windows/macOS only after checks pass, consistent with the user's existing release workflow.

## Official sources checked 2026-10-20
- https://code.claude.com/docs/en/setup#install-with-npm
- https://developers.openai.com/codex/cli/
- https://geminicli.com/docs/get-started/installation/
- https://geminicli.com/docs/cli/headless/
- https://opencode.ai/docs/
- https://freebuff.com/
