# SuperAi & RAKKYXD v1.0.30

## มีอะไรใหม่ใน v1.0.30 (Freebuff / TUI Terminal Fix & macOS Compatibility Polish)

- **แก้ไข Freebuff / OpenTUI Terminal ค้างและพิมพ์ไม่ได้:**
  - แก้ไขปัญหาการ bundle `@xterm/xterm` (`InputHandler.requestMode`) ที่ทำให้เกิด `ReferenceError` เมื่อรับคำสั่ง ANSI DECRQM (`\x1b[?...$p`) จาก Freebuff และ OpenCode TUI ตอนเริ่มทำงาน
  - ปรับการจัดการโฟกัสของ `TerminalPane` หลังเปิด Session ใหม่ และเมื่อคลิกสลับกลับมาที่กรอบ Terminal ให้พิมพ์แชทโต้ตอบได้ทันที
- **ปรับปรุงการทำงานบน macOS ให้สมบูรณ์ยิ่งขึ้น:**
  - ค้นหาพาธของ CLI บน macOS อัตโนมัติ (`~/.freebuff/bin`, `/Applications/Codex.app/Contents/Resources`, Homebrew, NVM ฯลฯ)
  - ใช้ `zsh` เป็นค่าเริ่มต้นของ Terminal บน macOS พร้อมชุดฟอนต์ `SF Mono`, `Menlo`, `Monaco` และ `Noto Sans Thai`
  - เพิ่มการลองซ้ำอัตโนมัติเมื่อฐานข้อมูล SQLite ของ OpenCode ถูกล็อกชั่วคราวขณะรันหลายงานพร้อมกัน
  - ปรับตำแหน่งปุ่มไฟจราจร (Traffic Lights) ของหน้าต่าง macOS และล้าง `quarantine` attribute อัตโนมัติหลังอัปเดตแอป

---

# SuperAi & RAKKYXD v1.0.29

## มีอะไรใหม่ใน v1.0.29 (Claude-style Chat, Interrupt, Completion Notifications & Next-Message Suggestions)

- **ช่องพิมพ์แชทแบบ Minimal เหมือน Claude:**
  - ห้องแชทเหลือช่องพิมพ์แถวเดียว `+ | ข้อความ | ไมค์ | ส่ง` ขยายเองตามข้อความ
  - ใต้ช่องพิมพ์: สิทธิ์ของ AI ทางซ้าย และ AI / Model / Effort ทางขวา ตัวเลือกอื่นอยู่ในปุ่ม ⚙
  - ขณะ AI ทำงานและยังไม่ได้พิมพ์ ปุ่มส่งจะเป็นปุ่มหยุด
- **พิมพ์แทรกได้ทันที (Interrupt):** กด Enter ขณะ AI ยังตอบอยู่ คำตอบเดิมจะหยุดแล้วส่งข้อความใหม่ต่อในบทสนทนาเดิมทันที ส่วน Ctrl+Enter ยังเป็นการต่อคิว
- **แนะนำข้อความถัดไป (กด Tab):** หลัง AI ตอบเสร็จ ช่องพิมพ์แสดงข้อความถัดไปเป็นตัวอักษรสีเทา กด Tab เพื่อใช้ ใช้ขั้นตอนถัดไปจากคำตอบก่อน ถ้าไม่มีจะให้ AI รุ่นเล็กเดา (Claude ใช้ Haiku) ปิดได้ในการตั้งค่า
- **แจ้งเตือนเมื่องานเสร็จ:** การแจ้งเตือนของ Windows, ไอคอน taskbar กะพริบ และเสียงสั้น ๆ เมื่อ Agent / Chat / แชทของ CLI ทำงานเสร็จระหว่างที่อยู่หน้าต่างอื่น กดแล้วกลับไปยังบทสนทนานั้น ตั้งค่าได้ในแท็บ "แจ้งเตือนและคำแนะนำ"
- **แจ้งเตือนในแอปแบบใหม่:** เปลี่ยนแถบแจ้งเตือนเป็นกล่องเล็กลอยด้านบน ไม่ดันหน้าจอ แสดงคำแนะนำเฉพาะเมื่อรู้สาเหตุ (โควตา / บัญชี)
- **การอ่านและจัดการบทสนทนา:** ค้นหาในบทสนทนา, แถบเครื่องมือเมื่อเลือกข้อความ, เมนูข้อความ, Fork / Side chat, เลือกสไตล์คำตอบ, ปุ่มกลับไปข้อความล่าสุด, ส่งออกบทสนทนา, โปรเจกต์โปรด และเปลี่ยนชื่อห้อง
- **Project Context:** คำสั่งประจำโปรเจกต์และไฟล์ที่ปักหมุดถูกส่งไปกับทุกคำขอของ AI พร้อมแสดงสถานะเหนือช่องพิมพ์
- **Power features:** วางรูปด้วย Ctrl+V, Live canvas artifacts, กฎโปรเจกต์ (.cursorrules) และขั้นตอนการทำงานของ Agent แบบพับได้; ตัดแถบสถานะด้านล่างออก และตรวจ rate limit ของ Codex ได้แม่นขึ้น
- **UI ไม่ล้นกรอบ:** ตรวจอัตโนมัติ 28 หน้าจอ (1040×680 ถึง 1920×1080) แก้ปุ่มในแถวช่องพิมพ์ที่ทับกันเมื่อเปิด Preview บนจอแคบ

---

# SuperAi & RAKKYXD v1.0.28

## มีอะไรใหม่ใน v1.0.28 (New Minimal Interface, Quick Provider Conversation, Unified History & URL Ctrl+Click)

- **New Minimal Interface & Warm Charcoal Design:**
  - ปรับโฉมดีไซน์ใหม่ทั้งหมดให้เป็นสไตล์ Minimal เรียบหรู สะอาดตา สบายตา ลดความรกรุงรัง (Visual Clutter) และเพิ่มพื้นที่ทำงานสูงสุด
  - สวิตช์สลับ 3 โหมด (Agent / Code / Chat) กะทัดรัดแบบ 3-Icon Switch เข้าถึงรวดเร็ว มีสถานะเลือกและ Tooltips ชัดเจน
  - ปรับโครงสร้างธีมสี คอนทราสต์ และไอคอนแถบเครื่องมือให้เรียบแบน สบายตา ไม่ดึงดูดสายตาจากงานหลัก
- **Unified Provider & Quick Conversation Flow:**
  - เริ่มบทสนทนากับ AI ได้ทันทีโดยไม่ต้องสร้างโฟลเดอร์หรือตั้งค่าโปรเจกต์ก่อน รองรับ Safe Read-only Quick Chat เพื่อป้องกันการแก้ไขไฟล์โดยไม่ตั้งใจ
  - เมนู **Composer Options** รวมการตั้งค่าระดับ Effort, สิทธิ์การทำงาน/เขียนไฟล์ และรายละเอียดบัญชี AI ไว้ในจุดเดียว พร้อมปิดด้วยปุ่ม `Escape` หรือคลิกด้านนอก
  - ป้ายระบุตัวตนผู้ให้บริการ (**Provider Badges**) ชัดเจนใน Sidebar, Session Tab และ Composer
- **Unified History Panel & Full-Text Search:**
  - แผงประวัติการสนทนารวมทุกเซสชันของทุก AI เข้าด้วยกันในหน้าจอเดียว
  - ค้นหาข้อความแบบ Full-Text Search พร้อมตัวกรองตามผู้ให้บริการ AI (Claude, Codex, Antigravity, OpenCode, Freebuff)
  - คลิกเพื่อสลับกลับมาคุยต่อที่เซสชันเดิมได้ทันที รวมทั้งเซสชันที่ซ่อนอยู่
- **Ctrl + Click เพื่อเปิด URL ทันที (เหมือน Claude App / VS Code):**
  - กด **Ctrl + Click** (หรือ **Cmd + Click** บน macOS) บน URL ใดๆ ในช่องพิมพ์ข้อความ (Composer) เพื่อเปิดเว็บในเบราว์เซอร์หลักของระบบทันที
  - แปลง URL ในข้อความแชทของผู้ใช้ (Chat Bubbles) เป็นลิงก์ที่คลิกเปิดได้อัตโนมัติ
  - เพิ่ม **🔗 Quick Link Chips** แสดงใต้ช่องพิมพ์เมื่อพบ URL ในข้อความที่กำลังพิมพ์
- **Session Hide / Restore & Git Worktrees:**
  - ซ่อนและกู้คืนเซสชันทำงานได้โดยไม่ลบข้อมูล ประวัติ และโปรเซสยังคงทำงานอยู่ครบถ้วน
  - สลับ Branch และทำงานคู่ขนานผ่าน Git Worktrees พร้อมแถบ Smart Merge Banner

---

# SuperAi & RAKKYXD v1.0.27

## มีอะไรใหม่ใน v1.0.27 (Git Branch Switcher, Workspace Location Picker & Session Visibility Polish)

- **Interactive Git Branch Selection Strip (`BranchSelection.ts`, `ComposerLocation.tsx`):**
  - แสดงและสลับ Git Branch จริงของโปรเจกต์ได้โดยตรงจากแถบเหนือช่องพิมพ์คำสั่ง
  - เมนูค้นหาและเลือก Local Branch พร้อมแสดงสถานะ Branch ปัจจุบัน
  - ระบบตรวจสอบความปลอดภัย ป้องกันการสลับ branch ขณะมีงาน AI ทำงานอยู่ หรือโฟลเดอร์มี Uncommitted Changes
  - รองรับการสลับโฟลเดอร์ทำงานของโปรเจกต์โดยคงข้อความคำสั่งเดิมไว้
- **Session Visibility & Hide Toggle (`SessionCanvas.tsx`, `App.tsx`):**
  - ปุ่มซ่อนพับเก็บ Session (`EyeOff`) บนหัวหน้าต่างของแต่ละ Session ช่วยจัดพื้นที่ทำงานให้เหลือเฉพาะ Session ที่กำลังใช้งานโดยไม่ลบ Session ไม่ลบประวัติแชต และโปรเซสยังทำงานอยู่ครบ 100%
  - เปิด Session กลับมาแสดงบนหน้าจอหลักได้ทันทีจาก 2 จุด: คลิกแถบซ้าย (มีป้าย `ซ่อนอยู่`) หรือคลิกชิป `ซ่อนอยู่ X: [👁 ชื่อ session]` บนแถบด้านบน
  - เพิ่มปุ่ม "ซ่อนไว้ก่อน (ไม่ลบ)" ในหน้าต่างยืนยันลบเซสชัน ป้องกันการเผลอลบข้อมูลผิดพลาด
- **UI & Workspace State Refinements:**
  - ปรับปรุงการคำนวณ Grid และ Splitter ให้รองรับกรณีซ่อนเซสชันทั้งหมด พร้อมแสดงการ์ดกู้คืนตรงกลางหน้าจอ
  - ปรับปรุงการ Broadcast ข้อความในโหมด Code ให้ส่งเฉพาะ Session ที่เปิดแสดงอยู่บนหน้าจอ

---

# SuperAi & RAKKYXD v1.0.26

## มีอะไรใหม่ใน v1.0.26 (Parallel Git Worktrees, Beginner Experience, Interactive Artifacts & UI Polish)

- **Parallel Git Worktrees & One-Click Smart Merge:** แยกโฟลเดอร์ทำงานคู่ขนานใน `.worktrees/<branch>` เพื่อพัฒนาโค้ดพร้อมกันได้ 100% โดยไม่ทับซ้อนกัน พร้อมแถบ **Smart Merge Banner** ในหน้าต่างตรวจสอบไฟล์ที่เปลี่ยน ให้รวมโค้ดกลับเข้าสู่ `main` และลบ Worktree อัตโนมัติได้ในคลิกเดียว
- **Working Folder & Real Git Branch Strip (`ComposerLocation`):** แสดงโฟลเดอร์ทำงานจริงและชื่อ Git Branch ล่าสุดเหนือช่องพิมพ์คำสั่ง พร้อมสลับตาม Session ที่เลือก หรือแสดงจำนวนโฟลเดอร์เมื่อส่งแบบ Broadcast
- **3-Step Beginner Onboarding & Curated Starter Skills:** ปรับโฉมหน้าต่างเริ่มต้นใช้งานและหน้าจอต้อนรับให้เข้าใจง่ายสำหรับมือใหม่ใน 3 ขั้นตอน (เลือกโฟลเดอร์ → เลือกผู้ช่วยและบัญชี → เลือกตัวอย่างงานหรือพิมพ์คำสั่ง) พร้อมชุด Starter Skills บน `skills.sh` ที่กดติดตั้งได้ทันทีเมื่อผู้ใช้เลือก
- **Session Hide / Collapse Without Deleting:** พับเก็บ Session ออกจากพื้นที่ทำงานหลักชั่วคราวโดยไม่ลบประวัติแชตหรือโปรเซส พร้อมชิปเปิดกลับบนแถบด้านบนและแถบข้างซ้าย
- **Interactive Local React/JSX/TSX, SVG Zoom/Fit & Mermaid Artifacts:** พรีวิวโค้ด React/JSX/TSX แบบโต้ตอบได้จริงด้วย Local Runtime + Sucrase, ซูมและจัดขนาดไดอะแกรม SVG/Mermaid พร้อมโหมดขยายเต็มกรอบที่รองรับปุ่มปิดและปุ่มลัด `Escape`
- **UI & Dialog Usability Polish:**
  - แก้ไขปัญหาปุ่มแนบไฟล์ (`+`) ซ้อนทับกับแถบเครื่องมือด้านล่างของช่องพิมพ์คำสั่งในโหมด Terminal / Agent / Chat
  - เพิ่มการป้องกันข้อมูลว่างใน `ChangesPanel` และ `WorktreeModal` ไม่ให้เกิดหน้าจอค้างเมื่อตรวจไฟล์ที่เปลี่ยน
  - รองรับการกด `Escape` และคลิกพื้นที่ว่างเพื่อปิดหน้าต่างย่อย (`WorktreeModal`, เมนูปักหมุดไฟล์ `+ ปักหมุดไฟล์`, เมนูแนบไฟล์ และ Quick Editor โหมดขยาย) อย่างเป็นธรรมชาติ

---

# SuperAi & RAKKYXD v1.0.25

## มีอะไรใหม่ใน v1.0.25 (Unified AI Provider Hub & Multi-AI Suite)

- **Unified Cloud Provider Engine (BYOK):** เชื่อมต่อโมเดลชั้นนำโดยตรงผ่าน API Key ได้แก่ **DeepSeek** (V3 & R1 Reasoning), **Groq** (Llama 3.3 70B Ultra-fast), และ **OpenRouter** พร้อมการจัดการความปลอดภัย ป้องกันข้อมูลรั่วไหลและจำกัด Destination Origin
- **Visual Side-by-Side & Inline Diff Viewer:** ตรวจสอบโค้ดที่เปลี่ยนแปลงได้ 3 รูปแบบ (Side-by-Side แบบสองฝั่งคู่ขนาน, Inline และเปิดดูไฟล์เต็ม) พร้อมคำนวณหมายเลขบรรทัด และปุ่ม Stage / Unstage / Discard ไฟล์ Git ได้โดยตรง
- **Interactive Project File Explorer & Quick Editor:** แถบสำรวจไฟล์โปรเจกต์ในตัวแบบ Tree-view กรองโฟลเดอร์ที่ไม่จำเป็น (node_modules, .git) พร้อมระบบ Quick Editor ให้แก้ไขและบันทึกไฟล์ได้ทันทีโดยไม่ต้องเปิดโปรแกรมภายนอก
- **Multi-AI Comparison Arena:** โหมดเปรียบเทียบคำตอบของ AI หลายตัวพร้อมกัน แสดงข้อมูลสถิติละเอียด (TTFT ความเร็วคำแรก, เวลาตอบทั้งหมด, Token/s และจำนวน Token) พร้อมติดตรา "ตอบเร็วที่สุด (Winner)"
- **Cross-Agent Handoff Pipeline:** ส่งต่องานหรือคำตอบจาก AI ตัวหนึ่งไปยังอีกตัวหนึ่งได้ในคลิกเดียว (ส่งต่อเข้า Claude, Codex, Gemini, DeepSeek ฯลฯ) พร้อมปรับปรุง Prompt อัตโนมัติ
- **Inline Image Zoom & Pan Viewer:** แสดงรูปภาพ Thumbnail ในแชตและ Markdown พร้อมคลิกเปิด Modal เพื่อซูมลึก (Zoom in/out, 100%, Fit) และลากเลื่อน (Pan) ได้สะดวกรวดเร็ว
- **Unified Usage & Token Limits Display:** ปรับปรุงหน้าต่างแสดงโควตาการใช้งาน จัดเรียงช่วงเวลา 5 ชั่วโมงและรายสัปดาห์อย่างเป็นระเบียบ พร้อมแสดงเวลารีเซ็ตที่ถูกต้องแม่นยำ

---

# SuperAi & RAKKYXD v1.0.24

## มีอะไรใหม่ใน v1.0.24

- **แก้ไขด่วน (Hotfix):** แก้ไขข้อผิดพลาด `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` เมื่อค้นหาหรือปักหมุดไฟล์ในเมนู Pinned Project Files ให้รองรับโครงสร้างข้อมูลแบบสตริงอย่างถูกต้อง
- **ความเสถียรของหน้าต่างแอพพลิเคชัน:** เพิ่มการป้องกัน Type Safety ในแถบไฟล์ปักหมุด ไม่ให้เกิด ErrorBoundary Crash บนหน้าจอ

---

## ฟีเจอร์หลักในซีรีส์ v1.0.x
- **Live Artifacts Preview:** พรีวิวสด HTML, SVG, Tailwind CSS และไดอะแกรม Mermaid ข้างหน้าต่างแชต พร้อมปุ่ม "✦ เปิดใน Artifact" จากโค้ดบล็อก
- **Mention Menu (`@file`):** พิมพ์ `@` เพื่อค้นหาและแนบไฟล์โปรเจกต์
- **Collapsible Thinking Block:** บล็อกซ่อน/ขยายกระบวนการคิด `<thinking>` สไตล์ Extended Thinking พร้อมแสดงจำนวนคำและระยะเวลา
- **Project Knowledge (Pinned Files):** ปักหมุดไฟล์สำคัญประจำ Workspace เพื่อส่งเป็น Context พื้นฐานให้อัตโนมัติในโหมด Agent และ Chat
- **Command Palette (`Ctrl + K` / `Cmd + K`):** ค้นหาและสลับเซสชัน / โปรเจกต์ได้โดยไม่ต้องแตะเมาส์
- **Project Custom Instructions:** ตั้งค่าคำสั่งและกฎเฉพาะโปรเจกต์ พร้อมป้ายแสดงสถานะสี Clay Accent
