# Conversation search and selection implementation plan

**Goal:** Implement the search, selection toolbar and message menu shown in the user's four Claude screenshots.
**Spec:** `output/claude-search-selection-review-2026-10-26.md`, approved by the user with “ปรับให้เหมือนด้วยครับ”.
**Architecture:** A focused conversation interaction component owns DOM ranges, highlights, selection and menus. ChatView retains rendering and streaming. Forks use independent dormant sessions and persist a transcript seed instead of sharing a provider conversation ID. No prompt is sent on menu actions.
**Tech stack:** React, TypeScript, CSS Custom Highlight API, Express, existing CLI chat persistence; no new dependencies.

- [x] Add conversation finder with non-destructive occurrence highlighting, active result, arrows, Ctrl/Cmd+F, Enter/Shift+Enter and Escape. Activate shortcuts only for the focused visible pane.
- [x] Add selection toolbar and contextual Copy/Copy message/Copy Markdown/Copy code, Reply, Attach as context, chapters and fork actions. Scope selectable text to message bodies, keep selection when opening menus, clamp overlays to the viewport, restore keyboard focus and report clipboard/storage failures.
- [x] Append quoted context to the appropriate persistent composer draft without overwriting existing text. Add removable persisted chapters with jump links.
- [x] Add server fork route and manager transcript seed. Copy only history through the selected message, never share the source conversation ID, persist seed across restart and inject it on the first independent provider conversation. Reject excessive context rather than silently truncate. Side chat uses only the selected text and opens a second pane.
- [x] Verify source/destination isolation, seed persistence and first-send context with a fake CLI process. Verify browser search, clipboard, selection, keyboard, chapters, draft preservation and fork routes with deterministic fixtures. Build client/server/desktop and run the existing conversation regression suite.

Native Claude runtime analysis remains unavailable because REA approval was denied. Screenshot appearance and labels guide the design; implementation behavior is explicitly ours.
