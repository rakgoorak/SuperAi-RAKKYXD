# Conversation workspace validation — 2026-10-24

## Scope

Complete shared visual refresh; replace composer ghost completion with actions after completed answers; bound slash search; retain Code/Agent/Chat, projects/sessions, account/model controls, dictation, attachments and Preview.

## Root causes and experiment record

- The original slash picker rendered every skill and its full description in normal flow. Its stylesheet only supplied background/selection colors. The screenshot and source agree: no position, height cap or scrolling list prevented a long catalog from covering the composer.
- Ghost completion came from mode-specific canned prompts and intercepted ordinary Tab. It was not derived from the assistant's recommendation. Replaced with completed-answer extraction and explicit draft actions.
- Initial Electron session-control smoke could not reach the application. A diagnostic launch captured repeated GPU-process exits with code -1073741515 followed by “GPU process isn't usable”. Disabling GPU did not repair this environment. Browser renderer tests use installed headless Chrome and deterministic API/WebSocket fixtures instead.
- First screenshot review exposed conflicting old selector priorities. An attempted CSS-layer isolation disturbed existing Tailwind utility behavior; it was discarded. Final ownership uses `#root` scoped application theme selectors; no new cascade layers remain.
- Preview containment regression was reproduced with the actual rendered application: at a 782px canvas, `.terminal-layout` remained 1153.5px wide because its flex minimum was `auto`. The browser test failed on this exact geometry. Setting its minimum width to zero and maximum width to 100% allows it to shrink beside Preview. The same containment assertion now passes.

## Completed checks

- Client TypeScript check and Vite production build: passed.

- Focused Node/TypeScript suite: **28 passed**, including recommendation lifecycle/extraction, model/effort isolation and reset, provider handoff, skill discovery/identity and Thai terminal text.
- Desktop syntax build: passed for main entry, app, browser, updater and installer sources.
- Renderer smoke: **23 checks passed** via `npm run test:conversation-ui`, covering a 100-skill catalog, bounded popup geometry at 1440×900 and 1000×760, internal scrolling, combobox metadata, Enter/Escape/outside/Tab behavior, preserved draft prefixes, recommendations in all modes, no auto-send, correct target session, settings navigation and welcome controls.
- Screenshot inspection covers Code, slash search, Agent, Chat, Settings, welcome and Preview. Images use synthetic UI fixtures, not real provider results.

## Limits

The browser fixture verifies the production renderer with mocked APIs and WebSockets. It does not authenticate providers, run real model requests, exercise native microphone input or verify Electron window integration. The broad `npm test` attempt did not complete before interruption, so it is not reported as a complete passing run. The focused suite and desktop syntax checks completed successfully. No release, installer, commit or deployment was requested or produced.

## Skills discovery

The selected `find-skills` workflow checked skills.sh and upstream repositories. Relevant existing skills were available locally, so no install was performed:

- [frontend-design — Anthropic](https://skills.sh/anthropics/skills/frontend-design): the leaderboard showed approximately 1.0M installs; the upstream repository showed approximately 183k stars when checked. Install elsewhere with `npx skills add anthropics/skills@frontend-design`.
- [web-design-guidelines — Vercel](https://skills.sh/vercel-labs/agent-skills/web-design-guidelines): the leaderboard showed approximately 776k installs; the upstream repository showed approximately 32.9k stars when checked. Install elsewhere with `npx skills add vercel-labs/agent-skills@web-design-guidelines`.

Other applied local guidance: brainstorming, impeccable, writing-plans, diagnosing-bugs, debug-mantra and vercel-react-best-practices. Existing recorded design approval and the user's explicit changes supplied the visual/behavioral direction.
