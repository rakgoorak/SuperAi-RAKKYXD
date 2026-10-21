# SuperAi & RAKKYXD

## Platform
Desktop app for Windows x64 and macOS (Apple Silicon and Intel), released through GitHub Releases. The workspace UI can also be opened in a normal browser. Stack: Electron shell, React/Vite/Tailwind client, Express + WebSocket + node-pty server, and a TypeScript agent core.

## Users and purpose
Thai-speaking user who wants to create software with several CLI agents and inspect websites in one easy-to-use workspace, including users who start with nothing installed. A composer mic lets them dictate prompts in Thai or English (press and hold, like Claude).

## Confirmed requirements
- BridgeMind-inspired workflow; original SuperAi & RAKKYXD branding. Thai interface.
- Real projects, terminals, conversation, assistant and browser Preview. No sample statuses or decorative inactive buttons.
- Code sessions: Terminal, Claude Code, Codex, Antigravity CLI (`agy`, replacing Gemini CLI, which Google retired in June 2026), OpenCode and Freebuff. Freebuff is limited to one managed running session across the app.
- Conversation and assistant modes use Claude Code, Codex, OpenCode (default) or a local Ollama model. Assistant teams run Supervisor/Coder/Tester/Reviewer steps in sequence and can be configured; file-edit and command permissions are separate opt-ins, off by default.
- Image and PDF attachments (PNG, JPG, GIF, WEBP, PDF, up to 20 MB each) in the composer and in CLI panes, saved under `<project>/.superai/attachments/`. When a provider cannot read a file, the app says so instead of dropping it.
- Voice is speak-to-type only (the separate SuperAi Voice app was removed 2026-10-20; a conversational voice mode was tried and removed at the user's request 2026-10-21): on-device Whisper in WASM, no Python or API key, text is inserted for review and never auto-sent.
- First-run setup guide checks and installs Node.js 22 LTS, Git for Windows (Windows only; macOS uses `xcode-select --install`) and CLIs per-user.
- Errors must be actionable. Accounts and microphone validation require actual user hardware/credentials.

## Approved direction
User approved the 2026-10-20 design draft and asked to proceed. Local Whisper transcription recommended in that approved design; Thonburian Whisper (Thai fine-tune) is the default because stock Whisper base/small misrecognised Thai in testing. No distribution pricing, cloud service or paid model is assumed.
