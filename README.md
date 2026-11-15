<p align="center">
  <img src="docs/images/app-icon.png" width="76" alt="SuperAi & RAKKYXD app icon">
</p>

<h1 align="center">SuperAi &amp; RAKKYXD</h1>

<p align="center">
  <strong>One desktop workspace for the AI coding tools you already use.</strong><br>
  Work with Agent, Code and Chat modes across Windows and macOS.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-8fb89a.svg" alt="MIT License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-22%2B-8fb89a.svg" alt="Node.js 22 or newer"></a>
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD/actions/workflows/ci.yml"><img src="https://github.com/rakgoorak/SuperAi-RAKKYXD/actions/workflows/ci.yml/badge.svg?branch=main" alt="Build status"></a>
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest"><img src="https://img.shields.io/github/v/release/rakgoorak/SuperAi-RAKKYXD-releases?label=latest%20release&color=d9a080" alt="Latest release"></a>
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases"><img src="https://img.shields.io/github/downloads/rakgoorak/SuperAi-RAKKYXD-releases/total?label=downloads&color=8fb89a" alt="Release downloads"></a>
</p>

<p align="center">
  <a href="https://rakgoorak.github.io/SuperAi-RAKKYXD/"><strong>Website</strong></a> ·
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest"><strong>Download</strong></a> ·
  <a href="PRIVACY.md">Privacy</a> ·
  <a href="SECURITY.md">Security</a> ·
  <a href="README_TH.md">ภาษาไทย</a>
</p>

<p align="center">
  <img src="docs/images/product-tour.gif" width="960" alt="A short tour of the SuperAi workspace, Agent team and multi-AI chat screens">
</p>

## What it is

SuperAi &amp; RAKKYXD is an open-source desktop workspace for people who work across several AI coding assistants. It brings provider sessions, project folders, terminals and previews together so you can choose the right workflow without juggling separate app windows.

It supports Claude Code, Codex, Antigravity (<code>agy</code>), OpenCode, Freebuff and local Ollama. Provider availability depends on the CLI and account you install. Freebuff is available in Code mode.

## Three ways to work

| Mode | Use it for | How it works |
| :--- | :--- | :--- |
| **Agent** | Delegating a larger project task | A Main Agent plans, asks when requirements are unclear, and can assign work to 1–6 sub-agents. File edits are an explicit choice. |
| **Code** | Working across CLI and terminal sessions | Open multiple sessions for a project and choose the provider, model and effort for each one. |
| **Chat** | Comparing several AI answers | Send a prompt to 1–5 Main Agents, compare attributed responses, then optionally ask for a synthesis. |

<p align="center">
  <img src="docs/images/agent.png" width="49%" alt="Agent mode with a Main Agent and sub-agent progress">
  <img src="docs/images/chat.png" width="49%" alt="Multi-AI Chat with attributed model answers">
</p>

<p align="center">
  <img src="docs/images/usage.png" width="760" alt="Provider usage and quota information inside the workspace">
</p>

## Tools around the conversation

- Search and reopen conversations across providers.
- Hide sessions without stopping background work.
- Create Git worktrees for parallel branches.
- Preview HTML, SVG, Tailwind CSS, Mermaid and supported React artifacts.
- Dictate Thai or English with local Whisper, then review the transcript before sending.
- Check provider usage and quota information where the provider exposes it.
- Choose read-only planning or allow file edits when you want an agent to make changes.
- Use multiple supported accounts and optional API providers.
- Browse and install skills with confirmation before each install.

## Download

Choose the latest installer for your computer:

| Platform | Download |
| :--- | :--- |
| Windows 10 / 11 (64-bit) | [Windows installer](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-Setup.exe) |
| macOS 11+ · Apple Silicon | [Apple Silicon DMG](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-arm64.dmg) |
| macOS 11+ · Intel | [Intel DMG](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-x64.dmg) |

Downloads do not require a GitHub account. Portable ZIP files and SHA-256 checksums are listed on the [latest release page](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest).

**Security prompt:** Windows builds are not code-signed. macOS builds use ad-hoc signing and are not notarized, so Windows SmartScreen or macOS Gatekeeper may ask you to confirm the app. Verify the SHA-256 checksum from the same release before opening it.

## First run

1. Install the app for Windows or macOS.
2. Follow the setup guide to check Node.js 22, Git and supported provider CLIs.
3. Sign in through the CLI for the provider you want to use.
4. Open a project folder, or start in Quick Chat.

## Privacy and security

The app does not operate an AI relay server. Prompts are handled by the provider or CLI you choose. Local Ollama models can run on your device. Provider privacy terms apply to prompts sent to that provider.

The optional anonymous usage count is sent every 10 minutes while the app is open. It includes a random install ID, app version and operating system. Cloudflare supplies a two-letter country code, stored with that anonymous record so the website can show aggregate online counts. The usage service does not store IP addresses, prompts, files, project names, accounts or API keys. Turn the count off in **Settings → Notifications**.

Settings and conversation history are stored on your computer. Attachments are kept under <code>.superai/attachments/</code> inside the project; add <code>.superai/</code> to your <code>.gitignore</code> when needed.

Read the full [Privacy Policy](PRIVACY.md), [Security Policy](SECURITY.md) and [Third-party notices](THIRD_PARTY_NOTICES.md).

## Build from source

Requirements: Node.js 22+, Git, Windows 10/11 or macOS 11+.

    git clone https://github.com/rakgoorak/SuperAi-RAKKYXD.git
    cd SuperAi-RAKKYXD
    npm install
    npm run build
    npm start

Run the repository checks with:

    npm test

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), then open an issue or pull request. Documentation, translations and provider adapters are good places to start.

## Independence and license

SuperAi &amp; RAKKYXD is an independent open-source project. It is not affiliated with, endorsed by or sponsored by Anthropic, OpenAI, Google or other AI providers. Their names and marks belong to their respective owners.

Released under the [MIT License](LICENSE).
