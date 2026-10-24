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
