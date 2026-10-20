# SuperAi & RAKKYXD Implementation Plan

> Execute inline using executing-plans; validate each subsystem before integration.

**Goal:** Thai desktop agent workspace with real embedded browsing, OpenCode, single-session Freebuff, persistent projects, real agent threads and a separate local dictation companion.

**Architecture:** Keep Electron/React/Express. Separate CLI catalog and session policy, browser controller, agent runs and voice recording/transcription. No sample status or intercepted provider cookies.

**Tech Stack:** TypeScript, React, Electron, WebContentsView, node-pty, Python faster-whisper.

## Constraints

- Brand: SuperAi & RAKKYXD; companion: SuperAi Voice & RAKKYXD.
- Thai interface; actual functionality; visible errors; no automatic execution of dictated words.
- Freebuff: at most one running session in the server, any workspace. Include OpenCode.
- Reuse current checkout, preserve existing user data. No destructive operations or deployment.
- Desktop browsing uses isolated WebContentsView; HTTP/WS accessible only locally with origin validation.
- Local voice requires a model and real microphone acceptance testing; state unverified hardware checks honestly.

## 1. Session policy and API

Files: server/CliCatalog.ts, TerminalSessionManager.ts, WorkspaceRegistry.ts, StudioServer.ts, types.ts; test/policy.test.ts.

- [x] Write tests for unknown agent rejection, one Freebuff, release on kill, workspace update/delete, URL validation.
- [x] Run `npx tsx --test packages/studio/test/policy.test.ts` and observe failure.
- [x] Implement CLI discovery, validated spawn, single-session limit, accurate running/exit events and project CRUD.
- [x] Run studio tests; fix startup/build entry paths and launcher.

## 2. Embedded browser and desktop bridge

Files: desktop/browser.mjs, main.mjs, preload.cjs; test/browser.test.mjs.

- [x] Test URL normalization and allowed schemes using node:test before implementation.
- [x] Add isolated tabs, navigation state, resize, popup handling, cleanup and visible load errors using WebContentsView.
- [x] Expose typed IPC, modal visibility control, folder selection and external navigation.

## 3. Thai interface and real conversation

Files: client/src/App.tsx, index.css, components/PreviewPanel.tsx, desktop.d.ts; server/AgentRunManager.ts.

- [x] Replace sample cockpit with Thai project sidebar, sessions, settings, tabs/grid, typed prompt targeting, cancellation and true states.
- [x] Use capability detection to disable missing CLIs with an explanation. Freebuff selector offers one session only.
- [x] Persist UI settings; use server projects/sessions as state authority.
- [x] Connect conversation and supervisor to core provider pipeline with stream/cancel/history; provider credentials remain in the CLI configuration; non-secret model selection is stored in UI settings.
- [x] Integrate browser bridge and web fallback with truthful restrictions.

## 4. Voice companion

Files: packages/voice/* (service.mjs, window.mjs, Python helper); desktop/main.mjs launcher; client voice controls.

- [x] Verify audio validation with automated tests and dictation message delivery with desktop integration smoke checks.
- [x] Build separate Electron companion window and tray with global hotkey, mic/language selection, explicit record/stop/cancel.
- [x] Transcribe via bundled Python helper using faster-whisper and multilingual models; surface setup/model availability.
- [x] Deliver text into main composer; Windows external paste captures target before recording and falls back to clipboard.
- [x] Provide launch scripts, dependencies and Thai setup instructions.

## 5. Validation and documentation

- [x] Run `npm run build`, `npm test`, frontend TypeScript validation, Python compilation and desktop module syntax checks.
- [x] Run browser UI interaction tests with real local backend and capture screenshots.
- [x] Run desktop browser navigation and voice companion smoke checks; optional live OpenCode conversation used the available provider model without reading secret values.
- [x] Inspect diff, document tested behavior and remaining microphone/account-dependent checks; keep plan status accurate.

## Acceptance still requiring the user

- [ ] Real microphone Thai/English accuracy and dictation into the user's preferred third-party Windows applications. No microphone was activated automatically.
- [ ] Claude/Codex/Gemini/Freebuff provider-account/model acceptance beyond launching CLI: the machine's inherited Claude model/auth settings are not a working verification baseline. OpenCode live response passed using an app-specific model override.

Portable executables are produced by scripts/package-portable.mjs and exercised separately; no installer signature is claimed.
