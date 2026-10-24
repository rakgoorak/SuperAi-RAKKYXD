# Task 4 Brief: Multi-AI Comparison Arena (Parallel Multi-Provider Prompts)

## Context
In SuperAi, users currently have a `chat` mode where multiple AI seats (panel) answer the same question in parallel. However, the UI was previously just basic text cards (`ChatRunView`) without metrics, comparison capabilities, token counts, or interactive actions (like copying code, choosing a winner, or handing off to Code mode).

## Objectives
1. **Enhance AgentRunManager Backend (`packages/studio/server/AgentRunManager.ts`)**:
   - Add performance/token tracking to `PanelAnswer`:
     - `startedAt?: number;`
     - `firstChunkAt?: number;`
     - `completedAt?: number;`
     - `tokenCount?: number;`
   - In `startChat`:
     - Track `answer.startedAt = Date.now();`
     - On first chunk received: `if (!answer.firstChunkAt) answer.firstChunkAt = Date.now();`
     - Approximate token count on chunks: `answer.tokenCount = (answer.tokenCount || 0) + Math.max(1, Math.ceil(t.length / 4));`
     - On completion: `answer.completedAt = Date.now();`
   - Keep existing types and API signatures backward-compatible.

2. **Create `ComparisonArena.tsx` (`packages/studio/client/src/components/ComparisonArena.tsx`)**:
   - Side-by-side or responsive grid comparison view for all model answers in `run.panel`.
   - Card Header for each AI seat:
     - Model / Provider badge (e.g. Claude Code, Codex, Antigravity, Ollama)
     - Status indicator (spinner when running, checkmark when done, alert when failed)
     - Metrics pill:
       - Latency: e.g. `2.4s` (computed from `startedAt` to `completedAt` or elapsed time while running)
       - TTFT (Time to first token): e.g. `0.6s`
       - Tokens: e.g. `480 tokens`
     - Actions toolbar on each card:
       - **คัดลอกคำตอบ (Copy)**: copies text to clipboard with temporary checkmark feedback.
       - **ส่งต่อไปโหมด Code (Handoff to Code)**: dispatches `superai:prepare-composer` or opens composer in `code` mode with this AI's answer.
       - **เลือกคำตอบนี้ (Pick Winner)**: highlights card as user's chosen answer.
   - Main Body:
     - Clean `Markdown` rendering of the AI's response with proper styling.
     - Scrollable code blocks if any.
   - Summarizer Card (if `run.summarizer` is configured):
     - Renders below the arena grid with synthesis/merged summary.

3. **Styling `comparison-arena.css` (`packages/studio/client/src/comparison-arena.css`)**:
   - Matches the dark aesthetic:
     - Background `#1e1e1c` / `#262624`
     - Border `#343330` with subtle hover accent
     - Winner card gets a gold/amber highlight border `#eab308` or `#f59e0b`
     - Clean typography and responsive multi-column layout (1 col on mobile, 2 cols for 2 models, 3 cols for 3 models)

4. **Integration in `ChatPanel.tsx` and `App.tsx`**:
   - Export and use `ComparisonArena` inside `ChatPanel.tsx` (replacing or enhancing `ChatRunView`) so `App.tsx`'s chat runs render the full Comparison Arena.
   - Ensure existing tests pass (especially tests checking button text `'Chat'`).

5. **Unit Tests**:
   - Add unit tests in `packages/studio/test/comparison-arena.test.ts` verifying:
     - `PanelAnswer` metrics calculation (latency, token estimation)
     - Fallback handling for missing metrics
     - Clean serialization / deserialization

6. **Verification**:
   - Run `npm test` across workspaces.
   - Run `npm --workspace=@superai-rakkyxd/client run build`.
   - All tests must PASS (100%).
