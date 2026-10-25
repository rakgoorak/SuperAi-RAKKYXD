# Minimal Interface Implementation Plan

**Goal:** Apply the user's compact Claude-like reference across the entire existing application.

**Spec:** `docs/superpowers/specs/2026-10-25-minimal-interface-design.md`

**Architecture:** Refine the existing shared tokens and CSS owners. Add one reusable composer options disclosure and preserve the current state/data flows. Execute inline using the user's explicit instruction to adjust all UI; retain existing working-tree changes.

- [x] Replace text-heavy mode controls with three icon buttons, tooltips and pressed states; simplify the shell toolbar, welcome and dock navigation.
- [x] Add a shared options popover and fold non-primary session controls into it, keeping provider/model visible and account problems discoverable.
- [x] Apply restrained colors, flatter surfaces, quieter borders and consistent spacing to sidebar, conversations, forms, history, settings, setup, Skills, usage, files, Preview, artifacts and team drawers.
- [x] Add visual/interaction coverage for the compact switch, disclosures, representative panels and narrow layouts; adapt existing tests to explicit disclosure where required.
- [x] Build, run affected browser regression suites, inspect screenshots, fix observed problems and update DESIGN.md and validation evidence. Native Electron startup could not be validated; see the validation note.

Validation: `docs/superpowers/validation-2026-10-25-minimal-interface.md`.
