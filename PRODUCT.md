# SuperAi & RAKKYXD

## Platform
Windows desktop first, with a browser-accessible workspace UI. Existing Electron/React/TypeScript stack retained.

## Users and purpose
Thai-speaking user who wants to create software with several CLI agents and inspect websites in one easy-to-use workspace, including users who start with nothing installed. A built-in voice mode lets them talk to the assistant in Thai or English and hear the answer.

## Confirmed requirements
BridgeMind-inspired workflow; original SuperAi & RAKKYXD branding. Thai interface. Real projects, terminals, conversation, assistant and browser Preview. Claude Code, Codex, Gemini CLI, OpenCode and Freebuff; Freebuff limited to one managed running session. No sample statuses or decorative inactive buttons. Voice is an in-app conversational mode (replaced the separate SuperAi Voice app on 2026-10-20): on-device Whisper in WASM, OS speech for replies, no Python or API key. First-run setup guide checks and installs Node.js, Git for Windows and CLIs per-user. Errors must be actionable. Accounts and microphone validation require actual user hardware/credentials.

## Approved direction
User approved the 2026-10-20 design draft and asked to proceed. Local Whisper transcription recommended in that approved design; Thonburian Whisper (Thai fine-tune) is the default because stock Whisper base/small misrecognised Thai in testing. No distribution pricing, cloud service or paid model is assumed.
