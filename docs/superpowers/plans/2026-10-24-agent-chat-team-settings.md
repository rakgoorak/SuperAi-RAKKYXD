# Agent and Chat Team Settings Implementation Plan

**Goal:** Move team configuration out of conversations into a shared transactional drawer.
**Architecture:** Each workspace editor owns its committed team and separate draft. Share the modal lifecycle through ConfigShell, with compact summaries in the canvas heading.
**Tech Stack:** React, TypeScript, existing CSS tokens, native HTML dialog, Playwright fixtures.
**Spec:** `docs/superpowers/specs/2026-10-24-agent-chat-team-settings-design.md` (approved).

## Constraints

- Preserve providers, models, effort, member limits, summarizer behavior, isolated drafts, and execution permissions.
- Keep the established visual system and modal actions below the 53px native title bar.
- No paid provider calls. Preserve unrelated changes. Execute inline in this session.

## Tasks

- [x] Add `components/useTeamDraft.ts` to publish committed values, stage edits, and save storage before applying changes.
- [x] Replace `components/ConfigShell.tsx` with compact summary and native modal drawer; style in `team-settings.css` with fixed header/footer and scrolling body.
- [x] Adapt `AgentPanel.tsx` and `ChatPanel.tsx` to transactional editing, role sections and account guidance. Preserve active-run locking.
- [x] Move editors into the App heading, removing duplicate Chat quick model selection. Preserve permissions and Skills.
- [x] Suspend native browser preview while team settings are open.
- [x] Extend renderer fixtures for saved/canceled edits, storage failure, limits, summarizer, scope isolation, keyboard/focus and active-run locking.
- [x] Build, run renderer checks, inspect desktop/narrow screenshots together, and check whitespace. Fix concrete defects together; confirm at most once more.

## Validation

```powershell
npm.cmd --workspace=@superai-rakkyxd/client run build
node packages/desktop/test/conversation-workspace-smoke.mjs
git diff --check
```
