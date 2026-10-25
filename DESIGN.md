---
name: SuperAi & RAKKYXD
description: Thai-first conversation workspace for several AI CLIs, using warm charcoal, paper text and restrained clay actions.
colors:
  base: "#242422"
  surface: "#2b2b29"
  raised: "#333331"
  selected: "#3b3b38"
  border: "#363633"
  control-border: "#484844"
  text: "#e9e8e3"
  secondary-text: "#c6c5be"
  dim: "#aaa9a2"
  accent: "#d9a080"
  accent-hover: "#e7b297"
  on-accent: "#28211d"
  focus: "#bcac94"
  running: "#91bf9f"
  pending: "#d4b97f"
  error: "#edb3a3"
typography:
  body:
    fontFamily: '"Noto Sans Thai", "Segoe UI", sans-serif'
    fontSize: "14px"
  conversation:
    fontSize: "15px"
    lineHeight: 1.9
  controls:
    fontSize: "12px"
  code:
    fontFamily: '"Cascadia Code", Consolas, monospace'
rounded:
  control: "8px"
  popup: "12px"
  composer: "16px"
  dialog: "16px"
---

# SuperAi & RAKKYXD conversation workspace

Implemented 2026-10-24. The user's request replaces Tab ghost completion with next steps beneath completed answers and asks for a complete UI refresh. The visual direction continues the approved Claude-like minimal workspace recorded in `docs/minimal-workspace-design.md`. Product requirements live in `PRODUCT.md`.

## Visual system

Warm charcoal surfaces establish application hierarchy. The sidebar and titlebar use #20201e; the canvas uses #242422; forms use #2b2b29. Paper text and a restrained clay send action support reading. Selection uses neutral raised surfaces. Semantic colors represent actual running, pending and failed state. Retain original SuperAi & RAKKYXD logo/wordmark assets and bundled Thai fonts. Use one sans family for application content; monospace belongs to code and terminal output.

`minimal-workspace.css` owns the shared tokens and the final visual decisions for navigation, welcome, conversations, Agent/Chat forms and results, Preview, Skills, settings, setup, history and project/session dialogs. Its application selectors are scoped to `#root` so existing layout rules cannot override those decisions by accident. `composer.css` owns the shared writing surface, provider controls, answer actions and slash popup. Existing `index.css` and `mission-control.css` retain supporting layouts and behaviors; obsolete ghost/suggestion-chip rules were removed.

## Application frame

The 54px titlebar contains the brand and centered Agent/Code/Chat selector. Updated 2026-10-25 from the user's Claude reference: the selector is three 30px icon buttons in a compact neutral group, with accessible mode names, tooltips and pressed states. Electron's native titlebar height remains unchanged. The project rail is 232px by default, 208px below 1200px and progressively narrower below that. It retains project search, nested sessions, history, setup, Skills and settings, and can be hidden.

The workspace toolbar is 48px high with project context and compact icon actions for usage, status, files, Preview, session creation and a new conversation. Code omits the redundant mode label in its breadcrumb. The footer is 26px; the redundant long project path is visually suppressed because the composer already exposes its folder. Conversations, session grids and utility panels scroll independently. Single chat sessions omit redundant layout headings. Multiple sessions retain tabs, grids, reordering, resizing and zoom. The terminal layout has `min-width: 0` and a 100% maximum so it shrinks when Preview opens.

The welcome surface uses actual provider availability and launch actions, plus keyboard-accessible Agent and Chat entry points. It replaces the previous promotional card grid.

Updated 2026-10-25: the welcome provider chips select the next conversation's AI. The existing composer accepts a first prompt immediately; Send creates a dormant chat session using saved model/effort without a configuration dialog. Quick conversations start read-only with a visible explanation. A failed first send retains its draft and attachments and reuses its created session on retry. Pending-session metadata and draft aliases persist so first-send recovery also works after reload; pending file objects remain in memory as before. New-conversation drafts remain scoped per workspace, with an alias only when creating the first app-managed workspace. Terminal-only providers and bulk launches retain the explicit session dialog. Setup offers general chat in an app-managed folder without requiring a user project folder.

New installations default to tabs and a closed Preview; saved preferences take precedence. Empty and single-session workspaces omit the layout heading, while multiple sessions and hidden-session recovery retain it. Single-session tabs are omitted. Provider badges appear in the sidebar, tabs, grid headers and composer independently of conversation names; quick rooms take their title from the first prompt. The shared frame remains warm charcoal, with restrained color only on provider marks.

History opens as one recent destination per Code session or Agent/Chat workspace. A search returns individual matching messages and includes team answers. Provider/mode filters and explicit reload support both views. Selecting a hidden session from history restores it. Provider details describe the actual CLI connection and attachments; permission labels explain Codex's combined editing/command scope and OpenCode's configured agent instead of implying identical capabilities or per-tool approval.

## Conversations and composing

The composer is centered at a maximum width of 780px. Reading columns align with it. Conversation text uses 15px type with 1.9 line height; user messages use quieter raised surfaces. Folded tool activity remains available. Thai combining marks and normal IME composition are preserved.

All modes share a gently rounded writing surface, attachment row and action rail. Code retains per-session model, effort and account controls. Multi-AI Chat groups its per-message models and accounts behind “ตัวเลือกข้อความ”; the menu closes on Escape or outside interaction. Voice dictation, attachments, stop, explicit send and expanded multiline editing remain available.

The minimal refinement keeps provider and model visible in Code, and groups effort, permission, account and provider details behind one `ComposerOptions` disclosure. Account problems add an explicit attention label to that control. The popup stays inside the work canvas, scrolls internally, closes outside or with Escape and restores focus to its summary. Quick conversations use the same disclosure. Pinning becomes a compact icon aligned with the composer, with its explanatory tooltip retained.

`minimal-interface.css` owns the final shared refinement across the frame, sidebar, welcome, conversations, team results, history, settings, setup, Skills, usage, files, Preview and artifacts. It follows the existing layout and state owners. Lists and repeated content use flat rows and restrained separators; form fields have quiet filled backgrounds, popovers remain opaque, and dialogs have a single boundary. Usage bars retain semantic low/warning colors without neon gradients. No functional tool, error, loading state, account requirement or permission option is removed.

Ordinary Tab navigation never completes the user's draft. No ghost text or Tab badge is rendered.

## Next steps beneath answers

Show “ทำต่อจากคำตอบนี้” beneath the latest successful answer, with no more than three actions. Extract explicit recommendations from Thai/English next-step sections or conversational offers. Plans and code changes can receive a relevant fallback; unrelated answers receive no fabricated action. This is deterministic text extraction, not an additional model request.

Actions appear only after completion. In Code they are hidden while working, pending, disconnected, searching, after an error, or when a newer user message has no answer. Agent and Chat use their own latest completed run. Failed turns keep their existing recovery actions.

Selecting an action fills and focuses the existing composer for review. It does not send a message or execute work. Code actions target their originating session and keep the compact composer. Message editing can still expand the composer.

Completed answers use a compact shared `ResponseActions` row: copy with confirmation, regenerate, and an overflow for editing the original prompt or inspecting changes. Copy failures have an actionable message. Overflow closes on outside interaction, Escape or keyboard focus leaving the menu. File changes and Preview are distinct; Code exposes changes for turns reporting edit tools, while editable Agent runs can inspect project changes. Successful replies have no generic recovery footer. Failed Code turns retain an explicit retry action. Agent/Chat regeneration locks all submission controls through the POST and inserts the accepted run into shared state before unlocking, retaining the original team, model settings, attachments and tool permissions.

Follow-up suggestions use restrained text rows with arrows, separate from response controls. They retain the draft-only behavior. The Claude Desktop/web reference describes conversation interaction and layout; actual capabilities still come from each provider. This correction does not claim complete Claude feature parity.

## Slash search

The popup is portalled into the document body and fixed above the input. It is at most 520px wide and 320px high, further limited by the viewport and space above the input. Only its list scrolls. Names remain on one line, descriptions truncate, and the full description is available on hover.

Preserve the provider's discovered skills and implemented commands. Search matches names and descriptions. Up/down select, Enter inserts, Escape closes, outside interaction dismisses, and Tab moves focus without inserting. Combobox expanded/active-descendant metadata points to the listbox. Loading, empty results and errors remain visible within the popup.

## Clickable answer links and file Preview

Markdown links and bare HTTP(S)/www URLs are interactive. They open the right-side Preview while preserving the conversation. Websites use the existing native Chromium view in Electron, with the iframe fallback and explicit external-open button in the browser renderer.

Local links open an image/PDF/text viewer in that same panel. Resolve files through the currently registered project, including Windows absolute paths, encoded spaces and source line references. Keep filenames visible, use contained image sizing by default, and provide reload/download controls. Show useful loading and missing-file states. Files outside the project are rejected; HTML is shown as text. Hide the native website view whenever a local file is active so it cannot cover the file viewer or application dialogs.

## Forms, overlays and accessibility

Settings, setup, Skills, history and project/session forms share opaque neutral surfaces, 8px fields, 16px dialog corners and consistent title/action spacing. Errors retain actionable text. Dialog focus management, keyboard access, reduced-motion preferences and existing permission controls remain in place. Menus use softer shadows; ordinary work areas rely on neighboring tones and separators.

## Verification

Renderer fixtures and screenshots are in `output/conversation-workspace/`; run `npm run test:conversation-ui` after building the client. These fixtures make no real provider calls. Focused tests cover recommendation extraction, model/effort persistence, session isolation and skill discovery. Native Electron smoke verification is limited by a GPU-process crash in the current execution environment; browser renderer checks do not substitute for native window integration.
