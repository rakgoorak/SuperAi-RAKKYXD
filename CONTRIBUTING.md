# Contributing to SuperAi & RAKKYXD

Thank you for your interest in contributing to **SuperAi & RAKKYXD**! We welcome bug fixes, documentation improvements, new features, and visual enhancements from the open-source community.

---

## 📋 Prerequisites

Before setting up the project locally, make sure your machine has:
* **Node.js**: Version **22.x** or higher (`node -v`)
* **npm**: Version **10.x** or higher
* **Git**: Installed and available in PATH
* **OS**: Windows 10/11 or macOS (Apple Silicon / Intel)

---

## 🛠️ Getting Started (Development Setup)

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/rakgoorak/SuperAi-RAKKYXD.git
   cd SuperAi-RAKKYXD
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build all workspaces**:
   ```bash
   npm run build
   ```

4. **Launch the application in development**:
   ```bash
   # Run the full Desktop App (Electron)
   npm start

   # Or run the web client Vite dev server
   npm run dev

   # Or run the Studio backend server
   npm run studio
   ```

---

## 📂 Project Architecture

The repository is organized as an npm workspace monorepo:

| Workspace | Path | Purpose |
| :--- | :--- | :--- |
| **`@superai-rakkyxd/core`** | `packages/core/` | Core LLM providers (Gemini, Claude, OpenAI, Ollama), tools (BashTool, FileTools), context manager, and token trimming. |
| **`@superai-rakkyxd/studio`** | `packages/studio/server/` | Express REST server, WebSocket terminal streaming, CLI session orchestration, and agent run manager. |
| **`@superai-rakkyxd/client`** | `packages/studio/client/` | React 18 frontend with Vite, Tailwind/custom modern CSS, 3D Pixel Agent Workspace, and Thai speech dictation. |
| **`@superai-rakkyxd/desktop`** | `packages/desktop/` | Electron main process, embedded Chromium browser preview controller, and updater. |

---

## 🧪 Testing Guidelines

We enforce rigorous test coverage. Before submitting any changes or opening a pull request, ensure all test suites pass:

```bash
# 1. Run all workspace unit and integration tests (280+ tests)
npm test

# 2. Run the Desktop Electron smoke test
npm run test:desktop

# 3. Run the multi-agent team test
npm run test:team
```

---

## 🌿 Contribution Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make clean, atomic commits following conventional commit messages:
   * `feat: add new provider option`
   * `fix: prevent layout clipping in chat view`
   * `docs: update installation instructions`
3. Verify that `npm test` and `npm run build` pass with zero errors.
4. Push your branch to your fork and submit a Pull Request to `main`.
5. Provide a clear description and screenshots/GIFs for any UI modifications.

---

## 📜 Code of Conduct

Please be respectful, collaborative, and constructive. We follow standard Contributor Covenant guidelines to ensure a welcoming environment for everyone.
