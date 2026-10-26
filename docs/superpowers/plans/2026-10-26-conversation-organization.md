# Conversation organization implementation plan

**Goal:** Add persistent favorite projects, conversation export and consistent session names.
**Spec:** Approved scope in `output/claude-capability-audit-2026-10-26.md`.
**Architecture:** Favorites live in WorkspaceRegistry. A session-name endpoint updates the canonical session and restart metadata; the client updates shared session state. A reusable export control downloads Markdown or JSON from the selected structured conversation or team history without loading executable code or uploading data.

- [x] Extend workspace types/registry/update validation with favorite. Add favorite action/filter and stable favorite-first ordering.
- [x] Add canonical session rename route; replace local-only name edits and expose rename in tabs as well as grids. Preserve old local aliases until explicitly migrated/renamed.
- [x] Add `conversationExport.ts` plus accessible export disclosure; include team answers and original user messages, label tool output and retain raw text in JSON. Use safe filenames and revoke object URLs.
- [x] Verify registry reload, canonical name persistence, export contents and real browser download, then continue to reading controls.
