# Consistent Usage presentation

All provider groups now display five-hour limits first, followed by weekly limits. Stable sorting preserves weekly model scopes, provider group names, disabled limits and their matching percentages. Raw API data is unchanged.

Reset times use `รีเซ็ต: <day> <Thai short month> <24-hour clock> (<timezone>)`. ISO timestamps are formatted in the browser's timezone. Recognized Claude display dates are translated while retaining their explicit timezone; their missing year is not guessed. Unrecognized display text is retained and invalid machine timestamps do not throw. Provider freshness labels share the prefix `อัปเดต`.

Validation:

- Client TypeScript/Vite build passed.
- `node --import tsx --test packages/studio/client/test/usage-display.test.ts packages/studio/test/usage.test.ts`: 8 passed.
- `node packages/desktop/test/usage-smoke.mjs`: 7 passed, no renderer errors. Uses deterministic quota fixtures, without starting real provider CLIs.
- Inspected `output/usage/consistent-desktop.png` for the three providers and their reset labels.
- `git diff --check` passed.

The broader conversation renderer suite stopped before reaching Usage: its existing response-options Tab-out assertion timed out at `conversation-workspace-smoke.mjs:279`. ResponseActions and composer CSS are under concurrent modification and were preserved. No claim is made that the full renderer suite passed for this change.
