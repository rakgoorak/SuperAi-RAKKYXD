# Task 2 Brief: Visual Side-by-Side & Inline Diff Viewer Component

## Project Context
SuperAi Studio client needs a first-class Visual Diff Viewer so developers can inspect changes made by themselves or AI without leaving SuperAi for GitHub Desktop or VS Code.
Task 1 added backend support: `/api/workspaces/:wsId/changed-file` now returns `originalContent` (from HEAD) along with `content`, `diff`, and `deleted`, plus REST endpoints for `stage`, `unstage`, and `discard`.

## Files to Touch
- Create: `packages/studio/client/src/components/VisualDiffViewer.tsx`
- Create: `packages/studio/client/src/diff-viewer.css`
- Modify: `packages/studio/client/src/components/ChangesPanel.tsx`

## Detailed Requirements
1. **`VisualDiffViewer.tsx`**:
   - Props:
     ```ts
     interface VisualDiffViewerProps {
       workspaceId: string;
       filePath: string;
       original: string;
       modified: string;
       diffText?: string;
       deleted?: boolean;
       onActionComplete?: () => void;
       onError?: (error: string) => void;
     }
     ```
   - Features:
     - Compute line diff: compare `original` (HEAD) and `modified` (working directory).
       Can use LCS or chunk/line matching to produce aligned lines for side-by-side, or parse `diffText` chunks.
       Simple, robust line diff algorithm:
       Identify added lines, removed lines, and unchanged lines.
     - Mode toggle: `Side-by-Side (เทียบ 2 ฝั่ง)` vs `Inline (บรรทัดรวม)`
     - Line numbers: old line number & new line number columns.
     - Visual indicators: subtle red tint for deletions, subtle green tint for additions, neutral for unchanged.
     - Header Toolbar:
       - File name and status badge (`ลบแล้ว`, `แก้ไข`, `สร้างใหม่`)
       - Switch view mode button (Columns vs Inline)
       - Action button: `Stage` (`/api/workspaces/:wsId/files/stage`)
       - Action button: `Unstage` (`/api/workspaces/:wsId/files/unstage`)
       - Action button: `Discard (ยกเลิกการแก้ไข)` (`/api/workspaces/:wsId/files/discard`) with confirmation prompt
       - Action button: `Copy Path`
     - Synchronized horizontal/vertical scroll between left (Original) and right (Modified) in Side-by-Side view.

2. **`diff-viewer.css`**:
   - Typography: Consolas / monospace 12px, line-height 1.6.
   - Dark theme colors matching SuperAi:
     - Background: `#161614`
     - Header: `#21211e`, border `#30302c`
     - Deletion: bg `#381c1c`, text `#f87171`
     - Addition: bg `#163b27`, text `#4ade80`
     - Line number gutter: bg `#1a1a18`, color `#6e6d68`, width 42px, text-align right, user-select none.
     - Clean scrollbars and responsive layout.

3. **`ChangesPanel.tsx`**:
   - Update `ChangesPanel.tsx` to render `<VisualDiffViewer>` instead of the raw `<pre>` tag.
   - Retain list of changed files on the left and show `VisualDiffViewer` on the right.
   - When a file is staged, unstaged, or discarded, refresh the changed files list and file diff.

4. **Build & Test Verification**:
   - Run `npm --workspace=@superai-rakkyxd/client run build` to ensure TypeScript and Vite build cleanly.
   - Run `npm test` to verify no regressions across the repo.

## Report Contract
Implementer writes report to `.superpowers/sdd/2026-10-24-unified-provider-hub/task-2-report.md`:
- Status: DONE / BLOCKED
- Commits made
- Build and test results
