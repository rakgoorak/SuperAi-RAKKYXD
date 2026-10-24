# Task 1 Report: Backend Git Operations for Side-by-Side Diff & File Actions

## Status
**DONE**

## Summary of Changes
1. **`packages/studio/server/ProjectChanges.ts`**:
   - Extracted shared target validation helper `validateProjectTarget(root, name)` which safely resolves paths inside the project root, prevents path traversal (`..`), and checks ancestor paths against symlink escaping even for deleted or newly created files.
   - Extended `projectFile(root, name)`:
     - Verifies whether `HEAD` exists via `git rev-parse --verify HEAD`.
     - Retrieves `originalContent` from `HEAD:${gitPath}` (normalized with forward slashes for Windows compatibility).
     - Returns `{ name, content, originalContent, diff, deleted: !real }`.
   - Exported `stageFile(root, name): Promise<boolean>`:
     - Validates target within project boundaries and runs `git add -- <target>`.
   - Exported `unstageFile(root, name): Promise<boolean>`:
     - Validates target within project boundaries and runs `git restore --staged -- <target>`, with fallback to `git rm --cached -- <target>` if `HEAD` does not exist yet.
   - Exported `discardFile(root, name): Promise<boolean>` (and alias `discardFileChanges`):
     - Validates target within project boundaries.
     - Runs `git checkout HEAD -- <target>`.
     - If not in `HEAD` (untracked or newly added file), cleans index via `git rm -f -- <target>` or unlinks via `fs.unlink(target)`.
   - Exported `saveProjectFile(root, name, content): Promise<boolean>`:
     - Validates target and string content, creates parent directories recursively if necessary, and writes file with `fs.writeFile`.

2. **`packages/studio/server/StudioServer.ts`**:
   - Imported new helpers (`stageFile`, `unstageFile`, `discardFile`, `saveProjectFile`).
   - Registered REST endpoints under `/api/workspaces/:wsId/files/...`:
     - `POST /api/workspaces/:wsId/files/stage` (`{ filePath: string }`)
     - `POST /api/workspaces/:wsId/files/unstage` (`{ filePath: string }`)
     - `POST /api/workspaces/:wsId/files/discard` (`{ filePath: string }`)
     - `POST /api/workspaces/:wsId/files/save` (`{ filePath: string, content: string }`)
   - Returns 404 if workspace does not exist.
   - Returns 400 for missing path, invalid content, or path traversal security errors.

3. **`packages/studio/test/project-changes.test.ts`**:
   - Added unit test cases for `originalContent` on modified, deleted, and untracked files.
   - Added tests for `stageFile`, `unstageFile`, `discardFile`, and `saveProjectFile` with path traversal rejection.
   - Added full integration tests against running `StudioServer` ephemeral port instance verifying all 4 REST endpoints and error codes.

## Commits Made
- `3c46068`: `feat(studio): add backend Git file actions and originalContent for diff`

## Test Summary
- Command: `npm --workspace=@superai-rakkyxd/studio run test`
- Total Tests: 139 passed, 0 failed (100% passing across the entire studio package test suite)

## Notes & Concerns
- Windows Git path handling: When querying `git show HEAD:<path>`, paths with backslashes (`\`) fail on Windows Git object specs. Paths are explicitly normalized using forward slashes (`/`), ensuring seamless cross-platform support.
- Safe path traversal & symlink prevention: Ancestor traversal check is maintained across all new file operations so that non-existent files (such as newly created files to be saved or deleted files being checked/discarded) cannot bypass sandbox directory boundaries via symlinked parent directories.
