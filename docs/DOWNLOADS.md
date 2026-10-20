# ดาวน์โหลดและติดตั้ง SuperAi & RAKKYXD

ดาวน์โหลด ZIP ตามเครื่องจากหน้า Releases ของ repository นี้ ไฟล์ `.sha256` ใช้ตรวจความถูกต้องของ ZIP

| เครื่อง | ไฟล์ |
| --- | --- |
| Windows 10/11 64-bit | `SuperAi-RAKKYXD-v1.1.1-windows-x64.zip` |
| Mac ชิป Apple Silicon (M1/M2/M3/M4 และรุ่นใหม่กว่า) | `SuperAi-RAKKYXD-v1.1.1-macos-arm64.zip` |
| Mac ชิป Intel | `SuperAi-RAKKYXD-v1.1.1-macos-x64.zip` |

## Windows

แตก ZIP ทั้งหมดก่อน เปิด `SuperAi-RAKKYXD.exe` สำหรับโปรแกรมหลัก หรือ `SuperAiVoice-RAKKYXD.exe` สำหรับ Voice ต้องเก็บไฟล์ทั้งโฟลเดอร์ไว้ด้วยกัน รุ่นนี้ยังไม่มีลายเซ็นผู้พัฒนา Windows

## macOS

แตก ZIP แล้วลาก `SuperAi-RAKKYXD.app` และ `SuperAiVoice-RAKKYXD.app` ไปไว้ใน Applications รองรับ macOS 11 ขึ้นไปตาม Electron runtime ที่ใช้ รุ่นนี้ลงลายเซ็นแบบ ad-hoc เพื่อให้เปิดบน Apple Silicon ได้ ยังไม่มี Apple Developer ID / notarization หาก macOS ปฏิเสธ ให้ตรวจที่ System Settings → Privacy & Security → Open Anyway หลังตรวจว่าไฟล์มาจาก Releases ของเจ้าของ repository นี้

Voice ต้องได้รับสิทธิ์ Microphone ส่วนการวางข้อความลงแอปอื่นต้องให้ Accessibility และ Automation สำหรับ System Events ใน Privacy & Security หากยังไม่มีสิทธิ์ สามารถคัดลอกข้อความแล้วกด Command+V หรือส่งเข้า SuperAi โดยตรงได้

## CLI และเสียง

ตัวโปรแกรมมี Electron runtime พร้อมแล้ว แต่ Claude Code, Codex, Gemini CLI, OpenCode และ Freebuff กดติดตั้งจากหน้า สร้าง session ได้เมื่อมี Node.js 22+ และ npm จากนั้นล็อกอินด้วยบัญชีของคุณเอง Freebuff เปิดได้หนึ่ง session ที่แอปจัดการพร้อมกัน

Voice ต้องมี Python 3.10+ (แนะนำ 3.11/3.12) และ faster-whisper พร้อมโมเดลเสียง Python ไม่ได้รวมอยู่ใน ZIP บน Mac ใช้ `python3`; ระบบติดตั้งเสียงสร้าง virtual environment ใน `~/.opencode-multi/whisper-models/runtime` เพื่อไม่แก้ Python ของระบบ กำหนด `SUPERAI_PYTHON` ได้เมื่อใช้ Python ที่ติดตั้งเอง การดาวน์โหลดโมเดลครั้งแรกต้องเชื่อมต่ออินเทอร์เน็ต

## การเข้าถึง

Repository นี้เป็น private ผู้ดาวน์โหลดต้องล็อกอิน GitHub ด้วยบัญชีที่เจ้าของอนุญาต ไฟล์ Release ไม่สามารถดาวน์โหลดแบบสาธารณะได้

ข้อมูลโปรเจกต์ พรอมป์ต์ และโมเดลเสียงอยู่บนเครื่องผู้ใช้ ไม่รวมใน ZIP ของ Release

เปิด Voice แล้วกดปุ่ม **ตั้งค่าระบบเสียง** (ข้างปุ่มภาษา) กด **1. ติดตั้งระบบเสียง** แล้ว **2. ดาวน์โหลดโมเดล Base** เมื่อพร้อมให้กลับหน้าพูด ครั้งแรกที่ยังไม่พร้อมจะเปิดหน้าตั้งค่านี้ให้อัตโนมัติ ไม่เริ่มไมโครโฟนจนกว่าจะเตรียมระบบแล้ว
