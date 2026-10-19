# BridgeMind-Style Multi-Terminal & Multi-Agent Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete BridgeMind-style multi-terminal and multi-agent developer studio application with 3-column dark-mode layout, concurrent terminal threads, built-in AI agents + external CLI support, embedded live browser preview, and 1-click browser login.

**Architecture:** Client-server monorepo under `packages/studio`:
- `packages/studio/server`: Node.js daemon managing PTY/terminal processes, bidirectional WebSocket streaming, workspace registry, and browser auth.
- `packages/studio/client`: React 18 (Vite + Tailwind CSS + Lucide icons) 3-column studio matching the BridgeMind UI.

**Tech Stack:** Node.js, TypeScript, Express/HTTP, `ws` (WebSockets), `playwright-core` (browser auth), React 18, Vite, Tailwind CSS, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-10-19-bridgemind-multi-agent-studio-design.md`

## Global Constraints
- Zero C++ native compiler dependencies on Windows (pure JS/TS PTY fallback via `child_process.spawn` with stream piping).
- Browser Login automated flow (OpenCode style) accessible from both UI and CLI.
- 3-Column UI strictly adhering to the BridgeMind visual aesthetic (dark theme `#0c1017`, cyan/blue highlights, workspace tree, reasoning cards, browser preview).

---

### Task 1: Scaffolding `packages/studio` & Workspaces

**Files:**
- Create: `packages/studio/package.json`
- Create: `packages/studio/tsconfig.json`
- Modify: `package.json` (add `packages/studio` to workspaces)

- [ ] **Step 1: Write packages/studio/package.json with dependencies**
- [ ] **Step 2: Write packages/studio/tsconfig.json**
- [ ] **Step 3: Update root package.json and run `npm install`**
- [ ] **Step 4: Commit Task 1**

---

### Task 2: Backend TerminalSessionManager & WorkspaceRegistry

**Files:**
- Create: `packages/studio/server/TerminalSessionManager.ts`
- Create: `packages/studio/server/WorkspaceRegistry.ts`
- Create: `packages/studio/server/types.ts`
- Test: `packages/studio/test/terminal.test.ts`

- [ ] **Step 1: Write unit test for TerminalSessionManager (spawn shell, send input, stream output)**
- [ ] **Step 2: Implement TerminalSessionManager with child_process spawn, custom cwd, and stdin/stdout piping**
- [ ] **Step 3: Implement WorkspaceRegistry with atomic JSON persistence for workspaces and agent threads**
- [ ] **Step 4: Run tests and verify pass**
- [ ] **Step 5: Commit Task 2**

---

### Task 3: Backend StudioServer (REST & WebSocket Terminal Streaming)

**Files:**
- Create: `packages/studio/server/StudioServer.ts`
- Create: `packages/studio/server/index.ts`
- Test: `packages/studio/test/server.test.ts`

- [ ] **Step 1: Write unit test for StudioServer endpoints and WebSocket terminal stream**
- [ ] **Step 2: Implement StudioServer with `/api/workspaces`, `/api/terminal`, `/api/auth/browser-login`, and `/ws/terminal/:id`**
- [ ] **Step 3: Connect BrowserLoginManager from `@opencode-multi/core`**
- [ ] **Step 4: Run tests and verify pass**
- [ ] **Step 5: Commit Task 3**

---

### Task 4: Frontend Scaffolding (Vite + React + Tailwind CSS)

**Files:**
- Create: `packages/studio/client/package.json`
- Create: `packages/studio/client/tsconfig.json`
- Create: `packages/studio/client/vite.config.ts`
- Create: `packages/studio/client/tailwind.config.js`
- Create: `packages/studio/client/index.html`
- Create: `packages/studio/client/src/main.tsx`
- Create: `packages/studio/client/src/index.css`

- [ ] **Step 1: Create client configuration files and Tailwind setup**
- [ ] **Step 2: Create base CSS and HTML structure**
- [ ] **Step 3: Verify client build compiles cleanly**
- [ ] **Step 4: Commit Task 4**

---

### Task 5: Frontend 3-Column BridgeMind Studio Components

**Files:**
- Create: `packages/studio/client/src/components/StudioHeader.tsx`
- Create: `packages/studio/client/src/components/WorkspaceSidebar.tsx`
- Create: `packages/studio/client/src/components/TerminalStudio.tsx`
- Create: `packages/studio/client/src/components/BrowserPreview.tsx`
- Create: `packages/studio/client/src/components/BrowserLoginModal.tsx`
- Create: `packages/studio/client/src/App.tsx`

- [ ] **Step 1: Implement StudioHeader with [Agent] [Code] [Thread] tabs and actions**
- [ ] **Step 2: Implement WorkspaceSidebar with workspace tree, agent threads, unread counters, and profile badge**
- [ ] **Step 3: Implement TerminalStudio with multi-pane terminal tabs, reasoning thought cards, and prompt bar with model dropdown**
- [ ] **Step 4: Implement BrowserPreview with address bar, back/forward/refresh, and tabbed webview iframe**
- [ ] **Step 5: Implement BrowserLoginModal with 1-click login for ChatGPT, Claude, Gemini, DeepSeek**
- [ ] **Step 6: Assemble in App.tsx and verify full build**
- [ ] **Step 7: Commit Task 5**

---

### Task 6: Windows Studio Launcher (`run-studio.cmd`) & E2E Verification

**Files:**
- Create: `run-studio.cmd`
- Test: E2E build and runtime startup verification

- [ ] **Step 1: Create `run-studio.cmd` to boot both studio server and client in single command**
- [ ] **Step 2: Run all test suites across the monorepo**
- [ ] **Step 3: Verify client production build**
- [ ] **Step 4: Final commit and user walkthrough**
