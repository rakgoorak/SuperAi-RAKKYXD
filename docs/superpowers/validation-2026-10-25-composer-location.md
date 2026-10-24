# Composer folder, branch and attachment placement

The attachment button now comes before model/account controls. A compact context row above the composer shows the directory configured for its selected Code session and the branch read from Git in that directory. Agent/Chat use the workspace root. Sending to sessions with different directories shows a multi-folder label instead of a misleading shared branch. Paths/branches truncate with full values in tooltips; narrow layouts wrap controls.

Read-only context endpoints resolve registered workspace/session IDs, not user-supplied paths. Git runs with argument arrays, bounded output/time, and hidden windows. Unborn branches, detached HEAD, nonrepositories and unavailable Git have distinct results. No ownership exceptions or global Git configuration are applied. The UI refreshes on selection, focus and every 15 seconds; old requests are aborted on context changes. The directory reflects session configuration, not subsequent shell `cd` commands inside a Terminal.

Validation: client and server builds passed. `composer-location-smoke.mjs` passed 11 browser checks against the production client, covering attachment order/menu, session and mode switching, multiple folders, narrow layout, no automatic sends, and renderer errors. `working-context.test.ts` passed using isolated real Git repositories: no repository, unborn branch, a separate worktree branch, detached HEAD, nested directories, inaccessible directory, and unchanged worktree status after reads. The fixture limits parent repository discovery with GIT_CEILING_DIRECTORIES; it does not bypass Git ownership checks.

Screenshots inspected: `output/composer-location/desktop.png`, `narrow.png`. No installer/release was created.

