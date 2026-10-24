# SuperAi & RAKKYXD v1.0.23

## มีอะไรใหม่ใน v1.0.23

### 1. ฟีเจอร์ระดับเรือธง (Claude & Cursor Parity)
- **Live Artifacts Preview:** แผงแสดงผลและพรีวิวสดแบบ Interactive (รองรับ HTML, SVG, Tailwind CSS และไดอะแกรม Mermaid) แยกเป็นแท็บ Preview และ Code พร้อมปุ่ม "✦ เปิดใน Artifact" จากโค้ดบล็อก และปุ่มคัดลอก/ดาวน์โหลด
- **Autocomplete Mention (`@file`):** พิมพ์ `@` ในช่องป้อนข้อความเพื่อค้นหาไฟล์ในโปรเจกต์ พร้อมคีย์บอร์ดนำทาง (`↑` / `↓` / `Enter` / `Tab` / `Esc`) เพื่อแทรกไฟล์เข้าสู่บริบทการถามตอบ
- **Collapsible Thinking Block:** บล็อกสมองกลซ่อน/ขยายกระบวนการคิด `<thinking>` หรือ `<thought>` สไตล์ Extended Thinking พร้อมแสดงจำนวนคำและระยะเวลา
- **Project Knowledge (Pinned Files):** ปักหมุดไฟล์สำคัญประจำ Workspace เพื่อส่งเป็น Context พื้นฐานให้อัตโนมัติทุกครั้งที่เริ่มถามในโหมด Agent และ Chat พร้อมชิปแสดงผลและปุ่มเปิดดูใน Preview ได้ทันที
- **Command Palette (`Ctrl + K` / `Cmd + K`):** สปอตไลต์ค้นหาด่วน ช่วยสลับเซสชัน โปรเจกต์ หรือเรียกคำสั่งสำคัญได้อย่างรวดเร็วโดยไม่ต้องแตะเมาส์
- **Project Custom Instructions:** ตั้งค่าคำสั่งและกฎเฉพาะโปรเจกต์ พร้อมป้ายแสดงสถานะสี Clay Accent สวยงามเหนือช่องพิมพ์

### 2. ปรับปรุง UX และการจัดการข้อความ
- **แยกข้อความร่างและไฟล์แนบค้าง:** บันทึกข้อความร่างแยกตามแต่ละเซสชัน โปรเจกต์ และโหมดการทำงาน สลับแท็บไปมาแล้วเนื้อหาไม่สูญหาย
- **รูปภาพและ Lightbox ในแชต:** แสดงรูปย่อไฟล์แนบในข้อความที่ส่งแล้ว ทั้งในโหมด Code, Agent และ Chat สามารถคลิกดูภาพขนาดใหญ่พร้อมปุ่มดาวน์โหลด
- **ทำต่อจากคำตอบนี้ (Next Step Suggestions):** วิเคราะห์ข้อเสนอแนะ 1–3 ข้อจากคำตอบ AI เมื่อคลิกจะเติมข้อความลงในช่องพิมพ์ให้ตรวจทานก่อนส่ง

### 3. เสถียรภาพและการแพ็กเกจ (Stability & Security)
- **Electron GPU Crash Protection:** ป้องกัน Breakpoint Exception (`0x80000003`) ในสภาพแวดล้อม Windows ด้วยการปิดฮาร์ดแวร์เร่งความเร็วในกระบวนการทดสอบอัตโนมัติ
- **Native View Safety Guards:** เพิ่มการตรวจสอบสถานะ `isDestroyed()` ของ WebContentsView ป้องกัน Native dangling pointer ระหว่างการปิดและปรับขนาดหน้าต่าง

---

## ผลการทดสอบ (Verification)
- TypeScript & Production Build: ผ่านครบทุกแพ็กเกจ (Core, Studio, Client, Desktop)
- Monorepo Unit Tests: ผ่าน 168 ข้อ
- Browser Renderer Regression: ผ่านครบทุกข้อ ไร้ข้อผิดพลาด
- Native Electron Smoke Test: ผ่านครบ 7 ข้อบน Windows x64
