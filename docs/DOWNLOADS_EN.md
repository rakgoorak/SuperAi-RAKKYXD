# Download and install SuperAi & RAKKYXD

Download the installer for your machine from [Releases](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest). No GitHub account is required. Every asset has a matching `.sha256` checksum.

| Machine | File |
| --- | --- |
| Windows 10/11 64-bit | `SuperAi-RAKKYXD-Setup.exe` |
| Mac with Apple Silicon (M1/M2/M3/M4 and newer) | `SuperAi-RAKKYXD-macos-arm64.dmg` |
| Mac with Intel chip | `SuperAi-RAKKYXD-macos-x64.dmg` |

## Windows

Portable build (no installation): download `SuperAi-RAKKYXD-windows-x64.zip`, extract the whole folder, and run `SuperAi-RAKKYXD.exe`.

Run `SuperAi-RAKKYXD-Setup.exe` and follow the wizard: choose an install folder (the default is `%LOCALAPPDATA%\Programs\SuperAi-RAKKYXD`, no admin rights needed), then optionally create a desktop shortcut and launch the app. The installer adds a Start Menu shortcut and an entry in Settings → Apps for uninstalling. Uninstalling does not delete your projects, history, or settings. If you pick a folder that already contains other files, the installer creates a `SuperAi-RAKKYXD` subfolder. This build is not code-signed yet, so Windows may show “Windows protected your PC” — click **More info → Run anyway** after confirming the file came from this repository's Releases.

## macOS

Open the `.dmg` and drag **SuperAi & RAKKYXD** into **Applications**. macOS 11 or newer is supported by the bundled Electron runtime. This build uses ad-hoc signing (no Apple Developer ID / notarization yet). If macOS Sonoma/Sequoia reports that the app is damaged or cannot be opened by Gatekeeper, run:

```bash
xattr -cr /Applications/SuperAi-RAKKYXD.app
```

Or open System Settings → Privacy & Security, scroll to Security, and click **Open Anyway** to confirm the first launch.

Voice dictation requires Microphone permission the first time you use it.

## Update to a new version

You do not need to uninstall and reinstall. The app checks Releases every time it starts. When a new version exists, the **Update** button in the left sidebar shows a green dot. Click **Download update** (SHA-256 is verified), then **Install and restart**. The app closes, replaces the files in the same folder, and reopens itself. Projects, history, and settings are preserved. Keep the app in a folder your account can write to (not Program Files).

## First run

The app bundles the Electron runtime, so there is nothing to install before opening it. The first launch opens a **Get started** page that checks your machine and installs what is missing into `~/.opencode-multi` without admin rights:

1. **Node.js 22** — installed automatically (downloaded from nodejs.org with SHA-256 verification).
2. **Git for Windows** (Windows only; Claude Code needs Git Bash) — PortableGit is downloaded from the Git for Windows GitHub releases with SHA-256 verification. On macOS, `xcode-select --install` is used.
3. **AI CLIs** — install Claude Code, Codex, or OpenCode from official npm packages, or the Antigravity CLI (`agy`) with Google's official script at antigravity.google.
4. **Project** — choose a working folder.
5. **Sign in** — open a session and follow that CLI's login flow with your own account. Usage and quota depend on the provider.
6. **Voice dictation** (optional) — hold the microphone button in the composer. The first time, the app asks before downloading the speech model (≈290 MB), once.

You can reopen this page from **Get started** in the left sidebar. Freebuff supports one session at a time.

## Privacy

Project data, prompts, and speech models stay on the user's machine and are not included in the installer.
