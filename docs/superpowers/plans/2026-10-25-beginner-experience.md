# Beginner experience implementation

User request: make skills discovery useful without typing first; simplify onboarding and the main workspace for people unfamiliar with developer tools.

## Design

Preserve the incumbent Noto Sans Thai/Segoe UI and dark palette: base #222220, surface #2b2b28, raised #33332f, text #eeede7, secondary #d0cec3, accent #d9a080. Task content stays left aligned. Use a real three-step sequence, one primary action at a time, and collapse optional/technical choices rather than displaying every system detail together.

```
Getting started
[1 Folder] [2 AI assistant] [3 First conversation]
Current step: clear purpose, actual readiness, next action
Details and optional features (collapsed)
```

Skills discovery must distinguish starter recommendations from live skills.sh search results. Reuse the real official app catalog as the immediately available starter list; do not invent rankings or installation counts. Category buttons run explicit searches. Installation remains an explicit per-skill action. Installed items and AI-assisted recommendations become expandable sections so the browsing area is visible immediately.

## Work

- [x] SkillsPanel: starter list, category shortcuts, independent search error/retry/empty states and submitted-query tracking.
- [x] SkillManager: report network/search failures rather than masquerading as zero matches; test with HTTP fixtures.
- [x] SetupGuide: three focused steps, choose one workspace/assistant, show only that assistant's account state, safe default model behavior, technical details and extras collapsed.
- [x] App: start one assistant using the selected workspace, preserve an existing session when available, do not send a prompt automatically. Explain Agent/Code/Chat in Thai while keeping their established names.
- [x] WorkspaceWelcome/SeatPicker: explain the first action and model/effort with familiar words; keep advanced functionality reachable.
- [x] Run meaningful focused tests for setup states, discovery without a query, search errors/retry, manual installation, default settings, first session and scope. Build and inspect desktop/narrow screenshots in a bounded pass.

## Constraints

No real installations, logins, paid provider calls or changes to active user jobs during validation. User actions remain necessary for installation, login and starting work. Preserve concurrent edits. Avoid a separate global beginner/expert settings system; progressive disclosure is enough for this change.
