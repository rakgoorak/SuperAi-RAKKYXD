# Conversation workspace redesign

The user requests a complete visual refresh, suggestions after an answer instead of Tab completion, and a slash picker that does not obscure the workspace. Continue the approved Claude-like minimal direction recorded in `docs/minimal-workspace-design.md`; the new request explicitly replaces the ghost-completion interaction.

## Product and visual direction

Thai-first Windows/macOS Electron workspace with real Code, Agent and Chat modes, projects, sessions, terminals, Preview, history, voice dictation, attachments, accounts and model controls. Preserve all existing capabilities and SuperAi & RAKKYXD assets. Use the bundled Noto Sans Thai, warm charcoal canvas, quieter sidebar, readable paper text and restrained clay actions. Operate mode: clear hierarchy and familiar controls take priority over decoration.

One compact application header contains the brand and mode selector. A collapsible project rail contains project/session navigation and utility actions. A single workspace toolbar contains project context and actions. Conversation and composer share an aligned reading column. Independently scrolling conversations keep the composer stable. Multi-session grids and terminals retain their controls and resize behavior.

Use one token system for sidebar, toolbar, conversation, Code/Agent/Chat configuration, Preview, history, Skills, setup and settings. Replace competing visual declarations where practical rather than add another stylesheet. Small controls use 8px radii; input surfaces 12–16px; 14px interface text and 15px Thai conversation text. Neutral surfaces carry hierarchy. Semantic errors and availability remain based on actual state.

## Suggestions after a completed response

Remove ghost text, the Tab badge and interception of Tab to complete ordinary drafts. Tab returns to normal keyboard navigation. After the latest successful answer, show at most three compact actions beneath that answer, headed “ทำต่อจากคำตอบนี้”. Hide during work, on errors, when disconnected or viewing search results. Do not show generic next steps in an empty conversation.

Derive actions from the actual answer: explicit next-step recommendations when present, otherwise relevant contextual actions for plans, code changes or test results. Do not expose internal instructions or code fragments as a recommendation. Selecting an action fills and focuses the existing composer for review; never auto-send or execute it. The Code action targets its own session. New user messages remove old suggestions. Agent and Chat use their own latest completed run, including main/panel output where applicable. Failed runs retain existing retry/error recovery.

## Slash picker

Anchor a bounded popup above the composer. Width at most 520px and the available viewport; height at most 320px and available space. Keep scrolling inside the options list. Each row contains an intact skill name and a truncated, single-line description, with full selected detail available separately. Preserve all provider skills; search filters by name and description. Up/down navigate, Enter selects, Escape and outside interaction dismiss. Selecting a skill only updates the draft. Avoid capturing Tab; do not consume Enter without a selectable choice. Support loading, failure and empty results. Use combobox/listbox semantics and restore focus naturally.

## Acceptance

- Opening `/` with 100 long-description skills leaves the composer visible and produces no document overflow at 1440×900 and 1000×760.
- Clicking outside/Escape closes the popup; keyboard navigation and provider skill selection still work.
- Ordinary typing/Tab never inserts a suggestion; completed replies show contextual suggestions and selecting one never sends it.
- No suggestions for a blank/running/error conversation; switching sessions does not leak a suggestion to the wrong session.
- Production build, focused suggestion tests, session-control smoke and desktop/team checks validate retained flows.
- Capture representative Code, Agent, Chat, settings and narrow screenshots; fix functional/layout defects in one bounded pass.
