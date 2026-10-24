# Task 5 Brief: Cross-Agent Handoff & Flow Pipeline

## Context
In SuperAi, users run multiple AI agents (Claude Code, Codex, Antigravity, OpenCode, etc.) concurrently across sessions. Often, one AI completes architectural design, brainstorming, or debugging, and the user wants to hand off the resulting code or summary to another AI (e.g. from Claude Code to Codex, or Antigravity to Claude Code) to continue the work without manual copy-pasting.

## Objectives
1. **ResponseActions Enhancement (`packages/studio/client/src/components/ResponseActions.tsx`)**:
   - Add a "ส่งต่องาน (Handoff)" action:
     - Button with `ArrowRightCircle` or `Share2` or `Forward` icon.
     - When clicked, displays a menu of available target sessions / agents in the current workspace (excluding the current session if known), or general quick targets ("ส่งต่อไป session อื่น", "ส่งต่อให้ Codex", "ส่งต่อให้ Claude", "ส่งต่อให้ Antigravity").
     - Allows custom or default transition prompt formatting:
       ```
       จากข้อสรุป / ผลลัพธ์ของ [Agent]:

       [Text]

       ช่วยดำเนินการขั้นถัดไป: 
       ```
     - Triggers `superai:prepare-composer` or `superai:prepare-message` with the recipient's `sessionId`, switching active session and pre-populating composer draft with cursor placed for prompt completion.
   - Support `currentSessionId?: string;` and `agentName?: string;` props in `ResponseActions`.

2. **Integration in `ChatView.tsx` (`packages/studio/client/src/components/ChatView.tsx`)**:
   - Pass `sessionId`, agent type/name (`name`), and available sessions / targets to `ResponseActions`.
   - Also allow handoff in the more-options menu if preferred or as dedicated button.

3. **Enhancement in `RightDock.tsx` (`packages/studio/client/src/components/RightDock.tsx`)**:
   - Under "งาน" (Tasks), when sending a task or prompt, provide a quick handoff toggle or recent context inclusion: "แนบข้อสรุปล่าสุดจาก AI อื่น".

4. **Styling & Polish**:
   - Ensure the handoff menu fits nicely in the dark minimal theme (`#262624`, `#343330` border).
   - Show temporary success check feedback "ส่งต่อไป [Target] แล้ว".

5. **Unit Tests**:
   - Create unit tests in `packages/studio/test/cross-agent-handoff.test.ts`:
     - Test handoff prompt formatting function (`formatHandoffPrompt({ agentName, text, nextInstruction })`).
     - Test session filtering (excluding current session, listing interactive chat/terminal sessions).
     - Test payload structure dispatched to composer.

6. **Verification**:
   - Run `npm test` across workspaces.
   - Run `npm --workspace=@superai-rakkyxd/client run build`.
   - All tests must pass (100%).
