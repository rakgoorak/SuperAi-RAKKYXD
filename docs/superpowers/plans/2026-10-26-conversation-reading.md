# Conversation reading controls implementation plan

**Goal:** Add response style and return-to-latest controls without adding permanent visual clutter.
**Spec:** Approved scope in `output/claude-capability-audit-2026-10-26.md`.
**Architecture:** A shared normal/concise/explanatory style is saved per session or per workspace/mode. The server validates and applies it as prompt guidance; model/effort/permissions keep their current meaning. ChatView tracks distance from bottom and shows a compact jump control only while reading earlier content, without interrupting search or streaming.

- [x] Add shared style selector to folded composer options for Code, new chat, Agent and Chat; retain it across reload and retries.
- [x] Make style reach actual provider payloads and preserve readable history.
- [x] Add return-to-latest and new-message indication; keep manual history scroll intact and coordinate with the finder.
- [x] Run client/server/desktop builds, targeted unit/HTTP tests, a new browser usability suite and existing conversation regressions. Record evidence and packaging/live-provider limits.
