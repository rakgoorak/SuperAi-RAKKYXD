# Composer layout validation — 2026-10-27

The user's Claude reference is implemented as one writing surface and one metadata footer at normal desktop widths. Folder, branch and permission align left; provider, model, effort and options align right. The recipient selector is outside the writing field. Long session names no longer become placeholders. Context, pinning and expansion remain available through plus. Pending attachments and selected-message context remain visible above the draft.

The idle desktop writing box measures 780 × 54 px; the whole lower composer measures 111 px high in the 1440 × 900 fixture. At 1024 × 768 with Preview open, metadata wraps into two complete rows while typing, microphone and send stay together. Code, Chat and Agent share the same field layout. Stop appears while a chat runs; the plus menu also retains an explicit stop action.

## Validation

- `npm.cmd run build --workspace=@superai-rakkyxd/client`: TypeScript and production build passed.
- `node packages/desktop/test/composer-balanced-smoke.mjs`: 23 checks passed.
- `node packages/desktop/test/composer-location-smoke.mjs`: 24 checks passed.
- `node packages/desktop/test/provider-conversation-smoke.mjs`: 37 checks passed.
- `node packages/desktop/test/project-usability-smoke.mjs`: 27 checks passed.
- `node packages/desktop/test/conversation-interactions-smoke.mjs`: 37 checks passed.
- `node packages/desktop/test/conversation-workspace-smoke.mjs`: 125 checks passed.
- `git diff --check`: passed.

Browser fixtures use mocked HTTP and WebSocket responses and do not invoke AI providers. Existing tests were adjusted for intentionally folded context, display-contents wrappers and recipient hints moving from the placeholder to the recipient control. No send, permission or provider protocol changed.

Visual review caught and corrected legacy rules that moved narrow-screen actions onto another row, placed team Send beside the placeholder, and exposed an unavailable Stop action. Empty context wrappers no longer add blank top padding. The options popup has a trailing-edge fallback before its measured position is applied.

Screenshots reviewed: `output/composer-balanced/desktop.png`, `laptop.png`, `preview.png`, `team-chat.png`. Results: `output/composer-balanced/results.json` and the individual regression output directories.

This validates the built renderer and fixtures. Native Electron startup, real microphone capture and authenticated provider execution were not tested in this change. No installer was generated or installed, and the user's running desktop application was not restarted.
