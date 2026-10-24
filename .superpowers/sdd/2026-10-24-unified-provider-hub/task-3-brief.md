# Task 3 Brief: Interactive Project File Explorer & Quick Editor

## Project Context
Developers frequently need to browse their project folder, view files, make quick edits, or pin important files to AI context without having to switch to VS Code or File Explorer.
This task adds an interactive File Explorer & Quick Editor to SuperAi Studio in the RightDock ('ไฟล์' tab).

## Files to Touch
- Create: `packages/studio/client/src/components/FileExplorerPanel.tsx`
- Create: `packages/studio/client/src/file-explorer.css`
- Modify: `packages/studio/client/src/components/RightDock.tsx`
- Modify: `packages/studio/client/src/App.tsx`

## Detailed Requirements
1. **`FileExplorerPanel.tsx`**:
   - Fetch files from `/api/workspaces/:wsId/files`
   - Fetch pinned files from `/api/workspaces/:wsId/pinned-content`
   - Transform flat file path list into nested tree structure:
     `TreeNode: { name: string, path: string, isDirectory: boolean, children?: TreeNode[], isPinned?: boolean }`
   - Search input filtering the tree in real time (auto-expanding matching paths).
   - Icons: `Folder`, `FolderOpen`, `FileCode`, `FileText`, `Image`, `Pin`.
   - Actions per file:
     - Click: open file in preview/quick editor
     - Pin button: toggle pin status via `POST /api/workspaces/:wsId/pinned-files/toggle`
     - Copy Path: copies relative path to clipboard
   - Quick Editor modal or side view:
     - Reads content from `/api/workspaces/:wsId/preview-file?path=...`
     - Displays text editor with line numbers and monospace font
     - "บันทึกไฟล์ (Save)" button calling `POST /api/workspaces/:wsId/files/save` `{ filePath, content }`

2. **`file-explorer.css`**:
   - Clean tree layout with indentation guides (`border-left: 1px solid var(--border)`).
   - Hover states for tree items, subtle action buttons.
   - Quick editor dialog/panel with line numbers, syntax-friendly styling, and save status.

3. **`RightDock.tsx`**:
   - Add `files` to `DockView`: `'dashboard' | 'tasks' | 'prompts' | 'files' | 'browser'`
   - Add tab button: `['files', 'ไฟล์', Folder]` in `dock-tabs`.
   - Render `<FileExplorerPanel workspace={workspace} onOpenFile={...} />` when `view === 'files'`.

4. **Build & Test Verification**:
   - Run `npm --workspace=@superai-rakkyxd/client run build` to verify 0 errors.
   - Run `npm test` to ensure all tests pass.

## Report Contract
Implementer writes report to `.superpowers/sdd/2026-10-24-unified-provider-hub/task-3-report.md`:
- Status: DONE / BLOCKED
- Commits made
- Build and test results
