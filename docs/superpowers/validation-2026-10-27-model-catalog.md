# Model catalog refresh and pending release 1.0.31

The installed Codex model cache contains `gpt-6.1-terra` with `visibility: list`. The server already reads that cache each time `/api/providers/codex/models` is requested. The client previously cached its request promise for the entire renderer lifetime. An already mounted picker could therefore retain an older model catalog.

Model pickers in session controls and team/setup seat selection now request a fresh catalog when opened. Requests for the same provider are deduplicated while pending. Reusable cached results expire after 60 seconds. Successful refresh notifies all mounted controls for that provider. Refreshing leaves the selected model unchanged and free typing remains available. Empty catalogs can still be refreshed through the picker arrow.

Codex cache parsing excludes hidden, empty and duplicate model IDs while preserving each listed model's effort levels. Existing provider sources remain: Codex cache, OpenCode CLI, Antigravity CLI and Claude suggestions. This change does not claim that every provider exposes a live listing API, or that a desktop-only model is necessarily usable through its CLI.

Validation:

- Full build after integrating remote main passed; final client build after the picker change passed.
- `node --import tsx --test packages/studio/test/model-catalog.test.ts`: passed. Covers new models appearing after the first read, effort levels, hidden/duplicate filtering and corrupt cache recovery.
- Composer browser fixture: 25 checks passed, including a model added after initial load appearing on reopening the picker without changing the selected model.
- Provider conversation fixture: 37 checks passed.
- Project usability fixture: 27 checks passed.
- Actual local server model discovery includes `gpt-6.1-terra` and excludes hidden `gpt-reserve`.
- `git diff --check`: passed.

Release preparation discovered remote main `df398efce616272b5b55ab277ed41667c1b207c6`, five commits ahead of local HEAD `f44655655a9c9b24c55d7c83f66998cf170754aa`. Their worktree changes were integrated from the authenticated GitHub compare response. The overlapping composer-location assertion already had an equivalent local correction. Git metadata remains unchanged. Root version is 1.0.31 because remote source already contains a 1.0.30 release commit. The earlier local 1.0.30 installer does not include this refresh fix.

Publication is pending. GitHub CLI cannot read its configuration due filesystem permissions. The GitHub connector can read repository data and supports source commits, but exposes no release/asset publishing action. Opening GitHub's release creation page through Edge was rejected by the browser origin approval gate (reported user declined access). No alternate browser, raw request, credential workaround, source mutation on GitHub, release, tag or asset upload was attempted after that denial. The public updater repository's latest release remained v1.0.29 when checked. User authorization to resume the blocked browser access is required before completing publication through that route.
