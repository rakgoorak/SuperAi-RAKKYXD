# SuperAi & RAKKYXD v1.2.8

- **Side browser stability:** Fixed an Electron main-process crash (`Cannot read properties of undefined (reading 'getURL')`) when OAuth or sign-in popups (such as Google Sign-In) close themselves inside the built-in browser panel.
- **OAuth popups:** Popups opened from the side browser panel now preserve `window.opener`, session cookies (`persist:superai-preview`), and `about:blank` redirects, and automatically return focus to the opener tab when closed.
- **Browser automation resilience:** `browser_click`, `browser_type`, and `browser_press` safely switch to the active tab if an action opens a popup or closes the current tab.

## ภาษาไทย

- **ความเสถียรของเบราว์เซอร์ในแอป:** แก้ไขปัญหาโปรแกรมหลักแครช (`Cannot read properties of undefined (reading 'getURL')`) เมื่อหน้าต่าง popup สำหรับล็อกอิน (เช่น Google Sign-In) ปิดตัวเองในแผงเบราว์เซอร์ด้านข้าง
- **Popup ล็อกอิน (OAuth):** หน้าต่าง popup ที่เปิดจากเบราว์เซอร์ในแอปยังคงรักษา `window.opener`, คุกกี้เซสชัน (`persist:superai-preview`) และการเปลี่ยนเส้นทางผ่าน `about:blank` พร้อมสลับกลับแท็บต้นทางอัตโนมัติเมื่อปิด
- **ความทนทานของ Browser Automation:** คำสั่ง `browser_click`, `browser_type` และ `browser_press` สลับไปจับภาพ/อ่านแท็บที่ใช้งานอยู่ต่อได้อย่างปลอดภัยเมื่อเกิดการเปิดหรือปิด popup ระหว่างทำงาน

---

# SuperAi & RAKKYXD v1.2.7

- **Browser Use:** Chrome and Edge launched by SuperAi run in the background by default. You can show the window for sign-in or opt into a local DevTools connection and select an existing tab.
- **File attachments:** Browser Use can discover hidden file inputs and attach local files directly without opening the system file picker.
- **Chat responsiveness:** Skill lookup and pre-turn Git checkpoints use asynchronous paths. The chat can record the message before the checkpoint finishes and start the CLI after the checkpoint is ready.
- **Chat queue:** Removing a queued message restores its text to the composer for editing and preserves any draft already there.
- **Automatic permissions:** Codex Auto uses native automatic review within the workspace sandbox. Computer Use retains per-app consent.
- **Antigravity:** Chat sessions can use SuperAi's Browser and Computer Use tools via MCP and show clearer tool names in the conversation.

## ภาษาไทย

- **Browser Use:** Chrome และ Edge ที่ SuperAi เปิดทำงานเบื้องหลังเป็นค่าเริ่มต้น เปิดหน้าต่างเพื่อล็อกอินได้ หรือเลือกแท็บเดิมผ่านการเชื่อมต่อ DevTools ในเครื่องที่ผู้ใช้เปิดไว้
- **แนบไฟล์:** Browser Use ค้นหาช่องอัปโหลดที่เว็บซ่อนไว้และแนบไฟล์จากเครื่องได้โดยตรง โดยไม่ต้องเปิดหน้าต่างเลือกไฟล์ของระบบ
- **การตอบสนองของแชท:** ค้นหาสกิลและสร้าง Git checkpoint แบบอะซิงโครนัส แชทบันทึกข้อความได้ระหว่างรอ checkpoint และเริ่ม CLI เมื่อ checkpoint พร้อม
- **คิวแชท:** เอาข้อความออกจากคิวเพื่อดึงข้อความกลับมาแก้ในช่องพิมพ์ได้ พร้อมเก็บร่างเดิมที่พิมพ์ค้างไว้
- **สิทธิ์อัตโนมัติ:** โหมด Auto ของ Codex ใช้ตัวตรวจคำขออัตโนมัติภายใน workspace sandbox ส่วน Computer Use ขออนุญาตแยกตามแอป
- **Antigravity:** ใช้เครื่องมือ Browser Use และ Computer Use ของ SuperAi ผ่าน MCP และแสดงชื่อเครื่องมือในแชทชัดขึ้น

---

# SuperAi & RAKKYXD v1.2.6

- **Dynamic Client Assets (OTA):** sync web UI bundles in the background without needing new desktop releases or restarting the application.
- **Composer image preview:** click on attached images in the message input box to preview them in full size with zoom controls and quick copy/save actions, matching Claude Desktop.
- **Claude-style image lightbox:** floating dark translucent lightbox with blurred backdrop, larger image view, and click-backdrop-to-close.
- **Copy and Save image actions:** right-click context menu on images and viewer controls for immediate image copying and saving.
- **Stable session scrolling:** switching between sessions keeps the conversation pinned to the latest message without unwanted scroll jumps, even after large images load.
- **Skills dialog fix:** resolved polling reload loop and flickering in the Skills panel.

## ภาษาไทย

- **ระบบ Dynamic Client Assets (OTA):** ซิงค์หน้าตา UI ในเบื้องหลังได้ตลอดเวลาโดยไม่ต้องทำ Release ใหม่ทุกครั้งที่ปรับแก้หน้าเว็บ
- **กดดูรูปภาพในช่องพิมพ์แชท:** คลิกพรีวิวรูปภาพแนบในช่องพิมพ์แชทได้ทันทีเหมือน Claude Desktop พร้อมซูมและคัดลอกรูป
- **หน้าต่างพรีวิวรูปภาพสไตล์ Claude:** Lightbox โปร่งแสง พื้นหลังเบลอ สบายตา และคลิกพื้นที่ว่างรอบรูปเพื่อปิดได้
- **ปุ่มคัดลอกและบันทึกรูปภาพ:** คลิกขวาที่รูปในแชทเพื่อ Copy image หรือ Save image ได้ทันที พร้อมปุ่มบนแถบควบคุม
- **สลับ Session ลื่นไหล ไม่เลื่อนหลุด:** ตรึงหน้าจอไว้ที่ข้อความล่าสุดเสมอเมื่อสลับ Session หรือเมื่อรูปภาพขนาดใหญ่โหลดเสร็จ
- **แก้หน้าต่าง Skills กระพริบ:** แก้ไขลูปรีโหลดในหน้าต่าง Skills ให้อ่านและเลือกใช้งานได้อย่างราบรื่น

---

# SuperAi & RAKKYXD v1.2.5

- **Open a session without choosing a folder:** start any AI session in general chat right away, or switch between general chat and project folders directly from the New Session dialog.
- **Cleaner, more compact sidebar:** New Session sits at the top alongside Add Project, search and favorites share one row, session rows avoid repeating the provider name twice, and the bottom tools dock is arranged in a compact 2-column grid.
- **Immediate focus on new sessions:** opening a second or subsequent session focuses the new session immediately instead of snapping back to the first session.
- **Concise live status:** the working indicator now shows `Working · tokens · time` without repeating the CLI and model name.
- **Checkpoints, hunk review & Quick Ask:** rewind project files to before any message, review AI changes section by section, and open Quick Ask from anywhere with a global shortcut.

## ภาษาไทย

- **เปิด session ใหม่โดยไม่ต้องเลือกโฟลเดอร์:** กดเปิด session คุยทั่วไปได้ทันทีเหมือน Claude Desktop และ Codex Desktop หรือเลือกสลับระหว่างคุยทั่วไปกับโฟลเดอร์โปรเจกต์ได้ในหน้าต่างเปิด session
- **แถบข้าง (Sidebar) ใหม่ กะทัดรัดและสะอาดตา:** ย้ายปุ่ม `+ เปิด session ใหม่` ขึ้นด้านบนสุด รวมช่องค้นหากับดาวโปรเจกต์โปรดไว้แถวเดียว ไม่แสดงชื่อค่าย AI ซ้ำสองบรรทัด และจัดปุ่มเครื่องมือด้านล่างเป็น Grid 2 คอลัมน์
- **สลับไปหา session ใหม่ทันที:** แก้ปัญหาเปิด session ตัวที่ 2 แล้วหน้าจอดีดกลับไปหาตัวแรก
- **ข้อความสถานะกระชับขึ้น:** แสดงเฉพาะ `กำลังทำงาน · tokens · เวลา` โดยไม่พ่วงชื่อ CLI และโมเดลซ้ำ
- **Checkpoints, ตรวจแก้รายส่วน และ Quick Ask:** ย้อนไฟล์โปรเจกต์กลับไปก่อนข้อความใดก็ได้ ตรวจและเลือกเก็บ/ย้อนโค้ดที่ AI แก้ทีละส่วน และเรียกกล่องถามด่วนจากที่ไหนก็ได้ด้วยคีย์ลัด

---

# SuperAi & RAKKYXD v1.2.4

- **Answers look like Claude and Codex:** full Markdown in chat, including headings, nested and task lists, tables, and code coloured by language. Math (`\( \)`, `$$ $$`) is typeset, and `mermaid` code blocks are drawn as diagrams.
- **Click a file path to open it:** a path such as `D:\Projects\site.zip` opens its folder (Finder on Mac), and `src/app.ts:42` opens that line in Preview.
- **Message box like Claude Desktop:** starts as one line, grows with your text and images, and shrinks back after sending. Expand and Stop are no longer in the + menu; the send button still turns into Stop while the AI works.
- **For people outside Thailand:**
  - The AI answers in the language you write in. Before, Agent team and multi-AI answers were always in Thai.
  - Dates and times follow the app language.
  - Speak-to-type uses the multilingual model by default when the app is not in Thai.
  - Release notes come in English and Thai.
- **Usage count asks first:** the app now asks before counting your computer as a user. Nothing is sent and no ID exists until you allow it; saying no, or turning it off later, deletes the ID. Installs that already counted are asked once too. The Microsoft Store build never counts.

## ภาษาไทย

- **คำตอบแสดงผลแบบ Claude และ Codex:** แชทรองรับ Markdown เต็มรูปแบบ ทั้งหัวข้อ, list ซ้อนและ task list, ตาราง และโค้ดที่มีสีตามภาษา สูตรคณิต (`\( \)`, `$$ $$`) แสดงเป็นสมการ และบล็อก `mermaid` วาดเป็นแผนภาพ
- **กดที่อยู่ไฟล์เพื่อเปิด:** ที่อยู่อย่าง `D:\Projects\site.zip` กดแล้วเปิดโฟลเดอร์ (Mac เปิด Finder) และ `src/app.ts:42` เปิดบรรทัดนั้นใน Preview
- **ช่องพิมพ์แบบ Claude Desktop:** เริ่มเป็นบรรทัดเดียว ขยายตามข้อความและรูป แล้วย่อกลับหลังส่ง เอา "ขยายช่องพิมพ์" และ "หยุดงานปัจจุบัน" ออกจากเมนู + แล้ว ระหว่างที่ AI ทำงาน ปุ่มส่งยังเปลี่ยนเป็นปุ่มหยุดเหมือนเดิม
- **สำหรับผู้ใช้ต่างประเทศ:**
  - AI ตอบตามภาษาที่ผู้ใช้พิมพ์ (เดิมทีม Agent และถามหลาย AI ตอบเป็นไทยเสมอ)
  - วันที่และเวลาแสดงตามภาษาของโปรแกรม
  - พิมพ์ด้วยเสียงใช้โมเดลหลายภาษาเป็นค่าเริ่มต้น เมื่อโปรแกรมไม่ได้ตั้งเป็นภาษาไทย
  - บันทึกอัปเดตมีทั้งภาษาอังกฤษและไทย
- **นับจำนวนผู้ใช้ต้องขออนุญาตก่อน:** แอปจะถามก่อนนับเครื่องเป็นผู้ใช้ ถ้ายังไม่อนุญาตจะไม่ส่งอะไรและไม่มีรหัสสุ่ม ตอบไม่อนุญาตหรือปิดทีหลังจะลบรหัสทิ้ง เครื่องที่เคยนับอยู่แล้วจะถูกถามหนึ่งครั้ง และเวอร์ชัน Microsoft Store ไม่นับเลย

---

# SuperAi & RAKKYXD v1.2.3

- **อัปเดตข้ามไปเวอร์ชันล่าสุดได้เลย:** ถ้าไม่ได้อัปมาหลายเวอร์ชัน กดอัปเดตครั้งเดียวก็ได้เวอร์ชันล่าสุด ไม่ต้องอัปทีละเวอร์ชัน (มีผลตั้งแต่การอัปเดตครั้งถัดจากนี้)
- **วิดีโอเล่นในแชทได้:** ลิงก์ mp4, webm, mov ในคำตอบเล่นในแชทได้ทันที รูปและวิดีโอที่อยู่นอกโปรเจกต์ กด "แสดงรูปนี้" หรือ "แสดงวิดีโอนี้" ครั้งเดียวก็แสดง
- **Mac: แท็บ "สิทธิ์ macOS" ใน Settings:** ดูและขอสิทธิ์ไมโครโฟน กล้อง บันทึกหน้าจอ Accessibility และ Full Disk Access ได้ในที่เดียว
- **อัปเกรดพื้นฐาน:** Electron 45, React 19, Express 5 และตัวพิมพ์เสียงรุ่นใหม่ (transformers.js 4)

---

# SuperAi & RAKKYXD v1.2.2

- **Mac ไม่ต้องให้สิทธิ์ใหม่ทุกครั้งที่อัปเดต:** ทุก release เซ็นด้วยใบรับรองเดียวกัน สิทธิ์ Accessibility และ Screen Recording จึงยังอยู่หลังอัปเดต
  - **อัปเดตครั้งนี้ครั้งเดียว:** ลายเซ็นเปลี่ยน ต้องเปิดสิทธิ์ทั้งสองใหม่ หรือกด "รีเซ็ต" ใน Settings > AI control หลังจากนั้นจะไม่หลุดอีก
  - ตอนเปิดครั้งแรกยังต้องกด Open Anyway เหมือนเดิม
- อัปเดตไลบรารีย่อย (playwright-core, ws, autoprefixer, postcss)

---

# SuperAi & RAKKYXD v1.2.1

- **Session ไม่หายตอนไฟดับ:** รายการ session ที่เปิดอยู่และประวัติแชตบันทึกแบบกันไฟดับ ถ้าเครื่องดับระหว่างบันทึก จะได้ฉบับก่อนหน้าคืนมา ไม่กลายเป็นรายการว่าง
- **Computer Use เร็วขึ้น:** ภาพหน้าจอบน Windows ใช้เวลาราว 0.2 วินาที (เดิม 0.6 วินาที) และส่งให้ AI เป็น JPEG ไฟล์เล็กลงราว 4 เท่า AI จึงตอบเร็วขึ้น คำสั่งแรกไม่ต้องรอนาน
- **เคอร์เซอร์ AI สวยขึ้น:** วงกลมตอนคลิก เงา และป้ายแสดงครบ ไม่ขาด และเลื่อนนุ่มขึ้น
- **Browser ข้างเล่นวิดีโอได้:** เปิด mp4, webm และ mov ได้ ส่วนไฟล์ที่อยู่นอกโปรเจกต์ กด "เปิดดูไฟล์นี้" เพื่อเปิดดูได้
- **ตั้งค่าบน Mac ง่ายขึ้น:**
  - หน้าต่างอนุญาตมีขั้นตอนตั้งค่าครั้งแรก กดเปิด System Settings ได้ทันที เปิดสวิตช์แล้วแถวเปลี่ยนเป็นสีเขียวเอง
  - มีปุ่ม "รีเซ็ต" ถ้าสวิตช์เปิดอยู่แล้วแต่ยังใช้ไม่ได้ (มักเกิดหลังอัปเดต)
- **แก้บน Mac:** กด Dock ได้แล้ว (เดิมถูกปฏิเสธ) และพิมพ์บนเครื่องที่ช้าไม่วางข้อความเก่าจาก clipboard อีก

---

# SuperAi & RAKKYXD v1.2.0

- **AI มีเคอร์เซอร์ของตัวเอง (เหมือน Claude Desktop):** ลูกศรของ AI เลื่อนไปยังจุดที่จะทำงาน พร้อมป้ายบอกว่ากำลังทำอะไร เช่น "คลิก" และ "กำลังคิด…" ระหว่างขั้นตอน ทั้งตอนควบคุมคอมพิวเตอร์และในหน้าเว็บของ Browser
- **AI คลิกโดยไม่แย่งเมาส์ (Windows):** ปุ่มส่วนใหญ่ถูกกดผ่าน accessibility เมาส์ของคุณไม่ขยับ ถ้าจำเป็นต้องใช้เมาส์จริง จะคืนเมาส์กลับที่เดิมให้
- **ปุ่มลัดหยุด AI:** ระหว่างที่ AI ควบคุมคอมพิวเตอร์ กด Ctrl+Alt+Esc (macOS: ⌘⇧Esc) จากที่ไหนก็ได้ AI จะหยุดทันทีเหมือนกดปุ่มหยุด (ถ้าแอปอื่นใช้ปุ่มนี้อยู่ จะเลือกปุ่มสำรองและแสดงไว้ที่ปุ่มหยุด)
- **ปลอดภัยขึ้น:**
  - AI ไม่พิมพ์ลงช่องรหัสผ่าน จะขอให้คุณพิมพ์เอง
  - โปรแกรมจัดการรหัสผ่าน กระเป๋าคริปโต และแอปธนาคาร AI ดูได้อย่างเดียว (ป้ายแดง "ข้อมูลสำคัญ")
  - ภาพหน้าจอที่ส่งให้ AI ไม่มีแถบ กรอบเรืองแสง หรือเคอร์เซอร์ของ SuperAi ติดไป

---

# SuperAi & RAKKYXD v1.1.0

- **อนุญาตให้ AI ใช้ทีละแอป (เหมือน Claude Desktop):** ก่อนควบคุมคอมพิวเตอร์ AI จะขอใช้แอปตามชื่อ หน้าต่างอนุญาตแสดงรายชื่อแอปพร้อมระดับสิทธิ์ แล้ว AI คลิกและพิมพ์ได้เฉพาะในแอปที่อนุญาต
  - เบราว์เซอร์: ดูได้อย่างเดียว (หน้าเว็บให้ AI ใช้ Browser ในแอปแทน)
  - Terminal และโปรแกรมเขียนโค้ด: คลิกและเลื่อนได้เท่านั้น พิมพ์ไม่ได้
  - AI ควบคุมหน้าต่างของ SuperAi เองไม่ได้
  - ดูและยกเลิกแอปที่อนุญาตของแต่ละแชตได้ที่ การตั้งค่า > ควบคุมคอมพิวเตอร์
- **AI ใช้แอปได้เร็วขึ้นโดยไม่แย่งเมาส์:** AI อ่านปุ่มและช่องของแอปเป็นรายการสั้น ๆ แล้วกดหรือกรอกได้ทันที ไม่ต้องดูภาพหน้าจอทุกขั้น ไม่ขยับเมาส์ คุณใช้เครื่องต่อได้ระหว่างที่ AI ทำงาน (แอปที่อ่านไม่ได้ เช่น เกม จะกลับไปใช้ภาพหน้าจอเอง)
- **อัปเดตแบบเงียบ:** ดาวน์โหลดเวอร์ชันใหม่ไว้เบื้องหลังโดยไม่ขึ้นการ์ด พร้อมแล้วจึงมีปุ่ม "รีสตาร์ทเพื่ออัปเดต" และถ้าไม่กด จะติดตั้งให้เองตอนปิดโปรแกรม (มีผลตั้งแต่การอัปเดตครั้งถัดไป)
- **กรอบเรืองแสงตอน AI ควบคุมคอมพิวเตอร์เต็มรอบจอ:** ไม่ขาดตรงมุม ไม่ถูก taskbar บัง และทุกด้านกะพริบพร้อมกัน

---

# SuperAi & RAKKYXD v1.0.49
<!-- superai-update: hard -->

- **AI ขออนุญาตก่อนควบคุมคอมพิวเตอร์:** ทุกครั้งที่ AI จะดูหน้าจอหรือคลิก จะมีหน้าต่างให้กด อนุญาต หรือ ปฏิเสธ (อนุญาตเฉพาะงานนี้ หรือทั้งแชต) ปฏิเสธแล้ว AI จะไม่ถามซ้ำทันที และยกเลิกสิทธิ์ทั้งหมดได้ที่ การตั้งค่า > ควบคุมคอมพิวเตอร์
- **ใช้ได้ทุกจอ:** แถบสถานะพร้อมปุ่มหยุดและขอบเรืองแสงขึ้นทุกจอ บอกว่า AI ทำงานอยู่จอไหน และ AI สั่งงานจอที่ 2, 3 ได้ คลิกตรงตำแหน่งแม้แต่ละจอตั้งสเกลต่างกัน
- **AI ควบคุมคอมพิวเตอร์ได้มากขึ้น:** ลากวาง ซูมดูส่วนเล็ก ๆ ของจอ ดูตำแหน่งเมาส์ และดับเบิลคลิก พิมพ์ภาษาไทยและภาษาอื่นได้แม่นขึ้น บน macOS มีปุ่มเปิด System Settings เพื่อให้สิทธิ์ Accessibility และ Screen Recording
- **Browser ของ AI ทำงานครบขึ้น:** ใช้งานในกรอบ (iframe) และ shadow DOM ได้ หน้าเว็บที่เด้ง confirm / prompt ไม่ทำให้ค้างแล้ว พิมพ์ไม่หล่นตัวอักษร และเลือกแท็บด้วยเลขได้
- **/goal และ /boost ในแชต:** ส่งคำสั่งแบบ / ไปถึง AI ตรงตามที่พิมพ์ (/goal ใช้ได้กับ Claude Code และ Antigravity, /boost กับ Antigravity)
- **เวอร์ชัน Microsoft Store แจ้งเมื่อมีเวอร์ชันใหม่**

---

# SuperAi & RAKKYXD v1.0.48
<!-- superai-update: hard -->

- **ให้ AI ควบคุมคอมพิวเตอร์ได้ (ต้องเปิดเอง):** เปิดที่ การตั้งค่า > ควบคุมคอมพิวเตอร์ แล้ว AI จะดูหน้าจอ คลิก พิมพ์ (ทุกภาษา) กดปุ่มลัด และเลื่อนหน้าจอเพื่อทำงานในแอปอื่นได้ ระหว่างที่ AI ทำงานจะมีแถบ "AI กำลังควบคุมคอมพิวเตอร์" พร้อมปุ่มหยุด
- **AI ใช้ Chrome / Edge ของเครื่องได้:** สั่ง AI ให้ใช้ Chrome หรือ Edge เปิดเว็บและทำงานแทนได้ โดยเปิดเป็นหน้าต่างแยกที่ใช้โปรไฟล์ของ SuperAi (ล็อกอินครั้งเดียวแล้วจำไว้)
- **ตัวติดตั้งใช้ได้ 4 ภาษา:** ไทย อังกฤษ ญี่ปุ่น และจีน ภาษาที่เลือกตอนติดตั้งจะเป็นภาษาของแอปด้วย และเมนูไอคอนถาดระบบกับข้อความอัปเดตก็แปลแล้ว
- **เลือกบัญชีง่ายขึ้น:** ไม่มีตัวเลือก "บัญชีเดิมของเครื่อง" แล้ว แอปใช้บัญชีแรกที่คุณสมัครเป็นค่าเริ่มต้น และแสดงบัญชีเป็นปุ่มให้กดสลับ

---

# SuperAi & RAKKYXD v1.0.47

- **ใช้ได้ 4 ภาษา:** ทุกหน้าจอและทุกข้อความแสดงเป็นไทย อังกฤษ ญี่ปุ่น หรือจีนได้ครบ เปิดครั้งแรกจะใช้ภาษาของเครื่อง (ถ้าไม่ใช่ 4 ภาษานี้จะเป็นภาษาอังกฤษ) และเปลี่ยนได้ที่หน้าเริ่มต้นใช้งานหรือปุ่มภาษาด้านบน
- **AI ใช้ Browser ในแอปได้เอง:** สั่ง Claude, Codex หรือ OpenCode ให้เปิดเว็บ อ่านหน้า คลิก พิมพ์ กรอกฟอร์ม และถ่ายภาพหน้าจอใน Browser ด้านขวาได้เลย คุณเห็นทุกขั้นตอน ไม่ต้องตั้งค่าอะไร
- **เพิ่ม MCP ด้วยการวาง JSON:** ที่ MCP Servers > เพิ่ม Server วาง JSON แบบ mcpServers จากคู่มือของ MCP ได้เลย และเลือกเพิ่มให้หลาย AI พร้อมกัน

---

# SuperAi & RAKKYXD v1.0.45

- **แถบใต้ช่องพิมพ์เรียงเป็นระเบียบเมื่อจอแคบ:** เดิมเมื่อเปิดแผงด้านข้าง (เช่น Preview) แถบจะแตกเป็น 3 แถว และไอคอนปรับแต่งหล่นไปอยู่แถวล่างตัวเดียว ตอนนี้เป็น 2 แถวเต็ม โดยไอคอนปรับแต่งอยู่ท้ายแถวโฟลเดอร์และ branch

---

# SuperAi & RAKKYXD v1.0.44
<!-- superai-update: hard -->

- **กด X แล้วแอปไม่ปิด แต่ย่อลงถาดระบบ:** งานที่ AI ทำค้างอยู่จะรันต่อเบื้องหลัง
  - เปิดกลับ: คลิกไอคอน SuperAi ที่ถาดระบบ (มุมขวาล่างของ Windows หรือแถบเมนูของ macOS)
  - ปิดโปรแกรมจริง: คลิกขวาที่ไอคอนแล้วเลือก "ออกจากโปรแกรม (Exit)"
- รวมการแก้ไขจาก v1.0.43: Codex แก้ไฟล์ได้บน Windows และตัวเลือกสิทธิ์แบบใหม่ที่ใช้ง่ายขึ้น

---

# SuperAi & RAKKYXD v1.0.43
<!-- superai-update: hard -->

- **แก้ Codex แก้ไฟล์ไม่ได้บน Windows:** เดิมตั้งสิทธิ์เป็น Auto แล้ว Codex ยังตอบว่าเป็นอ่านอย่างเดียว หรือขึ้น blocked by policy โดยเฉพาะบัญชี Codex ที่เพิ่มในแอป และเครื่องที่ไม่เคยติดตั้ง Codex Desktop ตอนนี้แก้ไฟล์และรันคำสั่งได้ตามสิทธิ์ที่เลือก
- **เลือกสิทธิ์ง่ายขึ้น:** ทุก AI ใช้ตัวเลือกชุดเดียวกัน คือ อ่านอย่างเดียว, ถามก่อนทำ, ทำเองอัตโนมัติ และเต็มสิทธิ์ ชี้ที่ตัวเลือกเพื่อดูคำอธิบาย
- **AI ตัดสินใจถามเอง:** ไม่ต้องเปิดปุ่ม "ถามก่อนทำ" แล้ว งานใหญ่ที่ยังมีเรื่องต้องตัดสินใจ AI จะถามเป็นตัวเลือกก่อน งานชัดเจนจะลงมือทำเลย
- **แถบใต้ช่องพิมพ์และแผงปรับแต่งสั้นลง:** เหลือเฉพาะสิ่งที่ใช้บ่อย

---

# SuperAi & RAKKYXD v1.0.42
<!-- superai-update: hard -->

- **AI ถามแบบมีตัวเลือก:** เมื่อ AI ต้องให้คุณตัดสินใจ จะขึ้นการ์ดให้กดเลือกคำตอบ (มีป้าย "แนะนำ" เลือกได้หลายข้อ หรือพิมพ์คำตอบเอง) ใช้ได้กับทุก AI และทุกโหมดสิทธิ์ ปุ่ม "ถามก่อนทำ" ใต้ช่องพิมพ์จะให้ AI ถามให้ครบก่อนเริ่มแก้ไฟล์
- **ห้องแชตผ่าน API:** เปิดห้องคุยกับ OpenRouter, DeepSeek หรือ Groq ด้วย API Key ของคุณได้โดยตรง และเพิ่มผู้ให้บริการแบบ OpenAI-compatible เองได้ (ใส่ Base URL, ชื่อโมเดล และ key) ที่ การตั้งค่า > API Key
- **รายการงานแม่นขึ้น:** การ์ดรายการงานตรงกับที่ AI ทำจริง และข้อความที่กำลังตอบแสดงลื่นขึ้น

---

# SuperAi & RAKKYXD v1.0.41
<!-- superai-update: hard -->

- **บันทึก API Key ได้แล้ว:** เดิมบางเครื่องบันทึก key ของ OpenRouter, DeepSeek หรือ Groq ไม่ได้ (ขึ้นว่าระบบเข้ารหัสยังไม่พร้อม) เพราะไฟล์เก็บรหัสเดิมถอดรหัสไม่ได้ ตอนนี้แอปเก็บไฟล์เดิมไว้ข้าง ๆ แล้วเริ่มใหม่ให้ ถ้าบันทึกไม่ได้จะบอกสาเหตุจริง
- **หน้าจออัปเดตกลับมาปกติ:** การอัปเดตแบบบังคับแสดงเป็นหน้าต่างกลางจอพร้อมแถบความคืบหน้าเหมือนเดิม และการอัปเดตทั่วไปเป็นการ์ดมุมขวาล่าง (หน้าจอนี้มีผลตั้งแต่การอัปเดตครั้งถัดไป)

---

# SuperAi & RAKKYXD v1.0.40
<!-- superai-update: hard -->

- **แก้ OpenCode หยุดเงียบไม่ตอบ:**
  - OpenCode อ่านไฟล์ในโฟลเดอร์ temp ได้แล้ว (skill หลายตัวเขียนไฟล์ไว้ที่นั่นให้อ่านต่อ) เดิมคำขอถูกปฏิเสธแล้ว OpenCode หยุดทั้งงานโดยไม่มีคำตอบ
  - ถ้ารอบไหนจบโดยไม่มีคำตอบ แชตจะบอกสาเหตุและวิธีแก้ แทนการเงียบ
  - ส่งข้อความหา OpenCode เร็วขึ้นราว 2 วินาที (ไม่ต้องตรวจบัญชีก่อนทุกข้อความ)
- **ใช้หลายบัญชี:** เพิ่มบัญชี Claude, Codex และ OpenCode ได้มากกว่าหนึ่ง เลือกแยกต่อแท็บหรือผู้ช่วย ที่ การตั้งค่า > บัญชี AI
- **API ภายนอก:** ใช้ OpenRouter, DeepSeek และ Groq ด้วย API Key ของคุณในโหมด Agent และ Chat ใส่ key ที่ การตั้งค่า > API Key (key ถูกเข้ารหัสในเครื่อง)
- **โควตา:** Codex แสดงโควตาแบบสด ไม่ค้างตัวเลขเก่า และแสดงเครดิตคงเหลือของ OpenRouter และ DeepSeek
- **แชต:** แถบ "กำลังทำงาน" แสดงสิ่งที่ทำจริง แทนสัญลักษณ์ @'

---

# SuperAi & RAKKYXD v1.0.39
<!-- superai-update: hard -->

- **แก้ปัญหาต่อ Antigravity แล้วคุยไม่ได้:**
  - ชื่อรุ่นของ Antigravity มีระดับ effort อยู่ในชื่ออยู่แล้ว (เช่น `gemini-4-argon-high`) เมื่อเลือก Effort ไม่ตรงกับชื่อรุ่น หรือเลือก `xhigh` / `max` ที่ Antigravity ไม่รองรับ CLI จะปฏิเสธคำสั่งทันทีและไม่มีคำตอบ ตอนนี้แอปไม่ส่งค่าที่ขัดกันแล้ว มีผลทั้งโหมด Agent, Code และ Chat
  - Effort ของ Antigravity เหลือ low / medium / high และช่อง Effort จะปิดเองเมื่อเลือกรุ่นที่ระบุระดับในชื่อ
  - เมื่อ Antigravity ไม่ตอบเพราะสิทธิ์ที่เลือกไม่อนุญาตให้ใช้เครื่องมือ แอปจะแจ้งสาเหตุและแนะนำให้เปลี่ยนสิทธิ์ แทนการเงียบ
- **ตัวอัปเดต:** การบังคับอัปเดต (hard) ดูจากรายการของเวอร์ชันล่าสุดเท่านั้น ไม่นับเครื่องหมายของเวอร์ชันเก่า
- **แถบด้านบน:** ปรับไอคอนปุ่มสลับภาษา

---

# SuperAi & RAKKYXD v1.0.38

- **ทัวร์พากดสำหรับผู้ใช้ใหม่ (First-Run Interactive Tour):**
  - เปิดทัวร์สอนใช้งานแบบพากดอัตโนมัติหลังปิดหน้าต่างเริ่มต้นใช้งานครั้งแรก พร้อมปุ่มสลับภาษา 4 ภาษา (`TH`, `EN`, `JA`, `ZH`) บนหัวการ์ดทัวร์และแถบด้านบนสุด
- **ระบบนับผู้ใช้งานจริงแบบไม่ระบุตัวตน (Anonymous Usage Counter):**
  - เชื่อมต่อระบบนับจำนวนผู้ใช้งานจริงบนหน้าดาวน์โหลด (`superai-usage`) โดยส่งเฉพาะรหัสสุ่มของเครื่อง เวอร์ชันแอป และระบบปฏิบัติการ (สามารถปิดได้ใน การตั้งค่า > แจ้งเตือนและคำแนะนำ)
- **ปรับปรุงระบบหลายภาษา (Multi-Language UI):**
  - รองรับการแปลหน้าต้อนรับ (`WorkspaceWelcome`), ทัวร์สอนใช้งาน (`InteractiveTour`), แถบเมนูข้าง และช่องพิมพ์คำสั่งครบทั้ง 4 ภาษา

---

# SuperAi & RAKKYXD v1.0.37
<!-- superai-update: hard -->

- **แก้ปัญหาอัปเดตแล้วยังเป็นเวอร์ชันเดิม (macOS):**
  - ไฟล์ macOS ของ v1.0.36 เป็น build ของ v1.0.35 ทำให้กดติดตั้งอัปเดตแล้วยังขึ้น v1.0.35 และถูกเสนออัปเดตซ้ำ เวอร์ชันนี้ build ใหม่ครบทั้ง Windows, macOS Apple Silicon และ macOS Intel
  - ตัวอัปเดตตรวจเวอร์ชันข้างในไฟล์ก่อนติดตั้ง ถ้าไม่ตรงกับ release จะแจ้งข้อผิดพลาดแทนการติดตั้งวนซ้ำ
- **รองรับหลายภาษา (มาจาก v1.0.36):**
  - เลือกภาษาของหน้าจอได้ 4 ภาษา: ไทย, English, 日本語, 简体中文 ที่ การตั้งค่า > ภาษา / Language
  - เพิ่มเอกสารภาษาอังกฤษ (README_EN.md)
- **ยอดดาวน์โหลดคอมมูนิตี้:** แสดงจำนวนดาวน์โหลดจริงในหน้าอัปเดต

---

# SuperAi & RAKKYXD v1.0.35

- **Agent Workspace (2D/3D Office Visualizer):**
  - เพิ่มพื้นที่ทำงานเสมือนจริงของทีม Agent ในรูปแบบออฟฟิศ 2D/3D แสดงการทำงานของ Main และ Sub-agents แบบเรียลไทม์
  - แยกโซนชัดเจนระหว่าง "ห้องประชุม" (วิเคราะห์โจทย์และวางแผน) และ "ห้องทำงาน" (ลงมือเขียนโค้ดและรันงานที่โต๊ะทำงาน)
  - แอนิเมชันตัวละครตอบสนองตามสถานะงาน: พร้อมทำงาน, กำลังรับโจทย์, ประชุมแบ่งงาน, และเข้าประจำโต๊ะทำงาน
- **Clarifying Questions (ถามกลับแบบมีตัวเลือกก่อนเริ่มงาน):**
  - เพิ่มการตรวจความชัดเจนของเป้าหมายก่อนเริ่มทำงาน (เหมือน Claude) เมื่อโจทย์ยังกึ่งกำกวม AI จะถามกลับพร้อมตัวเลือก (Multiple-choice) แทนการเริ่มทำงานแบบสุ่ม
  - รองรับทั้งการเลือกข้อเดียว, เลือกได้หลายข้อ, ตัวเลือกแนะนำ (Recommended), และช่องกรอกเพิ่มเติม
  - รองรับการกดข้าม (Skip) เพื่อให้ AI ตัดสินใจเอง หรือกดยกเลิกงาน (Cancel) ได้ทันที
  - ใช้งานได้ทั้งในโหมด Agent (Main ถามก่อนวางแผน) และโหมด Chat (ตรวจคำถามก่อนส่งให้ทุก AI ตอบ)
- **ตัวควบคุมสิทธิ์เครื่องมือและความปลอดภัย (Tool Permission Control):**
  - เพิ่มสวิตช์เปิด/ปิด "อนุญาตให้ Sub-agent แก้ไขไฟล์และรันคำสั่ง" ในการตั้งค่าทีม Agent
  - โหมดปลอดภัย (Read-only / Plan mode): เมื่อปิดสิทธิ์ Sub-agents จะอ่านไฟล์ได้อย่างเดียว และเสนอโค้ดหรือขั้นตอนการปรับปรุงโดยไม่แตะต้องไฟล์จริง
  - โหมดลงมือทำ (Edit mode): เมื่อเปิดสิทธิ์ Sub-agents สามารถแก้ไขไฟล์และรันคำสั่งได้อย่างอิสระ
  - เพิ่มสวิตช์เปิด/ปิดระบบถามกลับ (Clarify) แยกอิสระในทั้งโหมด Agent และโหมด Chat

---

# SuperAi & RAKKYXD v1.0.34

- แสดงหน้าต่างป๊อปอัปและแถบแจ้งเตือนเมื่อ AI รอคำอนุญาต (Claude, Codex, OpenCode) พร้อมปุ่มอนุญาต / ไม่อนุญาต / จำสิทธิ์
- รองรับโปรโตคอลขอคำอนุญาตสำหรับ Codex (app-server) และ OpenCode อย่างสมบูรณ์
- แสดงสถานะคำขอที่ถูกยกเลิก หมดอายุ หรือส่งคำตอบไม่สำเร็จให้ตรงกับสถานะจริง
- หากช่องส่งคำตอบไปยัง CLI ใช้งานไม่ได้ ให้หยุดโปรเซสที่มีปัญหาและแจ้งข้อผิดพลาดหลังโปรเซสปิด เพื่อให้ผู้ใช้เริ่มงานใหม่ได้
- ปรับการกู้คืนคำขออนุญาตหลังเปิดโปรแกรมใหม่ และป้องกันข้อผิดพลาดจากรอบก่อนกระทบรอบถัดไป
- แจ้งเตือนสิทธิ์แม้ขณะแชทอยู่ในแท็บอื่นหรือย่อแอปพลิเคชัน
- แก้ไขการตั้งค่าเริ่มต้นของทีม Agent ใน AgentPanel ให้พร้อมทำงาน 3 บทบาท (Main + 2 Sub-agents)

---

# SuperAi & RAKKYXD v1.0.31

- จัดช่องพิมพ์ใหม่ให้กระชับ รวมโฟลเดอร์ สิทธิ์ และรุ่น AI ไว้ในแถวตั้งค่าด้านล่าง รองรับตอนเปิด Preview
- ย้ายบริบทและปักหมุดไว้ในเมนู + พร้อมรักษาการแนบไฟล์และคำสั่งหยุดงาน
- จัดแนวไอคอนค้นหากับปุ่มแชท/Terminal และปรับช่องเปลี่ยนชื่อห้องให้พอดี
- โหลดรายชื่อโมเดลใหม่เมื่อเปิดเมนูเลือก ไม่เก็บรายการเก่าไว้ตลอดการเปิดแอป เช่น GPT-6.1 Terra ที่ปรากฏในแคช Codex แล้ว
- รวมการแก้ไข Terminal/TUI และ macOS จาก v1.0.30

Build และการทดสอบ UI ผ่านตามบันทึกในโปรเจกต์ การทดสอบเปิดแอปจริงในสภาพแวดล้อม local ครั้งก่อนหมดเวลารอหน้าหลัก ไม่ถือว่าทดสอบผ่าน

## v1.0.30

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
