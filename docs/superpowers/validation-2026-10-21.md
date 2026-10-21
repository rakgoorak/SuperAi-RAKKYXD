# Verification of the current workspace and installed application

Date: 2026-10-21, Asia/Bangkok. Windows x64, Node 24.16.0, root package version 1.0.5.

## Result

The tested workflows pass. This is not a claim that every provider/model, clean-machine installation, operating system, or microphone has been verified. The known incomplete-CLI-installation problem remains in the product implementation, although Claude on this machine was repaired separately.

## Fresh checks executed

| Command / check | Observed result |
| --- | --- |
| `npm.cmd run build` | Core, server, client production build/typecheck, and desktop syntax checks passed. |
| `npm.cmd test` | Core 5, desktop 9, server 71 tests passed: 85 tests total, zero failures. Client TypeScript check passed. |
| `npm.cmd run test:desktop` | 16 integration checks passed; no renderer exceptions. Real PTY input/output, first-run UI, native browser isolation, attachments pasted/dropped into terminal and composer, and mode switching. |
| `npm.cmd run test:reference` | 18 checks passed; no renderer exceptions. Dashboard search/selection, cross-project selection, task/prompt CRUD and delivery, presets, partial-launch retries, refresh failure, resizing/reordering, and session preservation. |
| `npm.cmd run test:layout` | 12 grouped checks passed; no renderer exceptions. 1/2/3/6/12 sessions and different viewport sizes. |
| `npm.cmd run test:usage-overlay` | 18 checks passed. Native Browser view visibility checked while the quota panel opens/closes at different widths. Quota responses are controlled fixtures. |
| `npm.cmd run test:team` | Installer UI cancel/retry, saved per-project team, Agent planning/dependency handoff/reporting, and Chat attribution/summary passed; no renderer exceptions. AI and installation endpoints use controlled fixtures. |
| `node packages/desktop/test/terminal-render-smoke.mjs` | Passed. Real xterm receives controlled WebSocket output; Thai row height 25 px versus 20 px ink height, old status suffix erased, CLI receives resize, mounted terminal survives view toggles. |
| `npm.cmd run test:voice` | Passed. Synthesized English audio through Chromium fake microphone and actual Whisper: tap start/stop and press/hold both transcribed the coffee-shop sentence; existing text preserved; no automatic send; microphone menu passed; no renderer exceptions. |
| Installed EXE: `SUPERAI_PORTABLE_DIR=D:/SuperAi-RAKKYXD`, `SUPERAI_TEST_MODE=1`, `npm.cmd run test:desktop` | 16 checks passed; no renderer exceptions, with a separate temporary test profile. |
| Installed EXE: same environment, `npm.cmd run test:reference` | 18 checks passed; no renderer exceptions. Dashboard, actual terminal delivery, session selection, presets and retry behavior exercised on the installed application. |
| Existing application `/api/health` | HTTP 200, status `ok`, native PTY available. |
| Existing application `/api/cli-versions?refresh=1` | Claude 2.1.306, Codex 0.163.0, Antigravity 1.4.4, Freebuff 0.2.32 readable; OpenCode explicitly not installed. Antigravity latest status is a remembered confirmation by its updater. |

## Real provider requests

Invoked the production `CliProvider` with a temporary empty working directory, tools disabled/read-only settings, default CLI model/effort, and a 90-second cancellation limit. Prompt requested exactly `SUPERAI_LIVE_OK` and prohibited tools or file access/changes.

| Provider | Actual reply | Approximate duration |
| --- | --- | --- |
| Claude Code | `SUPERAI_LIVE_OK` | 9.4 s |
| Codex | `SUPERAI_LIVE_OK` | 10.8 s |
| Antigravity | `SUPERAI_LIVE_OK` | 8.4 s |

Machine-readable results: `output/live-check-6X92cG/results.json`. These requests confirm real authentication and response generation for the default configuration tested; they do not verify every model or a live multi-provider Agent team.

## Known gaps and limitations

1. **Incomplete CLI installations can still be labelled ready.** `CliCatalog.listClis()` uses executable-file existence. The installer checks exit code and command discovery, without a successful version probe. The earlier 500-byte Claude placeholder satisfied discovery but failed to launch with `spawn UNKNOWN`. npm's script policy blocked its postinstall. This machine was repaired by reinstalling the same version and explicitly running the inspected vendor `install.cjs`; automatic detection/repair and prevention for other users have not been implemented.
2. **Source and installed client bundles differ.** Fresh build loads `index-BC3TcG9D.js`; the installed app loads `index-BkGHTX8A.js`. Shared desktop code and the checked CLI server modules match byte-for-byte. Passing source tests cannot alone establish that every latest UI change is present in the installed app. This verification did not deploy or replace the user's running app.
3. OpenCode is not installed and has no real response test here. Freebuff version was verified, but its interactive login/conversation was not exercised.
4. The microphone test uses synthesized English audio. Actual hardware, Thai recognition accuracy, every speech model, and every OS are not verified.
5. Agent/Chat coordination and quota UI are tested with controlled services. The three short live provider requests do not establish a live multi-provider team or current quota accuracy for all accounts.
6. No release publication, clean-machine installer execution, real in-app self-update, or macOS runtime verification was performed in this run.
7. No Git metadata is present in this workspace, so this records the current files and commands, not an exhaustive review of a commit diff.

## Isolation and artifacts

Electron UI tests use separate `SUPERAI_DATA_DIR` profiles. The user's four original sessions (three Codex, one Antigravity) were still running with the same IDs after verification. No user session was stopped or sent test input.

Screenshots are in `output/playwright/`, including terminal geometry in `output/playwright/terminal-render/geometry.json`; Agent/Chat fixture screenshots are in `output/team-check-2YBR95/`. Production source files were not changed in this verification; builds and test artifacts were generated.
