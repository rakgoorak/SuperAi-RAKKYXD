# BridgeMind-Style Multi-Terminal & Multi-Agent Studio Design Spec

## 1. Vision & Overview
A developer workspace desktop/web application inspired directly by **BridgeMind** (`bridgemind.ai`).
The system enables running multiple concurrent terminal sessions, external AI CLI coding agents (Claude Code, Codex, Aider), and built-in multi-agent teams (Supervisor, Coder, Tester) in a unified 3-column dark-mode dashboard with:
- **Left Sidebar**: Workspace tree & concurrent agent threads with live counters and status badges.
- **Center Studio**: Multi-pane terminal environment with xterm.js / bidirectional streaming, thought cards, and a model selector prompt bar.
- **Right Panel**: Embedded live preview browser / bench with multi-tabs and an interactive address bar.
- **Browser-Based Auth (OpenCode Style)**: 1-click browser login for ChatGPT Plus, Claude, Gemini, and DeepSeek, capturing session credentials without manual API key entry.

## 2. Architecture & Components

### 2.1 Backend Studio Daemon (`packages/studio/server`)
- **TerminalSessionManager**:
  - Manages concurrent child processes / PTY sessions (`node-pty` / `child_process.spawn`).
  - Streams raw ANSI bidirectional I/O over WebSockets to client terminals.
  - Can spawn external CLIs (`claude`, `opencode-multi`, `powershell`, `bash`) or direct agent threads.
- **WorkspaceRegistry**:
  - Persists workspaces, projects, threads, and thread history.
- **BrowserLoginManager & Auth API**:
  - Endpoints: `POST /api/auth/browser-login`, `GET /api/auth/status`, `POST /api/auth/token`.
  - Launches browser window, extracts session cookies/tokens, auto-saves to `~/.opencode-multi/auth.json`.
- **HTTP & WebSocket Server**:
  - REST API for workspaces, threads, and auth.
  - WebSocket at `/ws/terminal/:sessionId` for real-time terminal streaming.
  - WebSocket at `/ws/events` for workspace and agent status updates.

### 2.2 Frontend Studio Client (`packages/studio/client`)
- **3-Column Dark-Mode Studio Layout**:
  - **Left (WorkspaceSidebar)**:
    - Collapsible sidebar with workspaces tree.
    - Active agent threads (`Claude Code`, `Codex`, `Antigravity`, `OpenCode Multi-Agent`).
    - Unread counters / activity badges.
    - Bottom bar: Active model badge, Browser Login trigger button, settings modal.
  - **Center (TerminalStudio)**:
    - Top bar: Active thread name, segmented view switcher `[Agent] [Code] [Thread]`, split/new tab buttons.
    - Terminal workspace: Multi-tab and split-view panes.
    - Terminal viewer: Interactive terminal with xterm.js / ANSI streamer.
    - Agent view: Deep reasoning thought blocks (`Thought for 11s, 495 tokens...`), tool calls, and diffs.
    - Bottom command bar: Prompt input (`> ...`), `esc to cancel`, model selector dropdown.
  - **Right (BrowserPreview)**:
    - Multi-tab browser bar (`Dash...`, `Design...`, `localhost:3000`, `+`).
    - Address bar with Back, Forward, Refresh, URL navigation.
    - Live iframe previewing local dev servers or external sites.
  - **Browser Login Modal**:
    - 1-click login buttons for ChatGPT, Claude, Gemini, DeepSeek.

## 3. Implementation Steps
1. Scaffold `packages/studio` with `server` and `client`.
2. Implement backend `TerminalSessionManager` and `StudioServer` with WebSockets.
3. Integrate `BrowserLoginManager` endpoint in StudioServer.
4. Implement React frontend: 3-column layout, `WorkspaceSidebar`, `TerminalStudio`, `BrowserPreview`, `BrowserLoginModal`.
5. Connect bidirectional WebSocket streaming between backend terminal sessions and frontend terminals.
6. Create `run-studio.cmd` Windows launcher.
7. Verify all tests and operational flow.
