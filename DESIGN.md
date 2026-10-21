---
name: SuperAi & RAKKYXD
description: Compact Thai desktop workspace for several AI CLIs; SR logo, green-teal-blue brand on blue-black.
colors:
  base: "#0c1116"
  surface: "#10181f"
  raised: "#152029"
  border: "#1e2d38"
  text: "#e1e8ee"
  dim: "#a0afbd"
  accent: "#74b3fb"
  brand-green: "#30f457"
  brand-teal: "#00b89c"
  brand-blue: "#1a8cff"
  primary: "#30f457"
  primary-hover: "#1a8cff"
  primary-text: "#04140f"
  secondary: "#26323d"
  secondary-text: "#dfebf5"
  hover: "#25303b"
  running: "#3ddc84"
  pending: "#edcb86"
  error: "#f398a3"
  offline: "#83929f"
  danger: "#a93e48"
  terminal: "#0a0d14"
  dictation-recording: "#f4a6a6"
typography:
  body:
    fontFamily: '"Noto Sans Thai", "Segoe UI", sans-serif'
    fontSize: "14px"
  headline:
    fontFamily: '"Noto Sans Thai", "Segoe UI", sans-serif'
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Noto Sans Thai", "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 500
  message:
    fontFamily: '"Noto Sans Thai", "Segoe UI", sans-serif'
    fontSize: "13px"
    lineHeight: 1.9
  label:
    fontFamily: '"Noto Sans Thai", "Segoe UI", sans-serif'
    fontSize: "12px"
  terminal:
    fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, "Courier New", monospace'
    fontSize: "13px"
rounded:
  tab: "5px"
  icon: "6px"
  button: "7px"
  control: "8px"
  composer: "10px"
  dialog: "14px"
spacing:
  tight: "4px"
  small: "8px"
  control: "12px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "white"
    rounded: "{rounded.button}"
    padding: "10px 15px"
---

# Design System: SuperAi & RAKKYXD

## Overview

**Creative North Star: "The Graphite Workspace"**

The approved direction is a compact, Thai-first working environment: graphite planes, readable cool text, restrained sky-blue actions, and visible operational status. The project rail, working canvas and website Preview share one desktop frame. SuperAi Voice & RAKKYXD is a separate companion window with the same palette and a simpler form layout.

**Key Characteristics:**

- Functional density with stable navigation and independently scrolling work areas.
- Original SuperAi & RAKKYXD identity; compact symbols and agent initials support recognition.
- Actual projects, sessions and errors determine what the interface displays.

This document records the implementation on 2026-10-20. Sources: `packages/studio/client/src/App.tsx`, `index.css`, `components/PreviewPanel.tsx`, `components/TerminalPane.tsx`, `components/DictationButton.tsx` and `components/SetupGuide.tsx`. Product constraints remain in `PRODUCT.md`.

## Colors

The frontmatter records the core implemented values; graphite neutrals carry most of the screen. Sky blue marks primary actions, selected utilities and focus. Secondary actions use bordered slate surfaces. Small green, amber, pink-red and gray dots distinguish running, pending, failed and offline sessions; keep accompanying text wherever the state needs explanation.

**The Operational Color Rule.** Status color must follow real application state. Agent monograms may use muted identity tints; they do not signal availability by themselves.

The composer mic turns to the recording tint while it listens, with a ring that grows with input level.

## Typography

Studio bundles Noto Sans Thai at weights 400, 500 and 600, with Segoe UI fallback. Branding, URL fields and some technical tags use Segoe UI; terminal output uses the monospace stack above. The dictation menu uses the bundled Studio font.

The empty workspace heading is the largest Studio text: its documented default grows to (30px) at widths from (1600px), and contracts to (23px) below (1200px), then (21px) below (600px). Dialog headings use (20px); navigation and controls generally use (11–12px). Supporting status and metadata use (9–10px). Conversation copy uses generous line spacing for Thai.

**The Thai Legibility Rule.** Preserve Thai shaping and generous copy line height; do not force compact labels into uppercase or apply terminal typography to prose.

## Layout

Windows desktop is the primary platform, using Electron with a React/TypeScript renderer; Studio also exposes a browser workspace. A fixed-height shell contains the titlebar (40px), project rail, workspace toolbar (38px), flexible canvas and footer (28px). Overflow belongs inside lists, terminals, conversation and dialogs.

The project rail is (220px) by default, (240px) from (1600px), (210px) below (1200px), (180px) below (900px), and (155px) below (600px). The center combines a (34px) code section heading, mode-specific content and a persistent bottom composer. Terminal sessions support full-area tabs, a vertical stack and a two-column split, with a persisted layout choice. Split/stack panes have a minimum row height of (360px) and the canvas scrolls for additional sessions. Split adapts to one column when the actual canvas width is at most (900px), including when Preview is docked. Each pane can expand to the full canvas and restore the previous layout without remounting its terminal. The code-mode composer defaults to a compact (90px) area and expands on request without losing multiline text. Success notices float within the terminal canvas and dismiss after (4.5s); errors remain until dismissed. Conversation runs cap at (850px) wide.

Preview starts at (440px), has a (320px) minimum and a desktop maximum of (55vw), reduced to (40vw) below (1200px). Drag its left divider or use keyboard arrows in (24px) steps. Below (900px), Preview becomes a right overlay (420px), capped at (75vw), between the toolbar and footer. Narrow layouts progressively hide secondary labels; they retain the project rail rather than introducing a mobile navigation pattern.

The mic sits in the composer's trailing controls; its download prompt and right-click menu open above it as small popovers. The setup guide is a dialog list of numbered steps with trailing actions.

## Elevation & Depth

Studio uses one-pixel separators and neighboring dark tones to establish regions. Shadows are limited to the selected mode, modal dialogs, and narrow-screen Preview overlay. Dialogs use a dark translucent scrim and a short (180ms) upward entrance. Button hover transitions take (140ms); loading indicators rotate continuously. Studio disables animations and transitions for reduced-motion preference. The recording ring follows microphone level; reduced-motion removes its transition.

## Shapes

Small rounded tabs and icon buttons support the compact shell. Main controls are gently curved; the composer is slightly softer and dialogs more rounded. Agent initials sit in compact rounded squares. Circular shapes are reserved for status dots and the Preview empty-state globe. Avoid turning operational panels into floating decorative cards.

## Components

- **Project rail:** active project rows gain a slate fill and brighter text; nested sessions follow an indented vertical guide. Truncate long names and retain full working space in the center.
- **Modes and sessions:** the segmented control switches assistant, code and chat views. Its active segment is filled. Code mode shows real CLI terminals, with active tabs or a bordered focused grid cell. Session counts and availability come from application data.
- **Buttons and fields:** primary actions use light blue with dark text; secondary actions use slate plus a border; destructive confirmations use red. Standard Studio primary controls have minimum height (36px), compact ones (32px). Disabled buttons reduce opacity to (0.4), or (0.45) for primary and Voice controls. Preserve accessible names when a visible label is hidden.
- **Composer:** a bordered dark input surface, context selector and send/stop controls anchor the center. Focus changes the border; standard keyboard focus uses an accent outline (2px) offset by (3px). Controls disable when their prerequisites or pending operation require it.
- **Empty, pending and failure states:** empty workspace and conversation views give a concrete next action. Loading uses text and spinners. Success and error banners sit above the canvas; inline failures and dialog errors stay near their operation. Errors should expose a retry or actionable explanation rather than a sample success state.
- **Preview:** native Electron uses a Chromium view with real tabs, URL entry, back/forward, reload and external opening. Browser-only Studio uses an iframe and explains sites may refuse embedding. Empty and failed navigation views offer a next action. The native view is hidden while a dialog is open, when a tab fails, and when the panel unmounts, so it cannot cover renderer dialogs.
- **Dialogs:** centered, scrollable surfaces (560px wide; settings 640px) with titled headers, grouped fields and trailing footer actions. Destructive copy describes the affected data. Keep dialog focus handling and Escape dismissal intact.
- **Speak-to-type:** press and hold the composer mic to record and release to insert, or tap to start and tap to stop; right-click picks microphone and language. Recording, downloading and transcribing states are visible on the button and in its label. Text is inserted for review, never sent. The model download asks first and states its size.
- **Setup guide:** opens on first launch until dismissed; each step shows a real check result and, when missing, one action (install, add project, open CLI to log in). Install logs stream into the step.

Visual references are `output/playwright/superai-workspace.png`. The workspace renderer screenshot shows the Chromium toolbar but may omit the separate native browser surface: a blank captured rectangle does not establish that navigation failed. Verify native page content through the browser view separately.

## Do's and Don'ts

- Do preserve the Thai interface, original branding, graphite planes and restrained blue actions.
- Do tie counts, status, terminal output and assistant content to real state.
- Do keep focus visible and give empty or failed operations a useful next action.
- Do verify both the renderer and native Chromium surface when reviewing desktop Preview.
- Don't replace real sessions with sample activity or make decorative controls appear operational.
- Don't send dictated text automatically; the user reviews and sends it.
- Don't interpret a renderer-only screenshot as proof of native browser content rendering.


## Reference tiled workspace refinement

The seven user-supplied BridgeMind screenshots establish the updated structure: project rail, a quiet top mode switch, tiled live terminal seats, and a persistent right tool dock. SuperAi & RAKKYXD keeps its own sky-blue identity and Thai labels. The mode switch now sits in the 40px titlebar; the breadcrumb/action toolbar is 38px. Code mode hides the shared composer until requested, dictation arrives, or a saved prompt is applied. Direct CLI input remains primary.

The default auto layout fits up to four columns to available canvas width with a 180px minimum column target. Six seats form three columns and two rows when width permits; nine form four columns with a full-width final seat. Fitted rows have a 176px safety floor, allowing outer scrolling when the window cannot hold every row. User-selected stack/split modes retain the 360px floor. Splitters alter row/column weights with pointer capture or keyboard arrows; headers support drag reorder, keyboard-accessible move controls, pane labels, add, focus and close. All modes retain the same keyed TerminalPane instances beneath one parent.

RightDock owns width and contains a single mounted embedded PreviewPanel. Its tabs show actual process status, project tasks with explicit user completion, reusable prompts, and browser tabs. Browser native views are suspended for other dock tabs, collapsed dock, modals and dock resizing. No Context percentages, credits, completion or AI-thinking indicators are invented. Local saved state validates schema and reports storage failures. Presets launch actual installed CLIs through the existing server checks and preserve only unlaunched entries after a partial failure.

## Brand

Logo: the green "S" + white "R" mark with a blue orbit, and the "SuperAi & RAKKYXD" wordmark ("Ai" green, "XD" blue). Assets are generated from the brand sheet by `scripts/brand/make-icons.py` into `packages/desktop/assets` (app icons) and `packages/studio/client/public/brand` (mark, wordmark, favicons).

The brand gradient (`#30f457 → #00c2a6 → #1a8cff`, dark text `#04140f`) is reserved for brand moments: primary actions, the send button, the active mode underline and a 1 px titlebar hairline. Selection, links and focus use the blue accent; everything else stays neutral blue-black so the tool reads calmly.
