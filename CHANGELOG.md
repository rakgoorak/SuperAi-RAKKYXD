# Changelog

All notable changes to SuperAi & RAKKYXD are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

Full release notes, including Thai descriptions, live in [docs/RELEASE.md](docs/RELEASE.md).

## [1.3.0] - 2026-11-19

### Changed
- Streamlined Computer Use to a single switch in Settings > AI control: once enabled, AI agents can click, type, edit, and work directly across regular apps (including Microsoft Edge, Chrome, terminals, and code editors) without repetitive per-app approval popups (`packages/desktop/computer-control.mjs`, `packages/studio/client/src/components/ComputerUsePanel.tsx`).
- Sensitive apps and pages (password managers, crypto wallets, and banking) still prompt the user in an Allow / Deny confirmation window before acting; password input fields and SuperAi's own window remain protected.

### Fixed
- Prevented `computer_focus_window` from un-maximizing already maximized windows when bringing them to the front (`packages/desktop/computer-control.mjs`).
- Prevented `ClientBundleUpdater` from shadowing newer built-in UI builds (or dev builds) with older cached OTA client bundles (`packages/desktop/client-updater.mjs`, `packages/desktop/app.mjs`).

## [1.2.9] - 2026-11-19

### Fixed
- Filtered stale trajectory `ERROR_MESSAGE` errors (such as recovered `API error (attempt 1): request failed: stream idle timeout (10m0s): context deadline exceeded`) that Antigravity CLI (`agy`) re-emits on subsequent resumed turns and `/compact` runs (`packages/studio/server/CliChat.ts`).
- Added clear localized guidance (`th`, `en`, `ja`, `zh`) when a genuine `stream idle timeout` / `context deadline exceeded` failure occurs (`packages/studio/server/CliProvider.ts`).

## [1.2.8] - 2026-11-19

### Fixed
- Fixed an Electron main-process crash (`TypeError: Cannot read properties of undefined (reading 'getURL')`) in `BrowserController.state()` when OAuth or sign-in popups close themselves inside the built-in browser panel (`packages/desktop/browser.mjs`).
- Adopted popup windows cleanly without passing `webContents: undefined` to `new WebContentsView(...)`, preserving `window.opener`, `persist:superai-preview` session cookies, and `about:blank` redirects.
- Hardened `browser_click`, `browser_type`, and `browser_press` against mid-action popup switches or self-closing tabs (`packages/desktop/browser-automation.mjs`).

## [1.2.7] - 2026-11-19

### Added
- Antigravity CLI MCP integration for all SuperAi Browser Use and Computer Use tools, plus clearer tool labeling in chat.
- Hidden file input discovery & direct upload in Browser Use (`browser_upload`) and Chrome/Edge DevTools tab attachment.
- Non-blocking asynchronous skill discovery and pre-turn Git checkpoints (`deferCheckpoint` + `AbortSignal`), plus optimistic composer clearing and queue-edit restoration.

### Changed
- Chrome and Edge launched by SuperAi start in the background unless revealed for sign-in; Codex Auto uses native workspace-sandbox review.

## [1.2.6] - 2026-11-18

### Added
- Dynamic Client Assets (OTA): background Web Client Bundle sync via GitHub releases and runtime hot-swap without desktop binary updates.
- Composer image preview: clicking attached image thumbnails in the chat composer opens full-sized zoomable preview lightbox like Claude Desktop.
- Copy image and Save image actions via right-click context menu and viewer controls.
- GitHub Actions workflow for automatic client bundle builds and OTA asset releases (`client-ota.yml`).

### Changed
- Redesigned image preview lightbox with Claude Desktop aesthetic: floating blurred translucent dark backdrop, larger centered view, and click-backdrop-to-dismiss.
- Stabilized chat scrolling: ResizeObserver pins chat to bottom as images render, and session switching seamlessly restores latest message position.

### Fixed
- Fixed Skills panel infinite reload loop caused by 1.8s workspace polling.

## [1.2.5] - 2026-11-18

### Added
- Open a new session without choosing a project folder first (general chat workspace), just like Claude Desktop and Codex Desktop.
- Rewind project files to before any message with checkpoints (#48).
- Review AI edits section by section and keep or undo each hunk (#47).
- Global shortcut for Quick Ask from anywhere on your computer (#46).

### Changed
- Redesigned the left sidebar: primary New Session action at the top, unified search + favorites bar, cleaner session rows without duplicate provider subtitles, and a compact 2-column bottom utility dock.
- Simplified the live chat working indicator to show `กำลังทำงาน` alongside token count and elapsed time without repeating the CLI and model name.
- Improved scrolling performance in long chats by skipping off-screen rendering (#45).

### Fixed
- Opening a 2nd or subsequent session now immediately switches focus to the newly opened session instead of reverting to the first session.

## [1.2.4] - 2026-11-17

### Added
- Full Markdown in chat answers: headings, nested and task lists, tables, code
  coloured by language, math (KaTeX) and Mermaid diagrams.
- Click a file path in an answer to open its folder; `file.ts:42` opens that
  line in Preview.
- The app asks before counting the computer as a user. Nothing is sent and no
  ID exists until the user allows it; saying no deletes the ID.

### Changed
- The message box starts as one line and grows with text and images, like
  Claude Desktop. Expand and Stop left the + menu.
- The AI answers in the language the user writes in, instead of always Thai
  (Agent team, multi-AI answers and summaries, question cards).
- Dates and times follow the app language; speak-to-type uses the multilingual
  model outside the Thai app.
- Release notes, README screenshots and the download guide come in English
  first, with Thai versions alongside.

### Fixed
- The Microsoft Store build no longer sends the usage count, as its privacy
  policy says.

## [1.2.3] - 2026-11-17

### Added
- Videos linked in an answer (mp4, webm, mov) play right in the chat. An image
  or video outside the project shows a "Show this image/video" button.
- macOS: Settings > macOS permissions lists the microphone, camera, screen
  recording, Accessibility and Full Disk Access, with the Allow prompt or the
  matching System Settings pane for each. Ported from Patiphan Wilaiphit's
  earlier work.

### Changed
- Updates go straight to the newest version. A user several versions behind
  no longer installs them one at a time.
- Electron 45, React 19, Express 5 and transformers.js 4 (voice dictation).

## [1.2.2] - 2026-11-17

### Changed
- macOS: every release is signed with the same certificate, so Accessibility
  and Screen Recording permissions stay granted after an update. This update
  changes the signature once: allow both again (or press Reset in
  Settings > AI control) after installing it.
- Minor dependency updates (playwright-core, ws, autoprefixer, postcss).

## [1.2.1] - 2026-11-16

### Added
- macOS first-run setup in the Allow window: "Open System Settings" for each
  permission, each row turns green by itself once allowed, and Screen Recording
  offers "Reopen SuperAi".
- macOS "Reset" (Allow window and Settings > AI control) for a permission whose
  switch shows on but no longer counts, as happens after an update.
- The side browser plays videos (mp4, webm, mov) and opens a file outside the
  project after you click "Open this file".

### Changed
- Computer use is faster: screenshots take about 220 ms instead of 590 ms on
  Windows and go to the AI as JPEG (about 4x smaller); the first command no
  longer waits for the input helper to start.
- The AI cursor is drawn in full (click ring, shadow, label) and glides smoothly.

### Fixed
- Open sessions and chat history survive a power cut: a save interrupted by
  the computer turning off no longer leaves an empty list behind.
- macOS: clicking the Dock was taken for SuperAi and refused; typing on a
  slower Mac could paste the old clipboard instead of the text.

## [1.2.0] - 2026-11-16

### Added
- The AI has its own pointer with a label saying what it is doing ("Click",
  "Thinking…"), on screen during computer use and inside pages in Browser use.
- A stop key: while the AI controls the computer, Ctrl+Alt+Esc (⌘⇧Esc on macOS)
  stops it at once from anywhere, like the Stop button. If another app holds
  that key, a fallback is used and shown on the Stop button.

### Changed
- On Windows, computer-use clicks usually no longer take your mouse: buttons
  are pressed through accessibility, and when the real mouse is needed it is
  put back where you had it.
- Password managers, crypto wallets and banking apps are view-only for the AI.

### Security
- The AI never types into a password field; it asks you to type it yourself.
- Screenshots sent to the AI leave out SuperAi's own bar, glow and pointer.

## [1.1.0] - 2026-11-16

### Added
- Computer use asks for apps by name: the Allow / Deny window lists them with
  their level, and clicks and typing reach only those apps. Web browsers are
  view-only, terminals and code editors take clicks and scrolling only, and
  the AI can never control SuperAi itself. Settings lists the allowed apps.
- The AI can read an app as a short list of its buttons and fields and act on
  them without screenshots or moving the mouse (agent-desktop, bundled).

### Changed
- Updates download quietly and then offer "Restart to update"; a downloaded
  update also installs when you quit the app.

### Fixed
- The edge glow while the AI controls the computer is unbroken: no gaps at the
  corners, not hidden by the taskbar, and every edge pulses together.

## [1.0.49] - 2026-11-16

### Added
- Computer use asks first: an Allow / Deny window (this task or the whole chat)
  before the AI looks at or controls the screen. Deny is remembered briefly so
  the AI does not ask again at once; Settings > AI control lists allowed chats
  and can revoke them all.
- Every screen: the status bar with Stop and the edge glow show on each display,
  the AI can work on screen 2 and 3, and clicks land right at mixed scaling.
- New computer tools: drag, zoom, cursor position, wait, double/triple click.
- /goal and /boost can be sent from chat; slash commands reach the AI as typed.
- The Microsoft Store build says when a newer version exists.

### Fixed
- The AI's browser reaches same-origin iframes and open shadow roots, page
  confirm()/prompt() no longer freeze it, typing no longer drops the last
  letter, and tabs can be picked by number.

## [1.0.48] - 2026-11-13

### Added
- Computer use (opt-in): with "Let the AI control this computer" turned on in
  Settings > AI control, the AI can see the screen, click, type in any language,
  press key combinations and scroll to work in other apps. A bar with a Stop
  button shows while it acts.
- The AI can also use Google Chrome or Microsoft Edge on the computer, in its
  own window with a SuperAi profile that keeps sign-ins.
- The installer, Setup and the uninstaller come in English, Japanese, Chinese
  and Thai; the language chosen there is the app's starting language. The tray
  menu and update messages are translated too.

### Changed
- Account choice: once you have accounts of your own, the computer's original
  login is no longer offered and the first account you added is the default.
  The picker shows your accounts as buttons.

## [1.0.47] - 2026-11-13

### Added
- The whole app is available in English, Japanese and Chinese as well as Thai:
  every screen and every message. The first run uses the computer's language
  (English when it is not one of these), and the getting-started screen has a
  language picker.
- The AI can use the browser panel inside the app: Claude, Codex and OpenCode
  can open pages, read them, click, type, choose options, scroll and take
  screenshots while you watch. Nothing to set up.
- MCP servers can be added by pasting the usual "mcpServers" JSON, to several
  AIs at once.

## [1.0.45] - 2026-11-12

### Fixed
- With a side panel open, the row under the message box wrapped into three rows
  and left the options icon alone on the last one. It is now two full rows.

## [1.0.44] - 2026-11-12

### Changed
- Closing the window now hides the app in the system tray instead of quitting, so
  background work keeps running. Click the tray icon to reopen it; choose Exit in
  the tray menu to quit.

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
