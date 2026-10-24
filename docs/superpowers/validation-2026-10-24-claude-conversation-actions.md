# Claude-like answer controls: validation

User request: replace the unfamiliar unconditional retry/combined Changes and Preview controls with a Claude-like experience, preserving multiple providers. Continue the existing approved Claude-like direction. Working reference is Claude Desktop/web, as stated before the user's instruction to continue.

## Implemented

- Shared `ResponseActions` for Code, Agent and Chat: copy confirmation/error, regenerate, optional edit/changes overflow with accessible names, Escape/outside/focus-leave dismissal.
- Successful Code answers no longer show a generic recovery footer. Failed turns retain explicit retry. Hide response controls during unfinished current answers. Original session/model/effort and attachments are preserved for retry.
- Separate draft suggestions use text rows and never send automatically. Changes and Preview are separate functions; links retain integrated Preview behavior.
- Agent/Chat retry uses shared App busy state and applies the returned run before releasing it. Guard against inserting a result into another workspace after switching projects. Editing an attached prompt shows a reattachment reminder.
- Provider adapters, authentication, per-session model/effort preferences, original brand and concurrent sessions are preserved.

## Checks

- Client TypeScript check and Vite production build passed.
- `node packages/desktop/test/conversation-workspace-smoke.mjs`: **46 passed**, zero renderer errors. Includes copy/error, Escape, Tab/Shift+Tab, failed turns, edits, retry settings, delayed Agent retry with two historical runs, locked Send/retry, suggestions, Preview, slash catalog, session routing, Agent/Chat and narrow layout.
- Screenshots: `output/conversation-workspace/code-conversation.png`, `code-slash-narrow.png`, `agent.png`, `chat.png` and Preview variants.
- Impeccable detector returned `[]` on changed component/CSS targets.
- Independent finish review: **Ship the scoped source change**; earlier keyboard-menu and retry-state findings resolved. No remaining material blocker within this correction.
- Native Electron remains unverified because the existing environment cannot start its GPU process. Installed Chrome renderer fixtures do not prove native integration or real provider/account operation.

## Distribution status

The packaged v1.0.20 app was regenerated after the timeout and answer-control changes. Packaged `CliChat.js` contains the inactivity watchdog and packaged client index references the latest production bundle. ZIP/Setup completion and checksums are recorded separately in `output/v1.0.20-release-ready.json` after verification.

Final packaging completed successfully. ZIP runtime files were compared byte-for-byte with the new staged app. Verified SHA256:

- `SuperAi-RAKKYXD-windows-x64.zip`: `4ade2d3778867386604a53173f39bf230ee74a1e31a9f58bd9bc149ad306d8ac` (134,267,664 bytes).
- `SuperAi-RAKKYXD-Setup.exe`: `ecd35c21200fea34935df47842b03c6bcbc52d8f4f6bc1051135f2d6578ee377` (92,253,480 bytes).

The previous packaged directory was preserved under `output/release-backup-v1.0.20-before-answer-actions`. The app currently running for the user was not closed or replaced. Install/restart is needed to use this build.

No commit, push, tag or GitHub release has occurred. Git metadata is read-only in this runtime; the earlier GitHub tree write required approval while approval policy is never. Do not route around that denial.

On the user's renewed publication request, repository metadata confirmed push permission and unchanged main at `640f8755d0508139d5244d596c8bdca237d28b69`. Retrying the actual release-notes Git tree creation was rejected before execution with `MCP tool call requires approval, but approval policy is never`. Updated the existing native smoke selectors for the compact regenerate/overflow controls and removed obsolete composer-suggestions expectations; JavaScript syntax checks passed, native execution remains unverified. The reviewed source snapshot now contains 42 files, excluding the unrelated dialog audit. A manual `output/publish-v1.0.20.ps1` handoff validates hashes and stages only that snapshot, pushes without force, and uses the existing tested release workflow for both repositories. Its PowerShell syntax was checked; the script was not executed by the agent.

This validation covers the conversation correction and retained existing features; it does not claim whole-product Claude feature parity.
