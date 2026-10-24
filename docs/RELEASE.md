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
