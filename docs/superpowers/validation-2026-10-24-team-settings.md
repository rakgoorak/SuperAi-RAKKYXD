# Agent and Chat team settings validation

Implemented the approved design in the working tree. Both modes now expose a compact summary and team settings button in the conversation heading. Team configuration opens in a right-side native modal drawer instead of inline in the message history. Removed duplicate Chat model controls from the composer.

Pending team edits remain separate from the active configuration. Save writes storage before publishing the new team; Cancel, close, Escape, mode changes, and workspace changes discard pending edits. Storage failure keeps edits visible for retry. Existing workspace storage keys and saved teams are retained. Agent execution permissions remain beside the composer.

## Results

- `npm.cmd --workspace=@superai-rakkyxd/client run build`: passed (TypeScript and Vite).
- `node packages/desktop/test/conversation-workspace-smoke.mjs`: 116 checks passed, no renderer errors. Includes 27 new checks beyond the previous 89-check suite.
- `git diff --check`: passed; Git emits existing line-ending normalization notices.
- Inspected Agent and Chat desktop and 390px-wide screenshots. Drawer actions remain below the 53px native title bar; the body scrolls independently of the fixed header and footer.

Coverage includes provider/model/effort persistence, save versus cancel, retry after storage failure, workspace and mode separation, closing on external scope changes, member minimum/maximum limits, Chat summary controls, Escape inside a model list, modal focus containment/restoration, and read-only configuration during an active run. Existing draft, attachment, preview, answer action, and session recipient checks also pass. One existing fixture assertion was made to wait for React to render after an external draft event instead of reading immediately after event dispatch.

## Evidence

- `output/conversation-workspace/results.json`
- `output/conversation-workspace/agent-team-desktop.png`
- `output/conversation-workspace/chat-team-desktop.png`
- `output/conversation-workspace/agent-team-narrow.png`
- `output/conversation-workspace/chat-team-narrow.png`
- `output/conversation-workspace/agent.png` and `chat.png`: conversation surfaces without inline configuration.

The fixtures use Chromium with deterministic API responses and do not call AI providers. Native Electron browser-layer suppression is wired to the modal lifecycle but was not exercised in an actual Electron window in this validation. No running user application was terminated. These changes have not been packaged or released in this task. Unrelated concurrent edits were preserved.
