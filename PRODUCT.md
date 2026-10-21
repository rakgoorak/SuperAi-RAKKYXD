# SuperAi & RAKKYXD

## Platform
Windows desktop first, with a browser-accessible workspace UI. Existing Electron/React/TypeScript stack retained.

## Users and purpose
Thai-speaking user who juggles Claude, ChatGPT (Codex), Antigravity, OpenCode and Freebuff and wants them all in one window instead of switching apps, including users who start with nothing installed. A composer mic lets them dictate prompts in Thai or English (press and hold, like Claude).

## Confirmed requirements
BridgeMind-inspired workflow; original SuperAi & RAKKYXD branding. Thai interface. Real projects, terminals, conversation, assistant and browser Preview. Claude Code, Codex, Gemini CLI, OpenCode and Freebuff; Freebuff limited to one managed running session. No sample statuses or decorative inactive buttons. Voice is speak-to-type only (the separate SuperAi Voice app was removed 2026-10-20; a conversational voice mode was tried and removed at the user's request 2026-10-21): on-device Whisper in WASM, no Python or API key, text is inserted for review and never auto-sent. First-run setup guide checks and installs Node.js, Git for Windows and CLIs per-user. Errors must be actionable. Accounts and microphone validation require actual user hardware/credentials.

Three modes (requested 2026-10-21): **Agent** — a Main (provider/model/effort) plans and assigns tasks to 1–6 Sub-agents (each provider/model/effort) that work in parallel with dependencies, with live per-agent progress; file edits are an opt-in checkbox. **Code** — many CLI tabs, model/effort picked per tab. **Chat** — one prompt to 1–5 Mains, each answer attributed, then an optional summarizer (merge all / keep the best) that credits each AI. "ChatGPT" means Codex CLI with a ChatGPT login, not the website. First run sets default model/effort per provider. Skills come only from official Anthropic/OpenAI repos: the AI proposes, the user confirms each install. Freebuff has no headless mode, so it is Code-only.

## Approved direction
User approved the 2026-10-20 design draft and asked to proceed. Local Whisper transcription recommended in that approved design; Thonburian Whisper (Thai fine-tune) is the default because stock Whisper base/small misrecognised Thai in testing. No distribution pricing, cloud service or paid model is assumed.
