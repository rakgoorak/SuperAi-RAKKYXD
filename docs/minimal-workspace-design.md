# Minimal writing workspace — 2026-10-24

Direction approved by the user: Claude-like minimal interaction rather than the previous Mission Control dashboard treatment.

Palette: charcoal #1c1c19, sidebar #181815, surface #252521, stone border #41413b, paper text #e9e7df, muted clay #d3997e. Retain bundled Noto Sans Thai for Thai readability and Cascadia/Consolas for code.

Hierarchy: project navigation → conversation → one writing surface. Single chat omits the extra layout toolbar and panel outline; multiple panes retain layout controls. Conversation text stays near 760px width. Composer has a 780px maximum, a writing area and a single quiet model/effort/action rail. Account details expand on demand and close with Escape. Slash skills remain searchable above the composer. Success notices appear near the top of the workspace rather than across the writing area.

Dialogs use a shared charcoal surface, 18px radius, restrained title/body hierarchy, consistent fields, neutral cancel and clay primary action. Settings keep category navigation and the existing keyboard focus handling. Destructive actions remain distinct.

Relevant installed skills verified through find-skills: anthropics/skills frontend-design and vercel-labs/agent-skills web-design-guidelines. No new installation needed.

Validation: client production build; desktop smoke 16 checks; session controls smoke covers model/effort/skills, session switching, account details and Escape, slash menu and responsive overflow. Team smoke covers Agent/Chat flow.

Remaining future work: consolidate the older CSS layers into one component/token system, add broader real-provider reconnect/retry coverage and refine artifact/file previews. Visual similarity does not imply that provider-specific Claude commands are supported by other CLIs.
