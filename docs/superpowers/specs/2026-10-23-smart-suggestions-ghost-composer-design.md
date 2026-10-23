# Smart Follow-up Suggestions & Ghost-Text Tab Composer

Status: proposed and approved by user, ready for implementation planning.

## Overview & Purpose

Following the interactive patterns established by Claude Code, ChatGPT, and Antigravity, SuperAi & RAKKYXD introduces:
1. **Follow-up Action Chips (1–4 choices):** Context-aware suggestions displayed directly above the prompt composer after an Agent or Chat run finishes (or in Code mode), allowing users to click and populate the composer with actionable next steps.
2. **Ghost-Text & Tab Autocomplete:** Dual-layer inline faint text suggestion inside the prompt composer. When the input is empty or the user types a prefix, matching suggestions appear as ghost text with a `Tab ⇥` badge. Pressing `Tab` accepts and fills the text into the composer for easy inspection before sending.
3. **Quick Slash Commands (`/`):** Built-in instant autocomplete for frequently used commands (`/skills`, `/test`, `/diff`, `/clear`).

## Architecture & Data Flow

### 1. Smart Suggestion Engine (`packages/studio/client/src/suggestions.ts`)
- Pure client-side module with zero network latency, zero token overhead, and full offline support.
- Function: `getSuggestions(context: SuggestionContext): SuggestionResult`
  - Input `SuggestionContext`:
    - `mode`: `"code" | "agent" | "chat"`
    - `lastRun`: Latest conversation run (status, mode, allowTools, prompt, output, error)
    - `activeSession`: Selected CLI session in Code mode
    - `draft`: Current text in the composer
  - Output `SuggestionResult`:
    - `items`: 1–4 `SuggestionItem` (id, label, promptText, icon, kind)
    - `topChoice`: The primary suggestion recommended for ghost text
    - `ghostSuffix`: Suffix to render after the current `draft` prefix if matching

### 2. Suggestion Priority Rules
- **After Successful Agent Run (`completed`):**
  - If `allowTools` was true (files modified/commands run):
    1. "ตรวจดูการแก้ไขไฟล์ (Git Diff)"
    2. "รันการทดสอบระบบ (Test)"
    3. "อธิบายรายละเอียดโค้ดที่แก้"
    4. "สรุปขั้นตอนถัดไป"
  - If read-only mode:
    1. "เริ่มลงมือเขียนโค้ดตามแผน"
    2. "ขอตัวอย่างโค้ดละเอียดขึ้น"
    3. "รันการทดสอบระบบ (Test)"
- **After Successful Chat Run (`completed`):**
  1. "ขอตัวอย่างโค้ดละเอียดเพิ่มเติม"
  2. "เปรียบเทียบข้อดีข้อเสียของแต่ละแนวทาง"
  3. "นำแนวทางที่แนะนำไปเริ่มลงมือทำ"
- **On Failure / Error (`failed` or error present):**
  1. "ลองใหม่อีกครั้งพร้อมวิเคราะห์สาเหตุ"
  2. "ขอวิธีแก้ปัญหาแบบทีละขั้นตอน"
  3. "ตรวจดูบันทึกข้อผิดพลาด (Logs)"
- **Slash Commands & Prefix Autocomplete:**
  - `/skills` -> เปิดรายการ Skills
  - `/test` -> รันการทดสอบ
  - `/diff` -> ตรวจดู Git Diff
  - `/clear` -> ล้างข้อความ

## UI Components & Interaction

### 1. Action Chips Bar (`SuggestedChips.tsx`)
- Placed above the `textarea` in `.composer-box`.
- Displays 1–4 pill buttons styled in Mission Control navy/cyan palette with glowing hover.
- Click action: Calls `onSelect(promptText)`, which fills the draft via `setDraft(promptText)` and focuses the textarea. Does NOT auto-send.
- Hidden or disabled while an AI run is active (`busy || activeRun`).

### 2. Dual-Layer Ghost Composer (`App.tsx` & `.composer-box`)
- Structure:
  - Background layer (`.ghost-layer`): Read-only text rendered in faint color (45% opacity) with identical font, padding, and line-height as the textarea. Contains the ghost text and `Tab ⇥` badge.
  - Foreground layer (`textarea`): Transparent background, standard caret, handles user keystrokes.
- Keyboard Handlers:
  - `Tab`: If ghost text is active, accepts full text into `draft` and positions caret at the end. Prevents default tab navigation.
  - `Escape`: Temporarily dismisses ghost text for the current draft.
  - `Enter`: Normal submission logic.
  - IME Guard: Bypasses tab completion when `e.nativeEvent.isComposing` is true.

## Edge Cases & Defensive Design

1. **Multiline Inputs:** When `draft.includes('\n')`, ghost text overlay is cleanly hidden to prevent vertical caret misalignment.
2. **Thai Language & IME:** Input composing events are respected; `Tab` does not intercept Thai vowel/tonal mark composition.
3. **Screen Responsiveness:** Action Chips container uses `overflow-x: auto; flex-wrap: nowrap` with subtle custom scrollbars on small screens.
4. **Voice Dictation:** Spoken text from Whisper WASM updates `draft` seamlessly without ghost text collision.

## Verification & Test Plan

1. **Unit Tests (`packages/studio/client/test/suggestions.test.ts`):**
   - Context generator produces correct 1–4 items for Agent completed, Agent failed, Chat completed, and Code modes.
   - Prefix matching accurately calculates ghost suffix for normal words and slash commands.
   - Suffix is empty when draft does not match any prefix.
2. **TypeScript & Bundling:**
   - Full build via `npm --workspace=@superai-rakkyxd/client run build` passes with 0 errors.
3. **Smoke Tests:**
   - Run `npm run test:desktop` and `npm run test:team` to ensure no visual regressions or locator collisions.
