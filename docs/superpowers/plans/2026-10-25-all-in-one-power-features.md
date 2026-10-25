# All-in-One Power Features Implementation Plan (Canvas, Ctrl+V Images, Project Rules, Agent Trajectory)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform SuperAi & RAKKYXD into a complete all-in-one powerhouse matching Claude, ChatGPT, and Antigravity by adding instant clipboard image pasting (Ctrl+V), side-by-side Canvas & Live Artifacts, Project Rules (`.cursorrules`, `CLAUDE.md`, `.superairules`), and Agent Trajectory Accordions.

**Architecture:**
- **Clipboard & Attachments:** Robust DataTransfer parser in client extracting files even when text exists, plus global window-level paste capture.
- **Side-by-Side Canvas:** Dynamic Canvas docking in RightDock and prominent "เปิดใน Canvas" buttons on visual code blocks with live Preview/Code switcher.
- **Project Rules:** Server-side `ProjectRules.ts` detecting `.cursorrules`, `CLAUDE.md`, `.superairules` in workspace roots and injecting them into `CliChat` prompts across all AI providers.
- **Agent Trajectory:** Extended thought and tool step parsing (`<think>`, `<thought>`, `<thinking>`, tool events) with collapsible accordions and live indicators in ChatView and Markdown components.

**Tech Stack:** TypeScript, React, Express, Lucide Icons, Node.js fs/path.

**Spec:** User requested features 2 through 5 from the competitive audit:
2. Paste Image (Ctrl+V) & Drag-Drop files
3. Side-by-Side Canvas & Live Artifacts
4. Project Rules / Custom Instructions
5. Agent Trajectory Accordion

## Global Constraints
- Keep 100% backward compatibility with all existing providers (Claude Code, Codex, Antigravity, OpenCode, Freebuff).
- All UI text in natural, concise Thai with clear tooltips.
- Automated tests must pass cleanly (`npm test`).
- Zero breakage to existing minimal design and layouts.

---

### Task 1: Instant Clipboard Image Paste (Ctrl+V) & Drag-Drop

**Files:**
- Modify: `packages/studio/client/src/attachments.ts`
- Modify: `packages/studio/client/src/App.tsx`
- Modify / Create: `packages/studio/test/attachments.test.ts`

**Interfaces:**
- `pastedFiles(data: DataTransfer | null): File[]`: Extracts all valid images and PDFs regardless of whether `text/plain` is set.
- Window-level paste handler in `App.tsx` capturing clipboard files and calling `attachToComposer(files)`.

- [ ] **Step 1: Write test for `pastedFiles` with mixed clipboard data (text + image)**
- [ ] **Step 2: Update `pastedFiles` in `attachments.ts` to inspect `data.items` and `data.files` without being blocked by `data.getData('text/plain')`**
- [ ] **Step 3: Add window-level paste event listener in `App.tsx` so Ctrl+V anywhere attaches screenshots to composer**
- [ ] **Step 4: Verify test passes**

---

### Task 2: Side-by-Side Canvas & Live Artifacts (Claude / ChatGPT Canvas Style)

**Files:**
- Modify: `packages/studio/client/src/components/Markdown.tsx`
- Modify: `packages/studio/client/src/components/RightDock.tsx`
- Modify: `packages/studio/client/src/components/ArtifactPreview.tsx`
- Modify: `packages/studio/client/src/minimal-interface.css`

**Interfaces:**
- `Markdown.tsx`: Highlight code blocks with visual outputs (HTML, React, SVG, Mermaid, XML) with an eye-catching "✨ เปิดใน Canvas" button and custom `<artifact>` tag parsing.
- `RightDock.tsx`: Add dedicated "Canvas" label and icon state when previewing an artifact.
- `ArtifactPreview.tsx`: Side-by-side header with live preview / code switcher and export buttons.

- [ ] **Step 1: Add `<artifact>` tag parsing and "✨ เปิดใน Canvas" action to `Markdown.tsx`**
- [ ] **Step 2: Update `RightDock.tsx` to display "Canvas" tab mode when viewing an artifact**
- [ ] **Step 3: Polish `ArtifactPreview.tsx` layout and header controls**
- [ ] **Step 4: Update CSS in `minimal-interface.css` for clean side-by-side splitting**

---

### Task 3: Project Rules & Custom Instructions (`.cursorrules`, `CLAUDE.md`, `.superairules`)

**Files:**
- Create: `packages/studio/server/ProjectRules.ts`
- Modify: `packages/studio/server/CliChat.ts`
- Create: `packages/studio/test/project-rules.test.ts`
- Modify: `packages/studio/client/src/components/ComposerOptions.tsx`

**Interfaces:**
- `getProjectRules(cwd: string): { rules: string; file?: string }`: Reads `.cursorrules`, `CLAUDE.md`, `.superairules`, or `.antigravityrules` from `cwd` (or nearest parent).
- `CliChat.ts`: Injects project rules into prompt for all providers.
- `ComposerOptions.tsx`: Displays active project rule file badge or status.

- [ ] **Step 1: Write unit test for `ProjectRules.ts`**
- [ ] **Step 2: Implement `ProjectRules.ts` to discover and read rule files**
- [ ] **Step 3: Integrate `getProjectRules` into `CliChat.ts` prompt builder**
- [ ] **Step 4: Run test to confirm rules are loaded and applied**
- [ ] **Step 5: Add rule status indicator in `ComposerOptions.tsx`**

---

### Task 4: Agent Trajectory Accordion & Enhanced Thought Parsing

**Files:**
- Modify: `packages/studio/client/src/components/Markdown.tsx`
- Modify: `packages/studio/client/src/components/ThinkingAccordion.tsx`
- Modify: `packages/studio/client/src/components/ChatView.tsx`

**Interfaces:**
- Extended thought regex supporting `<think>`, `<thought>`, `<thinking>`, `:::thought`.
- Enhanced `ThinkingAccordion.tsx` with elapsed thinking duration and collapsible design.
- Enhanced `ToolRow` and `ToolGroup` in `ChatView.tsx` showing clear action titles (🔍 อ่านไฟล์, ✏️ แก้ไขโค้ด, ⚡ รันคำสั่ง).

- [ ] **Step 1: Update thought block regex in `Markdown.tsx` to handle `<think>`, `<thought>`, `<thinking>`**
- [ ] **Step 2: Enhance `ThinkingAccordion.tsx` design and accessibility**
- [ ] **Step 3: Enhance `ToolRow` and `ToolGroup` in `ChatView.tsx` with action badges and icons**
- [ ] **Step 4: Verify test suite passes**

---

### Task 5: Verification, Build & Release Package

**Files:**
- `packages/studio/client`
- `packages/studio/server`

- [ ] **Step 1: Run full test suite `npm test`**
- [ ] **Step 2: Run provider smoke test**
- [ ] **Step 3: Build client and studio packages**
- [ ] **Step 4: Verify everything works smoothly**
