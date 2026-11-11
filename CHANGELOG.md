# Changelog

All notable changes to SuperAi & RAKKYXD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

Full release notes, including Thai descriptions, live in [docs/RELEASE.md](docs/RELEASE.md).

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
