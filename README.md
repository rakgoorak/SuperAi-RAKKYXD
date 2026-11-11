<p align="center">
  <img src="docs/images/app-icon.png" width="112" alt="SuperAi & RAKKYXD" />
</p>

<h1 align="center">SuperAi &amp; RAKKYXD</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg" alt="Node Version" /></a>
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD/actions/workflows/ci.yml"><img src="https://github.com/rakgoorak/SuperAi-RAKKYXD/actions/workflows/ci.yml/badge.svg?branch=main" alt="Build Status" /></a>
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases"><img src="https://img.shields.io/github/downloads/rakgoorak/SuperAi-RAKKYXD-releases/total?color=2563eb&label=Downloads&logo=github" alt="Total Downloads" /></a>
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest"><img src="https://img.shields.io/github/v/release/rakgoorak/SuperAi-RAKKYXD-releases?label=release&color=blueviolet" alt="Latest Release" /></a>
  <a href="https://rakgoorak.github.io/SuperAi-RAKKYXD/"><img src="https://img.shields.io/badge/website-live-success.svg" alt="Website" /></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-orange.svg" alt="PRs Welcome" /></a>
</p>

<p align="center">
  <b>🇬🇧 English</b> &nbsp;|&nbsp; <a href="README_TH.md">🇹🇭 ภาษาไทย</a> &nbsp;|&nbsp; 🇯🇵 日本語 (in-app) &nbsp;|&nbsp; 🇨🇳 简体中文 (in-app)
</p>

<p align="center">
  <b>All your AI coding assistants in a single, minimal, local-first desktop workspace.</b><br />
  Claude Code · ChatGPT (Codex) · Antigravity · OpenCode · Freebuff · Local Ollama<br />
  Windows &amp; macOS · Multi-language UI (EN / TH / JA / ZH) · 100% local-first · Bring your own account
</p>

<p align="center">
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-Setup.exe"><b>⬇ Download for Windows (Setup.exe)</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-arm64.dmg"><b>macOS (Apple Silicon)</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-x64.dmg"><b>macOS (Intel)</b></a>
</p>

<p align="center">
  <a href="https://rakgoorak.github.io/SuperAi-RAKKYXD/"><b>Website</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest"><b>All downloads &amp; SHA-256</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD/issues"><b>Issues</b></a>
</p>

<p align="center">
  <img src="docs/images/workspace.png" alt="SuperAi & RAKKYXD minimal workspace" width="900" style="border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);" />
</p>

<p align="center">
  <img src="docs/images/agent.png" alt="Agent Team mode" width="445" style="border-radius: 10px; border: 1px solid #1e2d38;" />
  <img src="docs/images/chat.png" alt="Multi-AI Chat mode" width="445" style="border-radius: 10px; border: 1px solid #1e2d38;" />
</p>

---

## Why SuperAi & RAKKYXD

Using several AI assistants usually means juggling 5–10 browser tabs, separate terminal windows, and a different subscription or API key for every provider. **SuperAi & RAKKYXD** puts them in one desktop window:

- **One workspace, every assistant** — Claude Code, Codex, Antigravity, OpenCode, Freebuff, and local Ollama side by side.
- **Local-first by design** — no relay servers, no analytics, no telemetry. Your prompts and code talk directly to the providers with your own account.
- **Multi-agent orchestration** — split a large task into parallel sub-agent workstreams and merge the result.
- **Multi-AI arena** — ask one question, compare answers from several models, then synthesize the best one.
- **Native developer tooling** — Git worktrees, branch switching, terminal tabs, artifact previews, and quota tracking.

---

## Features

### 1. Three working modes
| Mode | What it is | Highlights |
| :--- | :--- | :--- |
| **Agent** | Autonomous team workspace | A Main Agent plans, asks clarifying questions, delegates to 1–6 sub-agents, and merges results |
| **Code** | Multi-tab AI CLI manager | Claude Code, Codex, Antigravity (`agy`), OpenCode, Freebuff, or plain terminals |
| **Chat** | Multi-AI arena | Send one prompt to several models, compare side by side, synthesize the best answer |

### 2. Quick chat and Safe Mode
Start typing immediately — no project folder required. Safe read-only mode is enabled by default for casual chat, so the AI cannot modify files by accident.

### 3. Unified history and full-text search
Every session from every provider in one searchable timeline. Filter by provider and reopen any conversation.

### 4. Session hide and restore
Hide busy sessions without killing them. Background work keeps running and can be restored at any time.

### 5. Native Git worktrees
Switch real branches and create parallel worktrees without stash collisions. A smart merge banner helps land changes back on `main` and clean up.

### 6. Interactive artifact preview
Live preview for HTML, SVG, Tailwind CSS, and Mermaid diagrams, plus an interactive React/JSX/TSX runtime.

### 7. Local voice dictation
Offline speech-to-text with Whisper (including Thonburian Thai). Audio never leaves your machine.

### 8. Usage and quota tracker
Live 5-hour and weekly quota windows for Claude, Codex, and Antigravity.

### 9. Tool permissions
Read-only / plan mode for safe exploration, or edit mode when you want agents to write code and run commands. Sub-agent file access is a separate switch.

### 10. Cross-agent review and security audit
Have one agent review another agent's work (for example, Claude writes and Codex reviews), with localhost and folder-trust checks.

### 11. Self-healing test loop
Run the test suite, analyze failures, patch the code, and repeat until green.

### 12. Curated skills ecosystem
Install Agent Skills from Anthropic, OpenAI, Vercel (skills.sh), and Cloudflare security audit sources in one click.

---

## Download

| Platform | Installer | Size | Format |
| :--- | :--- | :--- | :--- |
| **Windows 10 / 11 (64-bit)** | [SuperAi-RAKKYXD-Setup.exe](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-Setup.exe) | ≈91 MB | NSIS installer |
| **macOS Apple Silicon (M1–M4)** | [SuperAi-RAKKYXD-macos-arm64.dmg](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-arm64.dmg) | ≈110 MB | Drag &amp; drop DMG |
| **macOS Intel (x64)** | [SuperAi-RAKKYXD-macos-x64.dmg](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-x64.dmg) | ≈115 MB | Drag &amp; drop DMG |

- Every link points at the latest release. No GitHub account required.
- Portable ZIP builds are on the [Releases page](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest).
- Every asset ships with a `.sha256` checksum.
- The [website](https://rakgoorak.github.io/SuperAi-RAKKYXD/) detects your OS and recommends the right file.

> **Windows SmartScreen / macOS Gatekeeper:** the current builds are not code-signed yet. On Windows choose **More info → Run anyway**; on macOS open **System Settings → Privacy & Security → Open Anyway**. Signed and notarized builds are in progress.

---

## First run

The setup guide checks and installs what you need:

1. **Node.js 22 and Git** — detected and installed if missing.
2. **AI CLI providers** — sign in to Claude Code, Codex, Antigravity (`agy`), OpenCode, or Freebuff.
3. **Project folder** — open a repo, or stay in Quick Chat.
4. **Starter skills (optional)** — recommended skills for your project.

---

## Auto-update

- Checks on launch and every 30 minutes.
- Downloads in the background and verifies SHA-256 before installing.
- Sessions, history, and project data survive updates.

---

## Privacy and security

- **Local-first architecture:** everything runs on your machine. No middleman server.
- **Your accounts, your keys:** providers are reached through their CLIs using your own sessions and API keys.
- **Project data:** settings and chat history live in `%USERPROFILE%\.opencode-multi` on Windows or `~/.opencode-multi` on macOS.
- **Safe attachments:** files are stored under `.superai/attachments/` inside the project; add `.superai/` to `.gitignore`.

See [SECURITY.md](SECURITY.md) for the vulnerability reporting policy.

---

## Build from source

Requirements: Node.js 22+, Git, and Windows 10/11 or macOS 12+.

```bash
git clone https://github.com/rakgoorak/SuperAi-RAKKYXD.git
cd SuperAi-RAKKYXD

npm install
npm run build
npm start          # launch the Electron app
npm test           # run the full test suite
```

Package a release:

```bash
npm run package:release
npm run archive:release
npm run installer:release
```

### Repository layout

```
packages/
├── core/              # agents, providers, tools
├── studio/
│   ├── server/        # Express, WebSocket, node-pty, CLI managers
│   └── client/        # React + Vite + Tailwind UI
└── desktop/           # Electron shell, updater, native tests
installer/             # NSIS installer and DMG assets
scripts/               # build, package, release, signing
```

---

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), then open an issue or a pull request.

Good places to start: documentation, translations, provider adapters, and `good first issue` labels.

---

## Disclaimer

SuperAi & RAKKYXD is an independent open-source project. It is **not affiliated with, endorsed by, or sponsored by** Anthropic, OpenAI, Google, or any other AI provider. All product names and trademarks belong to their respective owners.

AI output and shell commands run on your machine with the permissions you grant. Review commands before approving them. Use of each AI provider is governed by that provider's terms of service and pricing.

---

## License

[MIT License](LICENSE) © 2026 RAKKYXD &amp; SuperAi Contributors.
