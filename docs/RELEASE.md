# SuperAi & RAKKYXD v1.0.1

พื้นที่ทำงาน AI ภาษาไทย พร้อมโปรแกรม SuperAi Voice แยกต่างหาก

- จัด session หลายช่อง ปรับคอลัมน์ ขยายช่อง และลากจัดวางได้
- CLI: Claude Code, Codex, Gemini CLI, OpenCode, Freebuff และ Terminal
- โหมดสนทนา / ผู้ช่วย พร้อมแผงสถานะ งาน และพรอมป์ต์
- Browser Preview แบบ Chromium ภายในแอป
- Voice ภาษาไทย/อังกฤษ โดยใช้ Python และโมเดลเสียงบนเครื่อง

## เลือกดาวน์โหลด

- Windows: `windows-x64.zip` — แตกทั้งโฟลเดอร์แล้วเปิด EXE
- Mac Apple Silicon: `macos-arm64.zip` — แตกแล้วลากสองแอปไป Applications
- Mac Intel: `macos-x64.zip`

CLI ต้องติดตั้ง/ล็อกอินเอง Voice ต้องมี Python 3.10+ และโมเดลเสียง ไฟล์นี้ยังไม่มี Windows publisher signature หรือ Apple Developer ID / notarization โปรดอ่าน INSTALL-TH.md ที่รวมใน ZIP

ทุกแพ็กเกจถูก build และทดสอบ startup, PTY จริง, Browser isolation และการส่งข้อความจาก Voice บน OS/architecture ของไฟล์นั้นก่อนเผยแพร่ การทดสอบไม่เปิดไมโครโฟนและไม่ใช้บัญชี CLI ของผู้ใช้ จึงยังต้องทดสอบไมค์จริงและการวางข้อความลงแอปที่คุณใช้

Repository แบบ private: ดาวน์โหลดได้เฉพาะบัญชี GitHub ที่ได้รับสิทธิ์

แก้ชุดทดสอบ Windows runner ให้แยกการทดสอบ API แบบ pipe จากการทดสอบ PTY จริงในแอป และปรับระยะขอบ titlebar สำหรับปุ่มหน้าต่าง macOS
