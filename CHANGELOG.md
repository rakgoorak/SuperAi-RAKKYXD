# Changelog

All notable changes to SuperAi & RAKKYXD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

Full release notes, including Thai descriptions, live in [docs/RELEASE.md](docs/RELEASE.md).

## [1.0.43] - 2026-11-12

### Fixed
- Codex could not edit files on Windows ("blocked by policy") when its account
  folder had no Windows sandbox configured: every account added in the app, and
  machines without the Codex desktop app. The app now enables the sandbox itself.

### Changed
- The permission menu offers the same short list for every AI: read only, ask
  first, automatic, full access.
- The "ask before working" switch is gone; the AI decides when to ask first.
- Shorter chat options panel and footer.

## [1.0.42] - 2026-11-11

### Added
- Question cards: when the AI needs a decision it shows a card with options (works
  with every agent and permission mode, including Claude's own questions). An
  "ask before working" switch in the chat footer makes the AI ask first.
- Chat rooms on API providers (OpenRouter, DeepSeek, Groq) and custom
  OpenAI-compatible providers added with a base URL, models and key.

### Changed
- Task checklists follow the agent's own task list more accurately, and streamed
  replies render more smoothly.

## [1.0.41] - 2026-11-11

### Fixed
- Saving an API key failed with "encryption not ready" when the stored credentials
  file could not be decrypted on this machine; the file is now set aside and a new
  one started, and errors show the real reason.
- The update prompt had no styles: the mandatory update is a full-window screen
  again and the optional update a small card.

## [1.0.40] - 2026-11-11

### Added
- Several accounts for Claude, Codex and OpenCode, chosen per tab or seat
  (Settings > AI accounts).
- OpenRouter, DeepSeek and Groq in Agent and Chat with your own API key, checked
  before saving and stored encrypted (Settings > API Key).
- Remaining credit for OpenRouter and DeepSeek in the Usage panel.

### Fixed
- OpenCode chats that stopped without an answer when a skill left a file in the
  temp folder; any turn that still ends without an answer now says why.
- Codex quota stuck on old figures; it is now read live from the account.
- The running-step label showed `@'` for PowerShell scripts.

### Changed
- OpenCode messages start about 2 seconds sooner (no account check per message).

## [1.0.39] - 2026-11-10

### Fixed
- Antigravity chats that never answered because the model name already contains an
  effort level (for example `gemini-4-argon-high`) while the app also sent a
  conflicting effort value.
- Effort selection for Antigravity is now limited to `low`, `medium`, and `high`,
  and the effort field is disabled when the selected model encodes its own level.
- Antigravity permission errors are surfaced with an actionable message instead of
  silently producing no response.

### Changed
- Hard updates are read only from the latest release entry, not from markers in
  older release notes.
- Titlebar language switcher icon and badge styling.

## [1.0.38] - 2026-11-10

### Added
- First-run interactive tour with TH / EN / JA / ZH switching.
- Anonymous usage counter for the download page (random machine id, app version,
  and OS only; can be disabled in Settings → Notifications & tips).

### Changed
- Multi-language coverage for the welcome screen, tour, sidebar, and composer.

## [1.0.37] - 2026-11-10

### Fixed
- macOS builds of v1.0.36 were actually v1.0.35, causing update loops.
- The updater now verifies the version inside the downloaded artifact before
  installing and fails with a clear error instead of looping.

### Added
- Four UI languages: Thai, English, Japanese, Simplified Chinese.
- Community download count in the update panel.

## [1.0.35] - 2026-10-29

### Added
- Agent Workspace 2D/3D office visualizer with live Main and Sub-agent states.
- Clarifying questions with multiple-choice, recommended, and free-text answers.
- Tool permission controls, including read-only / plan mode for sub-agents.
- Independent clarify toggles for Agent and Chat modes.

## [1.0.34] - 2026-10-28

### Added
- Permission request popups and notification bar for Claude, Codex, and OpenCode.
- Full Codex app-server and OpenCode permission protocols.
- Accurate cancelled, expired, and failed permission states.

## [1.0.31] - 2026-10-24

### Added
- Interactive artifact preview and richer multi-tab terminal handling.
- Provider-specific model selection improvements.

## [1.0.28] - 2026-10-21

### Added
- Warm Charcoal minimal interface with a compact three-icon mode switch.
- Quick provider chat and safe read-only mode.
- Unified history with full-text search.
- Session hide and restore.
- Git worktrees and branch switching.
- Ctrl/Cmd + click URL opening.
