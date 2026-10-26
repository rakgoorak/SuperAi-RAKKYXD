# Project context, organization and reading controls — validation

The user approved all three improvement groups from `output/claude-capability-audit-2026-10-26.md`. Changes were made in the existing workspace without reverting the earlier search/selection work.

## Delivered behavior

- **Project context:** Code chat, every comparison participant and summarizer, and Agent planner/workers/final reviewer receive a server-built snapshot of the workspace instructions, rule files and pinned text files. User questions remain separate from context in stored chat/run history. Chat request records and team runs retain their context snapshot and response style. A new request/retry reads current files; queued requests keep the snapshot taken when queued.
- **File status:** The composer shows ready/missing/unsupported/oversized/outside-root/budget statuses in a disclosure with explicit refresh. Long lists scroll inside a bounded panel. Preview explains that files are read again at Send. The pin inspector and actual prompt builder now share real-path validation and text decoding.
- **Favorites:** A project can be starred/unstarred from its existing menu. Favorites sort first and have a sidebar filter. The flag persists in WorkspaceRegistry; the empty filter explains how to add favorites.
- **Session names:** Rename is available from chat chrome, tabs and grid headings. The canonical name is saved in session/restart metadata and is used by sidebar, tabs, history, command search and exports. Old local aliases are projected consistently across client session lists until explicitly renamed; explicit rename removes the local alias.
- **Export:** Each Code chat and each Agent/Chat workspace view offers Markdown or JSON download. Markdown retains user/assistant content, code/tool outputs and task lists; team exports include individual answers, task results, final output and errors. JSON includes the retained structured data with schema version and export time. Filenames are sanitized, object URLs revoked, API failures remain visible and no export is uploaded.
- **Response style:** Normal/concise/explanatory is available in folded composer controls. Code stores it per session; new-chat defaults and workspace/mode styles persist locally. First messages, later sends, comparison answers/summaries and Agent final reports receive the selected guidance. Style is separate from model/effort/permissions and is not applied to the Agent planner's JSON protocol. As with any prompt guidance, providers may vary in adherence.
- **Return to latest:** Reading earlier Code chat messages stops automatic following. A compact button returns to the end, indicates new output and resumes following. It stays hidden during find-in-conversation. Snapshot/running-state changes alone do not count as a new message.
- **Disclosure robustness:** Composer Escape handling no longer depends on the asynchronous native details toggle event, fixing an observed timing failure under concurrent browser tests.

## Verification

- Client TypeScript + production Vite build: passed.
- Studio server TypeScript build: passed.
- Desktop JavaScript syntax build: passed.
- `project-usability-smoke.mjs`: **27 checks passed**, zero renderer exceptions. Real browser downloads were read and verified, including original Markdown, structured JSON and separate team answers. Covers context errors/retry/long lists, favorites, failed rename/retry, consistent names after reload, all three work modes and quick-start style payloads, scrolling/search interactions and laptop layout.
- `conversation-interactions-smoke.mjs`: **37 checks passed**, zero renderer exceptions, on the final built renderer.
- Existing `conversation-workspace-smoke.mjs`: **125 checks passed**, zero renderer exceptions.
- Existing `provider-conversation-smoke.mjs`: **37 checks passed**, zero renderer exceptions. One initial concurrent run exposed the disclosure timing failure; it was corrected and the suite passed again.
- Targeted unit/HTTP/provider regression command across project-usability, cli-chat, chat-settings, project-rules, session-persist, provider-conversation, conversation-fork, chat-controls, file-explorer and conversation suites: **54 tests passed**.
- `git diff --check`: passed.
- Visually inspected `output/project-usability/options-laptop.png`, context/reading screenshots and the rename error/retry state. Browser fixtures use deterministic mocked API/WebSocket data; provider-payload tests use fake providers/processes and actual local HTTP routes where applicable.

## Boundaries

- Text context is bounded to 12,000 characters, with 64 KiB maximum per file and at most 100 pinned paths. Omitted files have explicit statuses; instructions that exceed the context budget reject the request. The existing 20,000-character total Code CLI prompt limit still applies, including fork transcript seeds and context. Unsupported binary/image/PDF pins are not converted into text by this feature; the separate attachment flow remains available.
- File validation checks both relative-path containment and resolved real paths, including junction escapes. No external service or AI request is made by context preview.
- Context/style apply to structured AI chat and team execution, not arbitrary text typed directly into provider terminals. Response style, queued context, exports and provider behavior were not exercised against live paid AI accounts.
- JSON export is retained application data, not a complete backup of provider-native histories, uploaded file bytes, hidden model state or account configuration.
- No new dependencies, REA configuration changes, installer, release upload or native Electron startup test were performed. The existing native-startup uncertainty from earlier work is not resolved by these renderer tests. A development app restart is needed for the new server routes; packaged installations require a newly built distribution.
- REA remains unavailable in the session. This implementation follows the approved evidence-backed local audit; it is not a claim of reverse engineering Claude internals.
