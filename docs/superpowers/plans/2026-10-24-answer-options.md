# Answer options

Approved behavior: show up to three actions explicitly offered by the completed AI answer. Show only the available actions; hide the entire footer when there are none. Clicking fills the draft without sending. Apply consistently to Code, Agent and Chat.

Implementation:
- [x] Update `packages/studio/client/src/suggestions.ts`: remove inferred plan/review fallbacks, recognize explicit Thai/English option lists, preserve ordering and deduplication, stop at the next section, and allow three conversational offers.
- [x] Update `packages/studio/client/test/suggestions.test.ts`: cover zero, one, two, three, excess and duplicate choices; explicit options; section boundaries; unsupported code snippets; and mode consistency.
- [x] Run `node node_modules/tsx/dist/cli.mjs --test packages/studio/client/test/suggestions.test.ts`, `npm.cmd --workspace=@superai-rakkyxd/client run build`, and `node packages/desktop/test/conversation-workspace-smoke.mjs`. Results: 11 unit tests passed, client build passed, 48 renderer checks passed. The renderer checks verify three explicit options, hiding when no offer exists, and selection filling the draft without submitting.

No new provider request or dependency is needed. `NextSteps` already hides an empty list and fills the draft on selection.
