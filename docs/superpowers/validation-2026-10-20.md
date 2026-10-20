# SuperAi & RAKKYXD — บันทึกการตรวจรับ

วันที่ผู้ใช้: 20 ตุลาคม 2026 (Asia/Bangkok)

## ผลที่ตรวจจริง

| การตรวจ | ผล |
|---|---|
| Build Core / Studio / Client / Desktop / Voice | ผ่าน |
| npm test | 25 assertions ผ่านทั้งหมด และ frontend TypeScript ผ่าน |
| Desktop UI smoke | 13 จุดผ่าน ไม่มี renderer exception |
| Desktop UI + live OpenCode conversation | 14 จุดผ่าน รวมคำตอบจริง “พร้อม” |
| Portable EXE UI smoke | 13 จุดผ่าน ทั้งโปรแกรมหลักและ Voice |
| Python helper compile / Voice renderer syntax | ผ่าน |
| Whisper Base transcription | ผ่านไฟล์เสียงสังเคราะห์ “Create a new website and run the tests.” ถอดตรงประโยค |
| ส่งข้อความไทยจาก Voice ไปช่องคำสั่ง SuperAi | ผ่านในการทดสอบสอง process |
| Freebuff capacity | เปิดซ้ำข้ามโปรเจกต์ไม่ได้ คืนสิทธิ์หลังยืนยันปิด process tree หรือ natural exit |
| เก็บข้อมูล | rename/delete persist, corrupt storage ไม่ถูกเขียนทับ, save failure แจ้งและ rollback |
| Code review | ทุก finding ที่รายงานแก้แล้ว; portable ยังถูกตรวจ runtime แยกหลัง review |

Desktop smoke ใช้ Chromium WebContentsView จริงกับเว็บ HTTP ทดสอบภายในเครื่อง ตรวจ navigation และ isolation ของ privileged API, ซ่อน browser ระหว่าง dialog, project creation, terminal echo ผ่าน PTY จริง, Freebuff selector 1 session, Voice delivery และโหมดผู้ช่วย/สนทนา ชุดทดสอบ server แบบคำสั่งสั้นใช้ pipe เพื่อไม่ผูกกับวงจรจบ process อย่างรวดเร็วของ ConPTY; desktop smoke ตรวจ interactive PTY แยก

## รายการ review ที่แก้แล้ว

- ล็อกเป้าหมาย dictation ตั้งแต่เริ่มอัด ไม่เปลี่ยนเมื่อกดหยุด
- Desktop เปิด Voice แบบ single-instance process แยก จึงไม่แย่ง hotkey กัน
- Browser ล้าง load error เมื่อย้อนกลับ/ถัดไปหรือ navigate สำเร็จ
- Freebuff รอปิด process tree จริง ไม่ถูก pruning ระหว่างปิด และไม่คืนสิทธิ์ถ้า taskkill ล้มเหลว
- คำขอ CLI ยาวไม่ถูกตัดเงียบ: Claude/Codex ใช้ stdin, OpenCode ใช้ไฟล์แนบ UTF-8 และเรียก npm bin โดยตรง
- ยกเลิกระหว่างเตรียมไฟล์แนบต้องไม่เริ่ม CLI มี regression test
- การตรวจรุ่น OpenCode ครั้งแรกต้องเสร็จก่อนเริ่มคำขอที่ใช้ค่ารุ่นอัตโนมัติ

## การตั้งค่าภายนอกและการทดสอบด้วยผู้ใช้

OpenCode global config เดิมชี้ไปยังรุ่นที่บริการไม่พบ แอปใช้รุ่นที่ตรวจพบจริงผ่าน app-specific override โดยไม่เปลี่ยน global config จากนั้น live request ผ่านแล้ว

Claude ของเครื่องมี model/auth configuration ภายนอกที่ไม่ใช่ baseline ที่ยืนยันว่าพร้อมใช้งาน การ login, รุ่น และโควตาของ Claude/Codex/Gemini/Freebuff ต้องตรวจด้วยบัญชีผู้ใช้เอง ไม่มีการอ้างว่าผ่าน account test ทุกผู้ให้บริการ

ยังไม่ได้เปิด microphone อัตโนมัติ ยังต้องทดสอบความแม่นยำภาษาไทย/อังกฤษจากไมค์จริง ปุ่มลัดระหว่างใช้โปรแกรมจริง และการวางข้อความลงโปรแกรม Windows ที่ผู้ใช้เลือก โดยเฉพาะโปรแกรมที่มีสิทธิ์ administrator หรือช่องกรอกเฉพาะ

ภาพ root renderer ไม่รวม native WebContentsView บนระบบ screenshot นี้ จึงมี `output/playwright/superai-browser.png` เป็นภาพจาก native browser แยก ส่วนไฟล์ screenshot อื่นเป็น UI จริง ไม่ใช่ภาพ mockup

## Artifact

Portable: `release/SuperAi-RAKKYXD-20261020-013943/` มี `SuperAi-RAKKYXD.exe` และ `SuperAiVoice-RAKKYXD.exe` พร้อม runtime ต้องเก็บทั้งโฟลเดอร์ไว้ด้วยกัน ไม่ใช่ installer ที่ลงลายเซ็นของแบรนด์

Source และ `.cmd` launchers อยู่ใน repository สร้างรุ่นใหม่ด้วย `npm run build` และ `npm run package:portable`


## Session canvas refinement — 2026-10-20

User requested larger session displays and a layout closer to BridgeMind. The original screenshot showed roughly 240px of session viewport with a large composer. The revised 1366×720 renderer measures 465px of terminal canvas and a 90px compact composer. One/two sessions receive 449px panes; 3/6/12 sessions retain 360px minimum panes with outer scrolling. Full-area focus, vertical stack and two-column split preserve mounted terminals and process IDs. The layout choice survives reload. At a canvas width <=900px, split becomes one column, including with docked Preview.

Fresh verification:
- Full build passed; final frontend build/typecheck passed after the toast containment and alignment refinements.
- `npm run test:desktop`: 13 integration checks passed, no renderer errors.
- `SUPERAI_PORTABLE_DIR=release/SuperAi-RAKKYXD-20261020-015826 npm run test:layout`: 12 grouped checks passed using the actual portable EXE. Covered 1/2/3/6/12 real PTYs; 1040×680, 1366×720 and 1920×1080; Preview adaptation and notice bounds; maximize/restore; reload persistence; multiline composer preservation; process identity and command delivery.
- Independent reviewer caught a native Preview overlay conflict with notices; notices now live inside the positioned terminal canvas. Portable test verifies their bounds while Preview is open.
- Layout mechanical scan returned `[]`; `git diff --check` passed.

Screenshots: `output/playwright/superai-layout-six.png`, `superai-layout-focused.png`, `superai-layout-wide.png`.
Updated portable: `release/SuperAi-RAKKYXD-20261020-015826/`. Previous user application and its sessions were not stopped or replaced. The new UI appears after the user closes the old executable and opens the new one; running PTY sessions do not transfer between processes.


## Screenshot reference workspace — 2026-10-20

The user supplied seven reference screenshots, clarifying the desired multi-column fitted canvas and persistent right dock. Implemented SessionCanvas (auto/1/2/3/4 columns, remainder fill, reorder by drag/buttons, keyboard/pointer size weights, focus/restore, pane labels), RightDock (actual-process dashboard/search/filter, project task CRUD/CLI delivery/manual completion, prompt CRUD/reuse, persistent mounted Chromium), saved mixed CLI launch presets, compact top shell, and collapsed-by-default shared composer with automatic reveal on dictation/prompt reuse.

Fresh evidence:
- `npm test`: 25 backend/core/desktop/voice assertions passed and frontend typecheck passed.
- Frontend production build passed after final launch-refresh and dictation-focus fixes. Desktop main syntax check passed.
- Source `npm run test:layout`: 12 grouped checks passed at 1040×680, 1366×720, 1920×1080 for existing large split/stack/focus modes. At 1366×720 the expanded shared composer is 90px and terminal canvas 490px. Default fitted mode hides the shared composer and gives its space to terminals.
- Actual portable `SUPERAI_PORTABLE_DIR=release/SuperAi-RAKKYXD-20261020-022102 npm run test:reference`: 18 grouped checks passed with no renderer errors. Covers fitted 5/6/7/9/10 seats; full-area restore; drag/button reorder preserving xterm node identity; keyboard splitter resize; column switching; dashboard search and native view suspension; task CRUD/persistence and real CLI delivery; prompt reveal/reuse; preset build/launch; partial launch503 with remainder-only retry; status refresh503 after successful launch; correct cross-project selection of a non-first session; mode switching with 12 live processes preserved.
- Independent review found and verified fixes for cross-project selection, partial launch duplication, and successful launch finalization when refresh fails.
- Final layout scan returned `[]` and `git diff --check` was clean.

Current portable artifact: `release/SuperAi-RAKKYXD-20261020-022102/`. Screenshots: `output/playwright/superai-reference-six.png` and `superai-reference-dashboard.png`. User processes were not stopped or replaced.

Scope: resembles the supplied visible workflow using its own implementation and brand; does not claim proprietary internals, account billing, scheduled agent routines, inferred CLI context usage, or guaranteed provider availability. CLI output/input is live; dashboard distinguishes open processes from active AI work, and task completion is explicitly user-controlled. Tasks/prompts/presets remain local to this machine/app profile.

Final portable regression: `SUPERAI_PORTABLE_DIR=release/SuperAi-RAKKYXD-20261020-022102 npm run test:desktop` passed 13 integration checks, including separate Voice delivery and focus of the revealed composer, native browser navigation/isolation, live PTY input, Freebuff selection limit and mode switching. No renderer errors.
