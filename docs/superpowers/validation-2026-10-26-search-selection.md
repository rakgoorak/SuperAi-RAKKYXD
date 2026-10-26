# Search, selection and message actions — validation

Implemented against the four user-provided Claude screenshots. The user approved the comparison and requested implementation. No additional dependencies, provider logins, live AI prompts, installer builds or changes to REA configuration were performed.

## Result

- Code chat sessions across the headless providers share a compact finder: Ctrl/Cmd+F, occurrence counts, previous/next with wrap, Enter/Shift+Enter, Escape and close. Native CSS highlights preserve React text nodes, ordinary selection and the surrounding conversation. Expanding/collapsing visible tool output and streaming text refresh the ranges.
- The selected-text toolbar offers Start a side chat and Reply. Reply appends the quote to the appropriate persisted draft instead of replacing its contents.
- Context menus offer Copy selection, Copy message as rendered text, Copy message as Markdown, Copy code when appropriate, Attach selection/message as context, Pin as chapter, and Fork from here. Overlays render through a portal so composer controls cannot cover them; position is clamped to the viewport. Menu keyboard navigation and Escape work, clipboard failures remain actionable.
- Attached message contexts have removable chips and survive reload. Ctrl/Cmd+Shift+L attaches the current selection. References are sent with the next user prompt and cleared only after an accepted send; menu actions do not send prompts.
- Chapters persist per session, can be removed and jump back to the recorded message. An unavailable/pruned message gives an explicit error.
- Fork creates a dormant session in the same workspace/folder, copies the retained transcript through the selected message, and keeps the source session. The server persists a transcript seed and injects it into the first independent CLI conversation. It never shares the source provider conversation ID or queue. A side chat inherits only the selected excerpt and opens a two-pane layout; other rooms are folded away and remain available.
- Chat/Terminal view buttons were reduced to accessible icon buttons to keep them separate from the finder.

## Checks

- Client production build (TypeScript + Vite): passed.
- Studio server TypeScript build: passed.
- Desktop JavaScript syntax build: passed; this is not a native Electron startup test.
- `conversation-interactions-smoke.mjs`: **37 checks passed**, zero renderer exceptions. Includes real DOM selection/right-click, rendered/source/code clipboard content, clipboard failure, context persistence/removal/keyboard attachment, actual send payload, chapter persistence/removal, menu geometry and hit testing at 760×650, session creation actions and one active Ctrl+F handler in split view.
- Existing `conversation-workspace-smoke.mjs`: **125 checks passed**, zero renderer exceptions. Only its finder selector/open/close sequence changed to match the new interaction.
- Existing `provider-conversation-smoke.mjs`: **37 checks passed**, zero renderer exceptions.
- `conversation-fork.test.ts` + `cli-chat.test.ts`: **19 tests passed**. New tests verify transcript boundary, source isolation, no provider ID reuse, persisted seed across a new manager, no process on fork creation, first-send injection, independent conversation resume, selected-only context, size rejection, missing-message rejection, and the HTTP dormant session route.
- Provider conversation, chat controls and chat settings tests: **12 tests passed**.
- `git diff --check`: passed.
- Visually inspected generated desktop finder/selection and narrow context-menu screenshots. Two observed layering bugs (view-switch overlap and composer above menu) and a rendered-text clipboard bug were corrected and covered by browser checks.

## Evidence and limits

Screenshots and deterministic browser test results are in `output/conversation-interactions/`. These use mocked API/WebSocket fixtures; they do not prove that a live provider account accepts every request. Server tests exercise real local HTTP endpoints with a fake CLI process where applicable.

REA's Claude ASAR analysis was rejected by client approval policy during the preceding review, before an Evidence ID was produced. No bypass was attempted. This work reproduces the screenshot controls and defines their behavior locally; it is not a claim of identical Claude internals.

Fork replay uses the transcript retained by this app (currently at most 400 items), not a provider-native fork API or hidden provider state. Transcript seeds longer than 12,000 characters are refused with an instruction to select a shorter excerpt for a side chat; the existing combined prompt limit is 20,000 characters. Historical image pixels and private provider reasoning are not reconstructed. Tool output search covers expanded/visible content. Chapters and pending contexts are local profile storage, not cloud sync.

The new interaction is scoped to Code's structured chat view; terminal-only providers retain terminal selection. Native startup and packaged executable testing were not repeated, and no installer was produced in this change. Restart the development app to load the new server route as well as the renderer.
