# Provider conversation validation — 2026-10-25

Implemented the user-approved review in the current working tree. Existing edits to ChatView, Markdown, minimal-workspace.css and previewLinks were retained. No installer was packaged and no release was published.

## Result

- `npm.cmd --workspace=@superai-rakkyxd/client run build` — passed, TypeScript and Vite production output.
- `npm.cmd --workspace=@superai-rakkyxd/studio run build` — passed.
- `tsx --test packages/studio/test/provider-conversation.test.ts packages/studio/test/chat-controls.test.ts packages/studio/test/chat-settings.test.ts` — 12 passed.
- `node packages/desktop/test/provider-conversation-smoke.mjs` — 25 checks passed, zero renderer errors.
- `node packages/desktop/test/conversation-workspace-smoke.mjs` — 125 checks passed, zero renderer errors.
- `node packages/desktop/test/beginner-experience-smoke.mjs` — 29 checks passed, zero renderer errors.

Total: 191 unit/integration tests and browser assertions across these focused suites. The existing conversation and beginner suites also cover unchanged behavior such as per-room drafts, broadcast, Agent/Chat teams, images, answer controls and setup.

## New behavior exercised

- First message without a manually created project/session; app-owned general workspace is idempotent and does not replace existing projects.
- Saved model/effort, read-only initial permission, and attachments reach the intended provider.
- Failed first send keeps its draft and pending files; retry reuses the just-created room.
- Repeated Enter during a pending first send creates one room and one request.
- The unsent first-message text and pending room recover after reload. Pending file objects remain in memory, matching the existing attachment behavior.
- Explicitly deleting a pending room clears stale recovery metadata while keeping its unsent draft; retry creates a usable room.
- Provider identity remains visible independently of room titles; Codex's editing/command permission explanation is explicit.
- Recent history groups turns by destination; full-text search finds earlier messages; provider filtering and reopening hidden rooms work.
- New Preview/layout defaults preserve existing saved preferences.
- Setup offers general chat without a user-folder selection.
- Desktop 1440×900 and narrow laptop 1024×768 screenshots were inspected; document overflow is checked at the narrow width.

## Evidence

- `output/provider-conversation/results.json`
- `output/provider-conversation/new-conversation-desktop.png`
- `output/provider-conversation/conversation-desktop.png`
- `output/provider-conversation/new-conversation-narrow.png`
- `output/provider-conversation/history-narrow.png`
- `output/conversation-workspace/results.json`
- `output/beginner-experience/results.json`

Screenshots and browser checks use deterministic HTTP/WebSocket fixtures. They establish rendering and interaction behavior, not live provider availability, account login, CLI execution, or exact visual parity with installed Claude/ChatGPT applications. No provider requests, installs or quota-consuming work were performed by these browser checks.
