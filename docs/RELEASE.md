# SuperAi & RAKKYXD v1.1.1

พื้นที่ทำงาน AI ภาษาไทย พร้อมโปรแกรม SuperAi Voice แยกต่างหาก

- จัด session หลายช่อง ปรับคอลัมน์ ขยายช่อง และลากจัดวางได้
- CLI: Claude Code, Codex, Gemini CLI, OpenCode, Freebuff และ Terminal
- ปุ่มติดตั้ง Claude Code, Codex, Gemini CLI, OpenCode และ Freebuff พร้อม log / ยกเลิก / ลองใหม่ (ต้องมี Node.js 22+ / npm)
- โหมดผู้ช่วยเลือกหัวหน้าและลูกทีม 1–3 คน พร้อม CLI/model แยกกัน หัวหน้าวางแผน ลูกทีมทำตามลำดับ ส่งผลกลับ และหัวหน้าสรุปภาษาไทย
- แสดงความคืบหน้า ผลรายงานแต่ละงาน และเก็บทีมแยกตามโปรเจกต์
- Gemini CLI / Freebuff ใช้ terminal ได้ ส่วนทีมอัตโนมัติรองรับ Claude Code / Codex / OpenCode / Ollama
- Browser Preview แบบ Chromium ภายในแอป
- Voice ภาษาไทย/อังกฤษ โดยใช้ Python และโมเดลเสียงบนเครื่อง

## เลือกดาวน์โหลด

- Windows: `windows-x64.zip` — แตกทั้งโฟลเดอร์แล้วเปิด EXE
- Mac Apple Silicon: `macos-arm64.zip` — แตกแล้วลากสองแอปไป Applications
- Mac Intel: `macos-x64.zip`

CLI กดติดตั้งในหน้า session ได้และต้องล็อกอินเอง Voice ต้องมี Python 3.10+ และโมเดลเสียง ไฟล์นี้ยังไม่มี Windows publisher signature หรือ Apple Developer ID / notarization โปรดอ่าน INSTALL-TH.md ที่รวมใน ZIP

ทุกแพ็กเกจถูก build และทดสอบ startup, PTY จริง, Browser isolation และการส่งข้อความจาก Voice บน OS/architecture ของไฟล์นั้นก่อนเผยแพร่ การทดสอบไม่เปิดไมโครโฟนและไม่ใช้บัญชี CLI ของผู้ใช้ จึงยังต้องทดสอบไมค์จริงและการวางข้อความลงแอปที่คุณใช้

Repository แบบ private: ดาวน์โหลดได้เฉพาะบัญชี GitHub ที่ได้รับสิทธิ์

เพิ่มการทดสอบหน้าจอจัดทีมและติดตั้ง CLI ด้วย fixtures โดยไม่ใช้โควตา AI หรือเปลี่ยนเครื่องมือของผู้ใช้
