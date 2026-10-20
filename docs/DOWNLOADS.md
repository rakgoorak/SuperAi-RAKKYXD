# ดาวน์โหลดและติดตั้ง SuperAi & RAKKYXD

ดาวน์โหลด ZIP ตามเครื่องจากหน้า Releases ของ repository นี้ ไฟล์ `.sha256` ใช้ตรวจความถูกต้องของ ZIP

| เครื่อง | ไฟล์ |
| --- | --- |
| Windows 10/11 64-bit | `SuperAi-RAKKYXD-v1.1.1-windows-x64.zip` |
| Mac ชิป Apple Silicon (M1/M2/M3/M4 และรุ่นใหม่กว่า) | `SuperAi-RAKKYXD-v1.1.1-macos-arm64.zip` |
| Mac ชิป Intel | `SuperAi-RAKKYXD-v1.1.1-macos-x64.zip` |

## Windows

แตก ZIP ทั้งหมดก่อน แล้วเปิด `SuperAi-RAKKYXD.exe` ต้องเก็บไฟล์ทั้งโฟลเดอร์ไว้ด้วยกัน รุ่นนี้ยังไม่มีลายเซ็นผู้พัฒนา Windows จึงอาจขึ้นหน้าจอ “Windows protected your PC” ให้กด **More info → Run anyway** หลังตรวจว่าไฟล์มาจาก Releases ของ repository นี้

## macOS

แตก ZIP แล้วลาก `SuperAi-RAKKYXD.app` ไปไว้ใน Applications รองรับ macOS 11 ขึ้นไปตาม Electron runtime ที่ใช้ รุ่นนี้ลงลายเซ็นแบบ ad-hoc เพื่อให้เปิดบน Apple Silicon ได้ ยังไม่มี Apple Developer ID / notarization หาก macOS ปฏิเสธ ให้ตรวจที่ System Settings → Privacy & Security → Open Anyway หลังตรวจว่าไฟล์มาจาก Releases ของเจ้าของ repository นี้

โหมดเสียงต้องได้รับสิทธิ์ Microphone ครั้งแรกที่เปิด

## เริ่มใช้งานครั้งแรก

ตัวโปรแกรมมี Electron runtime พร้อมแล้ว ไม่ต้องติดตั้งอะไรก่อนเปิด ครั้งแรกแอปเปิดหน้า **เริ่มต้นใช้งาน** ที่ตรวจเครื่องจริงและติดตั้งสิ่งที่ขาดลงโฟลเดอร์ `~/.opencode-multi` โดยไม่ต้องใช้สิทธิ์ผู้ดูแลระบบ:

1. **Node.js 22** กดติดตั้งอัตโนมัติ (ดาวน์โหลดจาก nodejs.org และตรวจ SHA-256)
2. **Git for Windows** (เฉพาะ Windows, Claude Code ต้องใช้ Git Bash) กดติดตั้ง PortableGit จาก GitHub ของ Git for Windows และตรวจ SHA-256 บน macOS ใช้ `xcode-select --install`
3. **CLI ของ AI** เลือกติดตั้ง Claude Code, Codex, OpenCode หรือ Gemini CLI จาก npm ทางการ
4. **โปรเจกต์** เลือกโฟลเดอร์ทำงาน
5. **เข้าสู่ระบบ** เปิด session แล้วทำตามขั้นตอนของ CLI นั้นด้วยบัญชีของคุณเอง ค่าใช้จ่ายและโควตาขึ้นกับผู้ให้บริการ
6. **โหมดเสียง** (ไม่บังคับ) โมเดลแปลงเสียงดาวน์โหลดครั้งแรกที่เปิดใช้ หากต้องการให้อ่านคำตอบภาษาไทย ให้เพิ่มเสียงพูดภาษาไทยของระบบ (Windows: การตั้งค่า → เวลาและภาษา → เสียงพูด, macOS: เพิ่มเสียง Kanya)

เปิดหน้านี้อีกครั้งได้จาก **เริ่มต้นใช้งาน** ที่แถบซ้าย Freebuff เปิดได้หนึ่ง session ที่แอปจัดการพร้อมกัน

## การเข้าถึง

Repository นี้เป็น private ผู้ดาวน์โหลดต้องล็อกอิน GitHub ด้วยบัญชีที่เจ้าของอนุญาต ไฟล์ Release ไม่สามารถดาวน์โหลดแบบสาธารณะได้

ข้อมูลโปรเจกต์ พรอมป์ต์ และโมเดลแปลงเสียงอยู่บนเครื่องผู้ใช้ ไม่รวมใน ZIP ของ Release
