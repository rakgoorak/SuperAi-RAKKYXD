# Smart Follow-up Suggestions & Ghost-Text Tab Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement context-aware follow-up action chips and ghost-text Tab autocomplete for the prompt composer inspired by Claude Code, ChatGPT, and Antigravity.

**Architecture:** Pure client-side Suggestion Engine evaluates the latest conversation/session state and composer draft. Action Chips render above the textarea with click-to-fill behavior. The composer uses a synchronized dual-layer layout displaying faint ghost text with Tab autocomplete.

**Tech Stack:** React 18, TypeScript, Tailwind CSS / Mission Control CSS, Vite, Playwright smoke tests, Node.js test runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-10-23-smart-suggestions-ghost-composer-design.md`

## Global Constraints

- Never auto-send prompts on choice click; clicking a choice fills `draft` and focuses the textarea.
- Tab key must not interfere with IME composition (`e.nativeEvent.isComposing`).
- Ghost text must hide when `draft` contains newline characters (`\n`).
- Pure client-side logic: 0ms latency, 0 token overhead, works offline.
- Match existing Mission Control theme tokens (navy/slate/cyan, Cascadia/Noto Sans Thai typography).

---

### Task 1: Suggestion Engine & Unit Tests

**Files:**
- Create: `packages/studio/client/src/suggestions.ts`
- Create: `packages/studio/client/test/suggestions.test.ts`
- Modify: `packages/studio/client/package.json` (add test script if needed or verify `tsx --test`)

**Interfaces:**
- Produces:
  ```typescript
  export interface SuggestionItem {
    id: string;
    label: string;
    promptText: string;
    icon?: string;
  }
  export interface SuggestionContext {
    mode: "code" | "agent" | "chat";
    lastRun?: {
      status?: string;
      mode?: string;
      allowTools?: boolean;
      prompt?: string;
      output?: string;
      error?: string;
    } | null;
    activeSessionName?: string;
    draft: string;
  }
  export interface SuggestionResult {
    items: SuggestionItem[];
    topChoice?: SuggestionItem;
    ghostSuffix: string;
  }
  export function getSuggestions(ctx: SuggestionContext): SuggestionResult;
  ```

- [ ] **Step 1: Write the failing unit tests**

```typescript
// packages/studio/client/test/suggestions.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { getSuggestions } from "../src/suggestions.js";

test("returns 4 follow-up actions after completed Agent run with allowTools", () => {
  const result = getSuggestions({
    mode: "agent",
    lastRun: { status: "completed", allowTools: true, output: "เสร็จสิ้น" },
    draft: "",
  });
  assert.equal(result.items.length, 4);
  assert.equal(result.items[0].promptText, "ตรวจดูการแก้ไขไฟล์ (Git Diff)");
  assert.equal(result.topChoice?.promptText, "ตรวจดูการแก้ไขไฟล์ (Git Diff)");
  assert.equal(result.ghostSuffix, "ตรวจดูการแก้ไขไฟล์ (Git Diff)");
});

test("returns appropriate actions after completed Chat run", () => {
  const result = getSuggestions({
    mode: "chat",
    lastRun: { status: "completed", mode: "chat", output: "สรุป" },
    draft: "",
  });
  assert.ok(result.items.length >= 3);
  assert.ok(result.items[0].promptText.includes("ตัวอย่างโค้ด"));
});

test("returns error recovery actions when run has error or failed", () => {
  const result = getSuggestions({
    mode: "agent",
    lastRun: { status: "failed", error: "CLI connection lost" },
    draft: "",
  });
  assert.ok(result.items[0].promptText.includes("ลองใหม่อีกครั้ง"));
});

test("calculates ghostSuffix when draft is a matching prefix", () => {
  const result = getSuggestions({
    mode: "agent",
    lastRun: { status: "completed", allowTools: true },
    draft: "ตรวจดู",
  });
  assert.equal(result.ghostSuffix, "การแก้ไขไฟล์ (Git Diff)");
});

test("matches slash commands like /skills and /diff", () => {
  const result = getSuggestions({
    mode: "code",
    draft: "/sk",
  });
  assert.equal(result.ghostSuffix, "ills ");
});

test("returns empty ghostSuffix when draft has newlines or no match", () => {
  const result = getSuggestions({
    mode: "code",
    draft: "ข้อความที่ไม่ตรง\nอีกบรรทัด",
  });
  assert.equal(result.ghostSuffix, "");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test packages/studio/client/test/suggestions.test.ts`
Expected: FAIL (Cannot find module `../src/suggestions.js`)

- [ ] **Step 3: Implement minimal Suggestion Engine**

```typescript
// packages/studio/client/src/suggestions.ts
export interface SuggestionItem {
  id: string;
  label: string;
  promptText: string;
  icon?: string;
}

export interface SuggestionContext {
  mode: "code" | "agent" | "chat";
  lastRun?: {
    status?: string;
    mode?: string;
    allowTools?: boolean;
    prompt?: string;
    output?: string;
    error?: string;
  } | null;
  activeSessionName?: string;
  draft: string;
}

export interface SuggestionResult {
  items: SuggestionItem[];
  topChoice?: SuggestionItem;
  ghostSuffix: string;
}

export const SLASH_COMMANDS: SuggestionItem[] = [
  { id: "slash-skills", label: "/skills", promptText: "/skills " },
  { id: "slash-test", label: "/test", promptText: "/test " },
  { id: "slash-diff", label: "/diff", promptText: "/diff " },
  { id: "slash-clear", label: "/clear", promptText: "/clear" },
];

export function getSuggestions(ctx: SuggestionContext): SuggestionResult {
  const { mode, lastRun, draft } = ctx;
  let items: SuggestionItem[] = [];

  const isFailed = lastRun && (lastRun.status === "failed" || !!lastRun.error);
  const isCompleted = lastRun && lastRun.status === "completed";

  if (isFailed) {
    items = [
      { id: "retry", label: "ลองใหม่อีกครั้ง", promptText: "ลองใหม่อีกครั้งพร้อมวิเคราะห์สาเหตุและแก้ไข", icon: "refresh" },
      { id: "explain-err", label: "อธิบายวิธีแก้ปัญหา", promptText: "ขอวิธีแก้ปัญหาและข้อผิดพลาดที่เกิดขึ้นแบบทีละขั้นตอน", icon: "help" },
      { id: "check-logs", label: "ตรวจบันทึก Log", promptText: "ตรวจดูบันทึกข้อผิดพลาดและแนะนำวิธีแก้ไข", icon: "file" },
    ];
  } else if (isCompleted && mode === "agent") {
    if (lastRun?.allowTools) {
      items = [
        { id: "diff", label: "ตรวจดู Git Diff", promptText: "ตรวจดูการแก้ไขไฟล์ (Git Diff)", icon: "git" },
        { id: "test", label: "รันการทดสอบ", promptText: "รันการทดสอบระบบ (Test)", icon: "play" },
        { id: "explain", label: "อธิบายโค้ดที่แก้", promptText: "อธิบายรายละเอียดโค้ดที่แก้และไฟล์ที่เปลี่ยนแปลง", icon: "help" },
        { id: "next-step", label: "สรุปขั้นตอนถัดไป", promptText: "สรุปขั้นตอนถัดไปที่แนะนำในการพัฒนา", icon: "sparkles" },
      ];
    } else {
      items = [
        { id: "start-code", label: "เริ่มลงมือเขียนโค้ด", promptText: "เริ่มลงมือเขียนโค้ดตามแผนที่วางไว้", icon: "sparkles" },
        { id: "code-sample", label: "ขอตัวอย่างโค้ดละเอียด", promptText: "ขอตัวอย่างโค้ดและโครงสร้างไฟล์แบบละเอียด", icon: "file" },
        { id: "test-plan", label: "วางแผนการทดสอบ", promptText: "วางแผนการทดสอบระบบและกรณีทดสอบ (Test cases)", icon: "play" },
      ];
    }
  } else if (isCompleted && mode === "chat") {
    items = [
      { id: "chat-sample", label: "ขอตัวอย่างโค้ดละเอียด", promptText: "ขอตัวอย่างโค้ดและการนำไปประยุกต์ใช้อย่างละเอียด", icon: "file" },
      { id: "chat-compare", label: "เปรียบเทียบข้อดีข้อเสีย", promptText: "เปรียบเทียบข้อดีข้อเสียและจุดเด่นของแต่ละแนวทางข้างต้น", icon: "sparkles" },
      { id: "chat-action", label: "เริ่มลงมือทำตามคำแนะนำ", promptText: "ช่วยพาเริ่มลงมือทำตามแนวทางที่แนะนำทีละขั้นตอน", icon: "play" },
    ];
  } else {
    items = [
      { id: "cmd-test", label: "รันการทดสอบ", promptText: "รันการทดสอบระบบและตรวจความเรียบร้อย", icon: "play" },
      { id: "cmd-diff", label: "ตรวจ Git Diff", promptText: "ตรวจดูการแก้ไขไฟล์ล่าสุดในโปรเจกต์ (Git Diff)", icon: "git" },
      { id: "cmd-skills", label: "เรียกใช้ Skill", promptText: "/skills ", icon: "sparkles" },
    ];
  }

  const topChoice = items[0];
  let ghostSuffix = "";

  if (!draft.includes("\n")) {
    const trimmed = draft.trim();
    if (!trimmed && topChoice) {
      ghostSuffix = topChoice.promptText;
    } else if (trimmed) {
      const allCandidates = [...SLASH_COMMANDS, ...items];
      const match = allCandidates.find((c) => c.promptText.toLowerCase().startsWith(draft.toLowerCase()) && c.promptText.length > draft.length);
      if (match) {
        ghostSuffix = match.promptText.slice(draft.length);
      }
    }
  }

  return { items, topChoice, ghostSuffix };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test packages/studio/client/test/suggestions.test.ts`
Expected: PASS all 6 tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/studio/client/src/suggestions.ts packages/studio/client/test/suggestions.test.ts
git commit -m "feat(studio): add context-aware suggestion engine with prefix matching"
```

---

### Task 2: Action Chips Component & Styles

**Files:**
- Create: `packages/studio/client/src/components/SuggestedChips.tsx`
- Modify: `packages/studio/client/src/mission-control.css`

**Interfaces:**
- Produces:
  ```typescript
  export function SuggestedChips({
    items,
    disabled,
    onSelect,
  }: {
    items: SuggestionItem[];
    disabled?: boolean;
    onSelect: (promptText: string) => void;
  }): JSX.Element | null;
  ```

- [ ] **Step 1: Create SuggestedChips component**

```tsx
// packages/studio/client/src/components/SuggestedChips.tsx
import React from "react";
import { Sparkles, GitBranch, Play, HelpCircle, FileText, RotateCcw } from "lucide-react";
import type { SuggestionItem } from "../suggestions";

const ICON_MAP: Record<string, React.ReactNode> = {
  git: <GitBranch size={12} />,
  play: <Play size={12} />,
  help: <HelpCircle size={12} />,
  file: <FileText size={12} />,
  refresh: <RotateCcw size={12} />,
  sparkles: <Sparkles size={12} />,
};

export function SuggestedChips({
  items,
  disabled = false,
  onSelect,
}: {
  items: SuggestionItem[];
  disabled?: boolean;
  onSelect: (promptText: string) => void;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="suggested-chips-bar" role="group" aria-label="ตัวเลือกแนะนำด่วน">
      <span className="chips-label"><Sparkles size={12} /> แนะนำ:</span>
      <div className="chips-scroll">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip-action-btn"
            disabled={disabled}
            onClick={() => onSelect(item.promptText)}
            title={`คลิกเพื่อใส่คำสั่ง: ${item.promptText}`}
          >
            {item.icon && ICON_MAP[item.icon] ? ICON_MAP[item.icon] : <Sparkles size={11} />}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS rules for Action Chips & Ghost Layer in mission-control.css**

```css
/* packages/studio/client/src/mission-control.css */
/* Suggested Action Chips bar */
.suggested-chips-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  margin-bottom: 6px;
  background: rgba(22, 43, 61, 0.6);
  border: 1px solid rgba(118, 190, 209, 0.2);
  border-radius: 8px;
  font-size: 12px;
}
.suggested-chips-bar .chips-label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--dim, #a0afbd);
  font-weight: 500;
  white-space: nowrap;
}
.chips-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  white-space: nowrap;
  padding: 2px 0;
  scrollbar-width: thin;
}
.chip-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: #192f41;
  border: 1px solid #314c60;
  color: #b9edf6;
  border-radius: 9999px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}
.chip-action-btn:hover:not(:disabled) {
  background: #25495f;
  border-color: #76bed1;
  color: #ffffff;
  transform: translateY(-1px);
}
.chip-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Dual-layer Ghost Text Composer */
.composer-input-container {
  position: relative;
  width: 100%;
}
.composer-ghost-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 14px;
  pointer-events: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: hidden;
  color: rgba(160, 175, 189, 0.45);
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.composer-ghost-layer .tab-badge {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(118, 190, 209, 0.2);
  border: 1px solid rgba(118, 190, 209, 0.35);
  color: #b9edf6;
  margin-left: 6px;
  user-select: none;
}
```

- [ ] **Step 3: Commit Task 2**

```bash
git add packages/studio/client/src/components/SuggestedChips.tsx packages/studio/client/src/mission-control.css
git commit -m "feat(studio): add SuggestedChips component and mission control styles"
```

---

### Task 3: Dual-Layer Ghost Text & Tab Autocomplete Integration

**Files:**
- Modify: `packages/studio/client/src/App.tsx:1130-1170`

**Interfaces:**
- Consumes:
  - `getSuggestions` from `../suggestions`
  - `SuggestedChips` from `./components/SuggestedChips`

- [ ] **Step 1: Integrate suggestions & SuggestedChips in App.tsx**

In `App.tsx`:
1. Import `getSuggestions` and `SuggestedChips`.
2. Compute `suggestionResult = getSuggestions({ mode, lastRun: conversation[conversation.length - 1], draft })`.
3. Render `<SuggestedChips items={suggestionResult.items} disabled={busy || !!activeRun} onSelect={(text) => { setDraft(text); composer.current?.focus(); }} />` inside `.composer-box` right above the input container.
4. Wrap `textarea` with `.composer-input-container` and add `.composer-ghost-layer` behind it.
5. In `onKeyDown`:
   - If `e.key === "Tab"` && `suggestionResult.ghostSuffix` && !`e.shiftKey` && !`e.ctrlKey` && !`e.altKey` && !`e.nativeEvent.isComposing`:
     - `e.preventDefault()`;
     - `setDraft(draft + suggestionResult.ghostSuffix)`;

- [ ] **Step 2: Build client to verify TypeScript compile**

Run: `npm --workspace=@superai-rakkyxd/client run build`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit Task 3**

```bash
git add packages/studio/client/src/App.tsx
git commit -m "feat(studio): integrate SuggestedChips and dual-layer ghost composer with Tab autocomplete"
```

---

### Task 4: End-to-End Verification & Smoke Testing

**Files:**
- Test files: `packages/desktop/test/team-smoke.mjs`, `packages/desktop/test/smoke.mjs`

- [ ] **Step 1: Run full unit test suite**

Run: `npm test`
Expected: 140+ unit tests PASS with 0 failures.

- [ ] **Step 2: Run team smoke test (Agent + Chat modes)**

Run: `npm run test:team`
Expected: All 5 team checks pass with 0 renderer errors.

- [ ] **Step 3: Run desktop smoke test**

Run: `npm run test:desktop`
Expected: 16 checks pass with 0 renderer errors.

- [ ] **Step 4: Commit any test adjustments or finalize**

```bash
git commit --allow-empty -m "chore(release): verify smart suggestions and ghost-text composer end-to-end"
```
