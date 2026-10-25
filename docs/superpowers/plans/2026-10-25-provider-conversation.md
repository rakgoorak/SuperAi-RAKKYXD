# Provider Conversation Implementation Plan

**Goal:** Make one-window AI conversations easy to start and resume while keeping provider differences visible.

**Architecture:** Reuse App's composer and existing dormant chat-session endpoint. Add small provider identity and history projection modules; keep terminal and team flows intact.

**Tech Stack:** React 18, TypeScript, Express, Electron, existing Playwright fixture harness.

**Spec:** `docs/superpowers/specs/2026-10-25-provider-conversation-design.md`

The user approved implementation in this session; execute inline and retain pre-existing working-tree edits.

- [x] Add `providerIdentity.ts` and `ProviderBadge.tsx`; map provider-specific capability and permission explanations without changing server permission behavior.
- [x] Add an idempotent `/api/workspaces/quick-chat` endpoint using a fixed folder beneath the app data directory. Test repeated calls and isolation from existing user workspaces.
- [x] Update App and WorkspaceWelcome for provider selection and create-on-send using `seatFor`, with a stable new-conversation draft scope, a send guard and retry reuse. Keep `openSession` for advanced launches.
- [x] Default new installs to tabs/closed Preview, simplify zero/one-session headers, and put persistent provider identity in sidebar/tabs/composer.
- [x] Project history into recent conversation entries plus search results; add provider/mode filters and unhide sessions on reopen.
- [x] Update shared CSS and DESIGN.md to describe the final behavior. Build client/server and exercise a deterministic browser test at desktop and narrow laptop widths. Run existing affected regression tests, inspect screenshots, fix observed failures in a bounded pass.

Validation: `docs/superpowers/validation-2026-10-25-provider-conversation.md`.
