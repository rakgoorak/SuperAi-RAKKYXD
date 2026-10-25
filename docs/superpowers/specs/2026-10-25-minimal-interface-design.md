# Minimal interface refinement

The user requests the entire UI be minimal and supplies the current three-mode switch and a compact Claude icon switch as references. This authorizes refinement of all existing surfaces, while retaining all three modes and existing behavior.

Direction: a warm dark canvas, a compact three-icon mode switch, neutral selection states, flat navigation and lists, restrained separators, and readable Thai typography. Keep the existing bundled fonts and original brand; reduce the prominence of branding inside task surfaces.

- Keep Agent/Code/Chat as accessible icon buttons with clear tooltips and pressed states. Retain the native 54px titlebar/window-control area.
- Make toolbar utilities compact icon actions with accessible names. Use one small active treatment, avoiding borders around every button.
- Flatten sidebar, welcome choices, conversation containers, tool activity, session tabs and dock panels. Preserve visible focus and semantic error/running states.
- Keep provider and model visible in the composer. Fold effort, permissions, account information and capability details into one keyboard-accessible options popover. Warn visibly when the account needs attention.
- Refine history, settings, setup, Skills, team drawers, usage, file browser, Preview and artifact surfaces through shared tokens and scoped styles. Use spacing and subtle separators instead of nested cards.
- Preserve file/image previews, attachments, slash search, per-room drafts, permission choices, cancellation, retries, team configuration and existing data.

Use the existing visual system with refined shared rules, rather than a separate page/theme for every feature. Validate at 1440×900 and 1024×768, and retain narrow/mobile regression coverage from the existing suites. Fixture tests do not establish live provider feature parity.
