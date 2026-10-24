# Claude-like conversation actions implementation plan

**Goal:** Correct the answer controls that still contradict the approved Claude-like conversation design, while preserving every provider and session.

**Spec:** `docs/minimal-workspace-design.md` and `docs/superpowers/specs/2026-10-24-conversation-workspace-design.md`. This is a correction within their approved direction. Exact whole-product fidelity remains dependent on the user's choice of Claude Desktop/web versus Terminal.

**Architecture:** One shared response action row owns copy, regenerate, edit, and genuine file-change access. Code and Agent/Chat supply their own callbacks and busy state. Next-step recommendations remain separate and fill the composer without sending.

**Tech stack:** React, TypeScript, Lucide, existing CSS and Playwright renderer fixtures.

## Constraints and chosen approach

Keep real provider accounts, model/effort preferences, attachments, explicit send, projects and multiple sessions. Preserve the bundled Thai font and SuperAi branding. Avoid decorative feedback controls with no persistence. Retry can repeat tool side effects and must remain clearly labelled through title/accessible name, and disabled during work/disconnection. Changes and Preview are distinct functions.

Alternatives: retain the old large recovery buttons (small effort, fails requested interaction); replace the entire shell at once (broad and depends on reference); correct the shared conversation controls first (chosen, directly fixes the screenshot and works in every mode).

## Task 1: Shared answer actions

- [x] Create `packages/studio/client/src/components/ResponseActions.tsx`: copy with visible confirmation and clipboard failure, optional retry/edit/changes callbacks. Icon controls use accessible Thai names and tooltips. An overflow menu groups edit/changes; Escape/outside close it.
- [x] Update `ChatView.tsx`: place controls below each finished assistant response, regenerate only the latest answered turn; show an error recovery action only when the latest turn failed. Expose changes only when the turn reports edit tools. Remove unconditional footer and combined Preview label.
- [x] Update `RunActions.tsx`: use the same response controls, suppress retry while running, retain existing retry payload and workspace changes callback. Show file access only for runs allowed to edit.
- [x] Simplify `NextSteps.tsx`/`composer.css`: distinct text suggestions with a restrained arrow, no border-heavy card or repeated drafting instructions.
- [x] Add CSS for the shared controls, preserving visible focus and narrow layouts.

## Task 2: Renderer checks and evidence

- [x] Extend `packages/desktop/test/conversation-workspace-smoke.mjs`: successful Code reply has a labelled compact regenerate control and no old generic footer; regenerate uses original model/effort; busy hides actions; tool changes use their own action; failures remain retryable. Agent and Chat retain controls and provider flow.
- [x] Build the client, run the renderer fixture, inspect desktop and narrow screenshots together, and correct material issues in one batch.
- [x] Record validation and build limitation; installers predate these source changes and must be repackaged before distribution. Git publication remains subject to actual tool authority.

## Whole-product direction for confirmation

Claude Desktop/web reference: quiet sidebar with new conversation/projects/history; a single conversation title row; aligned reading/composer column; small response actions; compact attachment/model controls; bounded command popup; generated file cards opening a right-hand Preview; thinking/tools folded within the conversation. Provider and model identity must stay visible and provider-specific capabilities remain truthful. Code/Agent/Chat and simultaneous sessions remain accessible as real product features.

Exact replication cannot promise Claude-only cloud services (Claude artifacts hosting, account billing or model capabilities) through other providers. This is a UI/interaction target, with the existing provider adapters remaining responsible for what each CLI can do.
