# Task 1 Brief: Backend Git Operations for Side-by-Side Diff & File Actions

## Project Context
SuperAi Studio server (`packages/studio/server`) manages workspace files and Git tracking.
We need backend capabilities to support a rich Visual Side-by-Side Diff Viewer and File Explorer:
1. `projectFile(root, name)` must return `originalContent` (from `HEAD:${name}`) in addition to current `content` and unified `diff`.
2. Git file manipulation helpers: `stageFile`, `unstageFile`, `discardFileChanges`, and `saveProjectFile`.
3. REST endpoints in `StudioServer.ts` under `/api/workspaces/:wsId/files/...`.

## Files to Touch
- Modify: `packages/studio/server/ProjectChanges.ts`
- Modify: `packages/studio/server/StudioServer.ts`
- Test: `packages/studio/test/changes.test.ts` (or `packages/studio/test/project-changes.test.ts`)

## Detailed Requirements
1. In `packages/studio/server/ProjectChanges.ts`:
   - Extend `projectFile(root: string, name: string)`:
     ```ts
     const head = await git(base, ['rev-parse', '--verify', 'HEAD']).then(() => true, () => false);
     const originalContent = head
       ? await git(base, ['show', `HEAD:${name}`]).catch(() => '')
       : '';
     ```
     Return `{ name, content, originalContent, diff, deleted: !real }`.
   - Export `async function stageFile(root: string, name: string): Promise<boolean>`
     Resolves and validates `name` inside `root`, runs `git add -- <target>`, returns `true`.
   - Export `async function unstageFile(root: string, name: string): Promise<boolean>`
     Runs `git restore --staged -- <target>`, returns `true`.
   - Export `async function discardFile(root: string, name: string): Promise<boolean>`
     Runs `git checkout HEAD -- <target>`, if error (e.g. untracked), removes file via `fs.unlink(target)`.
   - Export `async function saveProjectFile(root: string, name: string, content: string): Promise<boolean>`
     Validates `name` is inside `root`, writes `content` using `fs.writeFile(target, content, 'utf8')`.

2. In `packages/studio/server/StudioServer.ts`:
   Register endpoints:
   - `POST /api/workspaces/:wsId/files/stage` (body: `{ filePath: string }`)
   - `POST /api/workspaces/:wsId/files/unstage` (body: `{ filePath: string }`)
   - `POST /api/workspaces/:wsId/files/discard` (body: `{ filePath: string }`)
   - `POST /api/workspaces/:wsId/files/save` (body: `{ filePath: string, content: string }`)
   Handle missing workspace (404) and errors (400) consistently.

3. Testing:
   - Add automated tests in `packages/studio/test/` to verify these functions in an isolated git repo fixture.
   - Ensure all existing tests in `packages/studio` pass.

## Report Contract
Implementer must write report to `.superpowers/sdd/2026-10-24-unified-provider-hub/task-1-report.md` with:
- Status: DONE / BLOCKED
- Commits made
- Test summary
- Any concerns or notes
