# Git Worktrees & One-Click Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an integrated Git Worktree workflow in SuperAi & RAKKYXD with automated worktree directory creation, safety checks, management modal, and one-click smart merging back into `main` with optional cleanup.

**Architecture:** Backend module `GitWorktrees.ts` wraps Git CLI with `.gitignore` auto-guards and pre-merge conflict validation. StudioServer exposes clean REST endpoints. Client provides a `WorktreeModal` in the File Explorer / Changes Panel and a prominent Smart Merge Banner in `ChangesPanel.tsx`.

**Tech Stack:** Node.js child_process, TypeScript, Express (StudioServer), React 18, Lucide Icons, Node Test Runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-git-worktrees-design.md`

## Global Constraints
- All paths must stay within the project root (`.worktrees/` directory only).
- `.worktrees` MUST be present in `.gitignore`; automatically added if missing.
- Conflict-safe merges: pre-check conflicts before running real merges; never leave broken working trees.
- Thai language UI copy with clean dark theme (`#181816` canvas, `#262624` card backgrounds).

---

### Task 1: Backend Git Worktrees Core (`GitWorktrees.ts`)

**Files:**
- Create: `packages/studio/server/GitWorktrees.ts`
- Test: `packages/studio/server/test/git-worktrees.test.ts`

**Interfaces:**
- Produces:
  - `listWorktrees(root: string): Promise<WorktreeInfo[]>`
  - `createWorktree(root: string, branch: string): Promise<WorktreeInfo>`
  - `mergeWorktree(root: string, sourceBranch: string, targetBranch?: string, deleteAfter?: boolean): Promise<MergeWorktreeResult>`
  - `removeWorktree(root: string, worktreePath: string, deleteBranch?: boolean): Promise<boolean>`

- [ ] **Step 1: Write the failing unit test for `listWorktrees`, `createWorktree`, `mergeWorktree`, and `removeWorktree`**
- [ ] **Step 2: Run test to confirm failure**
  ```bash
  npx tsx --test packages/studio/server/test/git-worktrees.test.ts
  ```
- [ ] **Step 3: Implement `GitWorktrees.ts` with git porcelain parsing, auto-gitignore check, merge execution, and cleanup**
- [ ] **Step 4: Run unit tests to confirm 100% pass**
- [ ] **Step 5: Commit changes**
  ```bash
  git add packages/studio/server/GitWorktrees.ts packages/studio/server/test/git-worktrees.test.ts
  git commit -m "feat(studio): implement GitWorktrees backend with auto-gitignore and merge"
  ```

---

### Task 2: StudioServer REST Endpoints for Worktrees

**Files:**
- Modify: `packages/studio/server/StudioServer.ts`
- Test: `packages/studio/server/test/studio-server-worktrees.test.ts`

**Interfaces:**
- Consumes: `listWorktrees`, `createWorktree`, `mergeWorktree`, `removeWorktree` from `GitWorktrees.ts`
- Produces:
  - `GET /api/git/worktrees`
  - `POST /api/git/worktrees`
  - `POST /api/git/worktrees/merge`
  - `DELETE /api/git/worktrees`

- [ ] **Step 1: Write integration tests for worktree REST endpoints**
- [ ] **Step 2: Run test to confirm failure**
- [ ] **Step 3: Register REST routes in `StudioServer.ts`**
- [ ] **Step 4: Run test to confirm pass**
- [ ] **Step 5: Commit changes**
  ```bash
  git add packages/studio/server/StudioServer.ts packages/studio/server/test/studio-server-worktrees.test.ts
  git commit -m "feat(studio): add REST endpoints for Git Worktrees and merge"
  ```

---

### Task 3: Client Worktree Management Modal (`WorktreeModal.tsx`)

**Files:**
- Create: `packages/studio/client/src/components/WorktreeModal.tsx`
- Create: `packages/studio/client/src/worktree-modal.css`
- Modify: `packages/studio/client/src/api.ts`

**Interfaces:**
- Produces: `<WorktreeModal open={boolean} onClose={() => void} onSelect={(path: string) => void} />`
- Consumes: `/api/git/worktrees` endpoints

- [ ] **Step 1: Add worktree API helper functions in `packages/studio/client/src/api.ts`**
- [ ] **Step 2: Create `WorktreeModal.tsx` with creation form, worktree list, switch action, and delete action**
- [ ] **Step 3: Add `worktree-modal.css` with dark theme styling**
- [ ] **Step 4: Verify client builds without type errors (`npm --workspace=@superai-rakkyxd/client run build`)**
- [ ] **Step 5: Commit changes**
  ```bash
  git add packages/studio/client/src/components/WorktreeModal.tsx packages/studio/client/src/worktree-modal.css packages/studio/client/src/api.ts
  git commit -m "feat(client): add WorktreeModal component for managing parallel worktrees"
  ```

---

### Task 4: Client Smart Merge Banner in `ChangesPanel.tsx` & Explorer Integration

**Files:**
- Modify: `packages/studio/client/src/components/ChangesPanel.tsx`
- Modify: `packages/studio/client/src/components/FileExplorerPanel.tsx`
- Modify: `packages/studio/client/src/changes-panel.css` (or `worktree-modal.css`)

**Interfaces:**
- Produces:
  - Smart Merge Banner: detects `isWorktree`, displays source branch and target `main`, `[✓] ลบ Worktree หลังรวมเสร็จ`, and `[✦ รวมโค้ดเข้า main ทันที (Merge)]`
  - `🌿 Worktree` trigger button in `FileExplorerPanel` and `ChangesPanel` header

- [ ] **Step 1: Integrate `WorktreeModal` trigger in `FileExplorerPanel.tsx` header toolbar**
- [ ] **Step 2: Add `SmartMergeBanner` in `ChangesPanel.tsx` above diff list with merge action and delete-after checkbox**
- [ ] **Step 3: Add styling in CSS for the banner and badge**
- [ ] **Step 4: Verify client build passes cleanly**
- [ ] **Step 5: Commit changes**
  ```bash
  git add packages/studio/client/src/components/ChangesPanel.tsx packages/studio/client/src/components/FileExplorerPanel.tsx packages/studio/client/src/changes-panel.css packages/studio/client/src/worktree-modal.css
  git commit -m "feat(client): add Smart Merge Banner in ChangesPanel and Worktree trigger in FileExplorer"
  ```

---

### Task 5: End-to-End Smoke Test & Full Suite Verification

**Files:**
- Create: `packages/desktop/test/worktree-smoke.mjs`
- Test: All automated unit tests & smoke tests

- [ ] **Step 1: Write Playwright E2E smoke test `packages/desktop/test/worktree-smoke.mjs`**
  - Verify worktree button exists and opens modal.
  - Verify worktree creation generates directory in `.worktrees/`.
  - Verify Smart Merge Banner displays when on a worktree.
  - Verify one-click merge merges changes cleanly.
- [ ] **Step 2: Run `node packages/desktop/test/worktree-smoke.mjs` and verify all checks pass**
- [ ] **Step 3: Run full `npm test` across all workspaces (Core, Desktop, Studio, Client)**
- [ ] **Step 4: Commit changes and update documentation**
  ```bash
  git add packages/desktop/test/worktree-smoke.mjs
  git commit -m "test: add E2E smoke test for Git Worktrees and smart merge"
  ```
