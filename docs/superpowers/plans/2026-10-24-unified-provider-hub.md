# Unified Multi-Provider Hub & Developer Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform SuperAi into a unified All-in-One AI Coding & Provider Hub by adding: (1) Visual Side-by-Side Git Diff Viewer & Interactive Project File Explorer, (2) Multi-AI Parallel Comparison Arena & Agent Handoff, and (3) Direct Cloud API Provider Engine for DeepSeek, OpenRouter, and Groq without requiring CLI installations.

**Architecture:** 
- **Developer Workspace Layer:** Extend Studio server with Git operations (`git show HEAD`, `git add`, `git restore`, `fs.writeFile`) and build client components for Side-by-Side Diff with syntax highlighting, line numbers, discard/stage actions, and an expandable File Tree with instant file preview/quick edit.
- **Multi-AI Arena & Handoff Layer:** Provide a dual/multi-model query runner in AgentRunManager and Studio client, allowing a prompt to be fanned out to multiple CLI seats or API providers side-by-side, with one-click "ส่งต่องาน (Handoff)" between providers.
- **Direct Cloud Provider Layer:** Implement an OpenAI-compatible lightweight HTTP streaming client in `@superai-rakkyxd/core` and integrate with Studio server/client to support BYOK (DeepSeek V3/R1, Groq, OpenRouter, Qwen Cloud) directly alongside CLI seats.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Node.js child_process (Git CLI), Express, Fetch API with SSE streaming.

---

## Global Constraints
- All code changes must compile cleanly (`npm --workspace=@superai-rakkyxd/client run build` and `npm --workspace=@superai-rakkyxd/studio run build`).
- All existing tests (168 tests across core, desktop, studio) must continue to pass 100%.
- UI styling must adhere to the minimalist dark charcoal palette (`#181816` canvas, `#262624` raised surfaces, `#e8e6e1` text, `#d97757` warm accent).
- Responsive on Windows Desktop with Electron integration and browser fallback.

---

### Task 1: Backend Git Operations for Side-by-Side Diff & File Actions

**Files:**
- Modify: `packages/studio/server/ProjectChanges.ts`
- Modify: `packages/studio/server/StudioServer.ts`
- Test: `packages/studio/test/project-changes.test.ts`

**Interfaces:**
- Consumes: `projectChanges(root: string)`, `projectFile(root: string, name: string)`
- Produces: 
  - `projectFile(root, name)` returns `{ name, content, originalContent, diff, deleted, staged }`
  - `stageFile(root: string, path: string): Promise<boolean>`
  - `unstageFile(root: string, path: string): Promise<boolean>`
  - `discardFileChanges(root: string, path: string): Promise<boolean>`
  - `saveProjectFile(root: string, path: string, content: string): Promise<boolean>`

- [ ] **Step 1: Write unit tests for new git operations**

Add tests in `packages/studio/test/project-changes.test.ts` testing `originalContent` from HEAD, `stageFile`, and `discardFileChanges`.

- [ ] **Step 2: Run test to verify failure**

Run: `node --test packages/studio/test/project-changes.test.ts`
Expected: FAIL due to missing functions or fields.

- [ ] **Step 3: Implement Git operations in ProjectChanges.ts & StudioServer.ts**

Extend `projectFile` in `packages/studio/server/ProjectChanges.ts`:
```ts
const originalContent = head
  ? await git(base, ['show', `HEAD:${name}`]).catch(() => '')
  : '';
```
Add endpoints in `packages/studio/server/StudioServer.ts`:
- `POST /api/workspaces/:wsId/files/stage`
- `POST /api/workspaces/:wsId/files/unstage`
- `POST /api/workspaces/:wsId/files/discard`
- `POST /api/workspaces/:wsId/files/save`

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test packages/studio/test/project-changes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/studio/server/ packages/studio/test/
git commit -m "feat(server): add git stage, discard, original content, and save endpoints"
```

---

### Task 2: Visual Side-by-Side & Inline Diff Viewer Component

**Files:**
- Create: `packages/studio/client/src/components/VisualDiffViewer.tsx`
- Create: `packages/studio/client/src/diff-viewer.css`
- Modify: `packages/studio/client/src/components/ChangesPanel.tsx`

**Interfaces:**
- Consumes: `{ name: string, content: string, originalContent: string, diff: string, deleted: boolean }`
- Produces: `<VisualDiffViewer original={originalContent} modified={content} filePath={name} onStage={...} onDiscard={...} />`

- [ ] **Step 1: Implement VisualDiffViewer component**

Create `packages/studio/client/src/components/VisualDiffViewer.tsx`:
- Line-by-line diff computation (or chunk diff parser)
- Switchable mode: `Side-by-Side (2 columns)` vs `Unified / Inline`
- Color-coded line additions (subtle emerald `#163b27`) and deletions (subtle red `#3b1c1c`)
- Line numbers for original and modified
- Action toolbar: `Stage file`, `Discard changes`, `Copy file path`, `Toggle Mode`

- [ ] **Step 2: Add styles in diff-viewer.css**

Style with clean monospace typography, sticky headers, subtle scrollbars, and high-contrast diff indicators.

- [ ] **Step 3: Integrate into ChangesPanel.tsx**

Replace the plain `<pre>` in `ChangesPanel.tsx` with `<VisualDiffViewer>` when viewing diffs, adding actions to discard or stage changes.

- [ ] **Step 4: Verify client build**

Run: `npm --workspace=@superai-rakkyxd/client run build`
Expected: PASS with 0 TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add packages/studio/client/src/components/VisualDiffViewer.tsx packages/studio/client/src/diff-viewer.css packages/studio/client/src/components/ChangesPanel.tsx
git commit -m "feat(client): add visual side-by-side diff viewer with stage and discard actions"
```

---

### Task 3: Interactive Project File Explorer & Quick Editor

**Files:**
- Create: `packages/studio/client/src/components/FileExplorerPanel.tsx`
- Create: `packages/studio/client/src/file-explorer.css`
- Modify: `packages/studio/client/src/components/RightDock.tsx` (add 'files' dock tab)
- Modify: `packages/studio/client/src/App.tsx`

**Interfaces:**
- Consumes: `/api/workspaces/:wsId/files`, `/api/workspaces/:wsId/preview-file`, `/api/workspaces/:wsId/files/save`
- Produces: `<FileExplorerPanel workspaceId={wsId} onOpenFile={...} />`

- [ ] **Step 1: Implement FileExplorerPanel with directory hierarchy**

Build `FileExplorerPanel.tsx`:
- Parse flat project file paths into an interactive tree: folders with collapse/expand, files with filetype icons (`Folder`, `FileCode`, `FileText`, `Image`).
- Search/filter files in real time.
- Right-click or action buttons: `ปักหมุดไฟล์ (Pin to Context)`, `คัดลอกพาธ (Copy Path)`, `ดู Diff`, `เปิดดู/แก้ไข (Quick Edit)`.
- Quick code viewer/editor modal or panel for instant tweaks without switching to VS Code.

- [ ] **Step 2: Add 'files' (ไฟล์) Tab to RightDock**

In `RightDock.tsx`:
- Add `['files', 'ไฟล์', Folder]` to `dock-tabs`.
- Render `FileExplorerPanel` when `view === 'files'`.

- [ ] **Step 3: Test and Verify Client Build**

Run: `npm --workspace=@superai-rakkyxd/client run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/studio/client/src/components/FileExplorerPanel.tsx packages/studio/client/src/file-explorer.css packages/studio/client/src/components/RightDock.tsx
git commit -m "feat(client): add interactive project file explorer and quick editor in right dock"
```

---

### Task 4: Multi-AI Comparison Arena (Parallel Multi-Provider Prompts)

**Files:**
- Create: `packages/studio/client/src/components/ComparisonArena.tsx`
- Modify: `packages/studio/client/src/App.tsx`
- Modify: `packages/studio/server/AgentRunManager.ts`

**Interfaces:**
- Consumes: multiple session IDs or providers (e.g. `['claude-code', 'codex', 'antigravity']`)
- Produces: Parallel dispatch of a single prompt to 2+ selected seats, streaming outputs side-by-side with token counters, time to first token, and "Use this answer / Handoff" buttons.

- [ ] **Step 1: Add Multi-Run Fanout in AgentRunManager.ts**

Support executing a prompt concurrently across multiple seats and streaming chunks with seat identifiers.

- [ ] **Step 2: Build ComparisonArena.tsx**

Two or three side-by-side comparison cards:
- Provider header with model badge
- Live streamed markdown output
- "Copy Answer", "Apply Code", "Hand off to Next Agent"

- [ ] **Step 3: Add Arena Toggle to Studio Header / Command Palette**

Allow quick launch via `Ctrl+K` -> `เปิดโหมด AI Comparison Arena` or toolbar icon.

- [ ] **Step 4: Run test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/studio/client/src/components/ComparisonArena.tsx packages/studio/server/AgentRunManager.ts packages/studio/client/src/App.tsx
git commit -m "feat: add multi-ai comparison arena for side-by-side model answers"
```

---

### Task 5: Cross-Agent Handoff & Flow Pipeline

**Files:**
- Modify: `packages/studio/client/src/components/ResponseActions.tsx`
- Modify: `packages/studio/client/src/components/ChatView.tsx`
- Modify: `packages/studio/client/src/components/RightDock.tsx`

**Interfaces:**
- Consumes: active assistant response text and turn output
- Produces: Handoff dropdown button `ส่งต่องาน (Handoff) ➔ [เลือก AI อื่น]` that bundles the summary/code into the next session's composer with a transition prompt.

- [ ] **Step 1: Add Handoff action in ResponseActions.tsx**

Add a `Share2` or `ArrowRightCircle` icon button:
- Clicking opens a menu of other available active sessions (e.g. "ส่งต่อให้ Codex", "ส่งต่อให้ Antigravity").
- Prepares prompt: `"จากข้อสรุป/โค้ดของ [Provider]:\n\n[Content]\n\nช่วยดำเนินการขั้นถัดไป: "`

- [ ] **Step 2: Test handoff flow**

Verify handoff dispatches custom event to composer and activates recipient session.

- [ ] **Step 3: Commit**

```bash
git add packages/studio/client/src/components/ResponseActions.tsx packages/studio/client/src/components/ChatView.tsx
git commit -m "feat: add cross-agent handoff action to chat responses"
```

---

### Task 6: Direct Cloud API Provider Engine (DeepSeek, OpenRouter, Groq BYOK)

**Files:**
- Create: `packages/core/src/providers/OpenAiCompatibleProvider.ts`
- Modify: `packages/core/src/ProviderFactory.ts`
- Modify: `packages/studio/server/Providers.ts`
- Modify: `packages/studio/client/src/components/ProviderAccess.tsx`
- Test: `packages/core/test/openai-compatible-provider.test.ts`

**Interfaces:**
- Consumes: `apiKey: string`, `baseUrl: string`, `model: string`
- Produces: `Provider` implementation with streaming SSE responses, tool execution, and token reporting.
  - DeepSeek: `https://api.deepseek.com/v1`, models: `deepseek-chat`, `deepseek-reasoner`
  - Groq: `https://api.groq.com/openai/v1`, models: `llama-3.3-70b-versatile`, `deepseek-r1-distill-llama-70b`
  - OpenRouter: `https://openrouter.ai/api/v1`

- [ ] **Step 1: Write provider unit tests**

Test `OpenAiCompatibleProvider` initializes, builds payload, parses streaming SSE deltas, and handles errors.

- [ ] **Step 2: Implement OpenAiCompatibleProvider in packages/core**

Implement standard OpenAI Chat Completions streaming with SSE parser (`data: {...}`).

- [ ] **Step 3: Register in ProviderFactory and ProviderAccess UI**

Allow users to enter API Key in Settings dialog -> `Direct APIs (DeepSeek / Groq / OpenRouter)` without needing any CLI installed on Windows.

- [ ] **Step 4: Run core tests & build**

Run: `npm --workspace=@superai-rakkyxd/core run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/ packages/studio/server/Providers.ts packages/studio/client/src/components/ProviderAccess.tsx
git commit -m "feat: add direct cloud API provider engine for DeepSeek, Groq, and OpenRouter"
```

---

### Task 7: Full Integration, Smoke Tests & Release Validation

- [ ] **Step 1: Run complete test suite across all workspaces**
- [ ] **Step 2: Build production client and desktop packages**
- [ ] **Step 3: Verify visual side-by-side diff, file tree, multi-arena, and direct API in smoke test**
