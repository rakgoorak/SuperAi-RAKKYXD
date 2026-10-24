# Conversation Workspace Implementation Plan

**Goal:** Refresh the complete application UI, move suggestions below completed answers and constrain slash search.

**Architecture:** Keep existing provider, session and run ownership. Introduce a small shared contextual suggestion function and answer-footer component. Give the slash picker its own bounded popup layout. Consolidate the existing minimal theme and composer styles into the final application design layer.

**Tech Stack:** React 18, TypeScript, Electron, CSS, existing Playwright smoke harness.

**Spec:** `docs/superpowers/specs/2026-10-24-conversation-workspace-design.md`

## Global constraints

- Keep real terminal, provider, permission, voice, attachment and multi-agent functionality.
- Use bundled Noto Sans Thai and existing brand assets; no dependency or installation needed.
- Suggestions fill drafts for review and never send messages automatically.
- Preserve keyboard focus, Thai IME composition and viewport containment.
- Execute inline in the current session; no git writes because this workspace grants read access to `.git`.

## Task 1: Reproduce the slash overflow

- [x] Extend `packages/desktop/test/session-controls-smoke.mjs` with 100 long-description provider skills and assert popup position/size and composer visibility.
- [x] Attempt native session controls; document the Electron GPU crash and use the deterministic Chrome renderer harness for geometry regression coverage.

## Task 2: Replace ghost completion with contextual answer actions

- [x] Replace `src/suggestions.ts` with a pure answer-aware function and update `client/test/suggestions.test.ts` for completed/running/error/empty states and recommendation extraction.
- [x] Add `components/NextSteps.tsx`, selecting via the existing draft preparation event.
- [x] Integrate below the latest completed response in `ChatView.tsx` and the latest Agent/Chat run in `App.tsx`.
- [x] Remove ghost layer, badge, generic composer suggestions and ordinary Tab interception from `App.tsx`.

## Task 3: Bound slash search

- [x] Update `SlashMenu.tsx` for outside dismissal, meaningful keyboard selection and combobox metadata.
- [x] Define popup positioning, available-height measurement, internally scrolling rows, intact names and truncated descriptions in `composer.css`.

## Task 4: Refresh the complete visual system

- [x] Replace `minimal-workspace.css` with organized shared tokens and consistent shell/navigation/conversation/Agent/Chat/Preview/dialog/settings/Skills/setup styling.
- [x] Consolidate composer geometry across modes in `composer.css` and remove unused ghost styles.
- [x] Simplify the Code empty state into a working welcome surface with actual provider launch controls and keyboard-accessible mode buttons.

## Task 5: Validate and document

- [x] Run the client production build and focused suggestion tests.
- [x] Run the renderer replacement for native smoke and focused chat/skill/session tests; capture wide/narrow screenshots and correct observed layout defects. Record the native verification limitation.
- [x] Record the implemented design in `DESIGN.md` and validation evidence under `docs/superpowers/`.
