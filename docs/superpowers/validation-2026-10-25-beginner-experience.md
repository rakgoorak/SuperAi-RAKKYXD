# Beginner experience validation

## Changes

The skills.sh tab previously had no browse/default results and required at least two search characters. It now immediately shows up to 12 real starter items from the application's official catalog, clearly labeled as the app catalog, with explicit installation controls. Category shortcuts initiate live skills.sh searches. AI recommendations and installed items are expandable, keeping discovery visible. Search failure, zero matches and loading are distinct; retry retains the submitted query. HTTP/network errors in SkillManager no longer masquerade as zero results.

Getting started is now a focused three-step flow: select a project folder, choose/connect one AI assistant, then open a first conversation. The selected provider's readiness and account are shown rather than all accounts at once. Unknown account detection requires the user's provider-specific acknowledgment; a login-required provider remains blocked. Node.js/Git details, model/effort configuration, Skills and voice setup remain reachable under optional details. Prerequisites install only after an explicit click, in the required sequence.

The user can select a sample first message and edit it. Starting opens one assistant in the selected workspace or reuses an existing running session. No prompt is automatically sent. Existing unsent drafts are preserved when the new starter message is added. Adding or canceling a project returns to setup. The primary action stays visible in shorter windows.

Main Agent/Code/Chat controls now include Thai explanations. Model/effort fields and the welcome/session/project forms use more familiar wording. This updates the core discovery and first-use journey while preserving existing advanced functionality.

## Results

- Client production build (TypeScript/Vite): passed.
- Studio TypeScript build: passed.
- `node --import tsx --test packages/studio/test/skills.test.ts`: 7 passed. The new search-failure test failed before the backend fix and passed afterward.
- `node packages/desktop/test/beginner-experience-smoke.mjs`: 29 passed, no renderer errors. Covers new-project return, cancel return, provider readiness/isolation, default settings, draft preservation, selected-workspace spawning/reuse, starter browsing, explicit installation, category search, error retry, submitted-query labels, ordered prerequisite installation and failed readiness checks.
- Inspected desktop and 700x760 screenshots. Final evidence is under `output/beginner-experience/`: `connect-assistant.png`, `first-message.png`, `first-message-narrow.png`, `skills-starters.png`, `results.json`.
- `git diff --check`: passed with line-ending notices only.

The broader conversation renderer suite reached its existing quiet-work scenario but timed out waiting for the changed-files dialog at `conversation-workspace-smoke.mjs:450`. Its full suite is not reported as passing. No native packaged Electron release was tested or published here.

Validation uses fixture HTTP responses and Chromium. It does not install tools/skills on the real computer, log in to real accounts, call paid AI providers, or stop user jobs. Concurrent Git worktree implementation files were preserved.
