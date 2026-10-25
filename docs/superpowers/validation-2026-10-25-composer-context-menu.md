# Functional composer folder and branch menus

The previous folder/branch labels were static status text. They are now compact buttons below the writing box, using the existing charcoal theme and short folder names with full-path tooltips. The bounded popover opens above its trigger and adapts to narrow screens. The project list selects a registered workspace through the app's existing draft routing. “เพิ่มหรือเปิดโฟลเดอร์…” opens the existing project setup flow. Branch opens a searchable list of real local Git branches for the selected session directory (workspace root in Agent/Chat). Worktree opens the existing manager; selecting an existing worktree opens/registers its folder as a workspace without moving an existing session or sending a prompt.

Branch switching calls dedicated workspace/session endpoints. The server resolves directories from registered IDs and rejects stale directory selection. Only known local branches can be switched. Dirty directories, branches already checked out in another worktree, and active app work are refused. Git uses argument arrays with no force, reset, stash, auto-commit or fetch. During a branch switch the server temporarily blocks other mutation requests; a pending chat authentication flow also rechecks the switch guard before sending. The active-work check is conservative across the app, including other projects' running terminals/jobs.

Keyboard Escape, explicit close, outside click and focus return are supported. Opening menus performs reads only. Errors remain visible beside retry. Switching projects restores scoped drafts; changing branch keeps the current unsent draft. Multiple recipient directories do not offer a misleading common branch selection. Unsupported provider-specific permission/fast-model options from the reference screenshots were not added as inert controls.

## Validation

- Client and Studio server TypeScript/production builds passed.
- `node packages/desktop/test/composer-location-smoke.mjs`: 24 browser checks passed against the production client. Covers project destination changes, isolated draft restore, branch read/search/explicit switch, refusal/error state, Escape/focus, outside dismissal, narrow popover geometry, functional Worktree manager, Code/Agent/Chat context, attachment order and no automatic sends. Backend HTTP responses are mocked in this browser fixture.
- `node --import tsx --test packages/studio/test/branch-selection.test.ts`: 2 tests passed using real isolated Git repositories and the real Studio HTTP server. Covers listing, clean switching, dirty-work preservation, unknown/option-like names, other-worktree refusal, nested directories, endpoint ID/type checks, stale directory rejection, and active-work refusal.
- `git diff --check` passed.
- Inspected screenshots: `output/composer-location/folder-menu.png`, `branch-menu.png`, `desktop.png`, `narrow.png`.

No branch was switched in the user's real repository, no prompt was sent to a real provider, and no release/installer was produced. The new branch endpoints require restarting the backend/app from the current build. Folder paths continue to reflect session configuration, not subsequent shell `cd` commands.
