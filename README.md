# SuperAi & RAKKYXD

พื้นที่ทำงาน AI ภาษาไทยบน Windows และ macOS ใช้ AI CLI หลายตัวพร้อมกันในหน้าต่างเดียว มีโปรเจกต์, terminal หลาย session, สนทนา, ทีมผู้ช่วย, browser Preview, แนบรูป/PDF และพูดเพื่อพิมพ์ เริ่มได้แม้เครื่องยังไม่มีอะไรติดตั้ง

## ดาวน์โหลด (v1.2.2)

| เครื่อง | ดาวน์โหลด | ขนาด |
| --- | --- | --- |
| Windows 10/11 64-bit | [SuperAi-RAKKYXD-v1.2.2-windows-x64.zip](https://github.com/rakgoorak/SuperAi-RAKKYXD/releases/download/v1.2.2/SuperAi-RAKKYXD-v1.2.2-windows-x64.zip) · [sha256](https://github.com/rakgoorak/SuperAi-RAKKYXD/releases/download/v1.2.2/SuperAi-RAKKYXD-v1.2.2-windows-x64.zip.sha256) | 133 MB |
| Mac Apple Silicon (M1 ขึ้นไป) | [SuperAi-RAKKYXD-v1.2.2-macos-arm64.zip](https://github.com/rakgoorak/SuperAi-RAKKYXD/releases/download/v1.2.2/SuperAi-RAKKYXD-v1.2.2-macos-arm64.zip) · [sha256](https://github.com/rakgoorak/SuperAi-RAKKYXD/releases/download/v1.2.2/SuperAi-RAKKYXD-v1.2.2-macos-arm64.zip.sha256) | 114 MB |
| Mac Intel | [SuperAi-RAKKYXD-v1.2.2-macos-x64.zip](https://github.com/rakgoorak/SuperAi-RAKKYXD/releases/download/v1.2.2/SuperAi-RAKKYXD-v1.2.2-macos-x64.zip) · [sha256](https://github.com/rakgoorak/SuperAi-RAKKYXD/releases/download/v1.2.2/SuperAi-RAKKYXD-v1.2.2-macos-x64.zip.sha256) | 120 MB |

รุ่นทั้งหมดอยู่ที่ [Releases](https://github.com/rakgoorak/SuperAi-RAKKYXD/releases/latest) · วิธีติดตั้งละเอียดอยู่ที่ [docs/DOWNLOADS.md](docs/DOWNLOADS.md)

> Repository นี้เป็น private ต้องล็อกอิน GitHub ด้วยบัญชีที่ได้รับสิทธิ์จึงจะดาวน์โหลดได้

- **Windows:** แตก ZIP ทั้งโฟลเดอร์แล้วเปิด `SuperAi-RAKKYXD.exe` ถ้าขึ้น "Windows protected your PC" ให้กด **More info → Run anyway**
- **macOS 11+:** แตก ZIP แล้วลาก `SuperAi-RAKKYXD.app` ไปไว้ใน Applications ถ้าเปิดไม่ได้ให้ไปที่ **System Settings → Privacy & Security → Open Anyway**

รุ่นนี้ยังไม่มีลายเซ็นผู้พัฒนาของ Windows หรือ Apple notarization

## เริ่มใช้งานครั้งแรก

แอปเปิดหน้า **เริ่มต้นใช้งาน** ให้เอง ตรวจเครื่องจริงทีละขั้นและมีปุ่มติดตั้งสิ่งที่ขาด โดยไม่ต้องใช้สิทธิ์ผู้ดูแลระบบ

1. Node.js 22
2. Git for Windows (เฉพาะ Windows ส่วน macOS ใช้ `xcode-select --install`)
3. CLI ของ AI ที่ต้องการใช้
4. เลือกโฟลเดอร์โปรเจกต์
5. เข้าสู่ระบบ CLI ด้วยบัญชีของคุณเอง ค่าใช้จ่ายและโควตาขึ้นกับผู้ให้บริการ

## ความสามารถหลัก

- **Session หลายช่อง:** Terminal, Claude Code, Codex, Antigravity CLI (`agy`), OpenCode และ Freebuff (เปิดได้ครั้งละ 1 session) จัดคอลัมน์ ลากสลับ ปรับขนาด และขยายดูทีละช่องได้ มีช่อง **คำสั่งรวม** สำหรับส่งข้อความไปหลาย session พร้อมกัน
- **สนทนา / ผู้ช่วย:** ใช้ Claude Code, Codex, OpenCode (ค่าเริ่มต้น) หรือ Ollama ได้ โหมดผู้ช่วยมีหัวหน้าทีมกับลูกทีมเขียนโค้ด ทดสอบ และตรวจงาน 1–3 คน แต่ละคนเลือก CLI และรุ่นโมเดลแยกกันได้ สิทธิ์แก้ไฟล์และรันคำสั่งปิดไว้เป็นค่าเริ่มต้น
- **แนบรูปและ PDF:** รองรับ PNG, JPG, GIF, WEBP และ PDF ไม่เกิน 20 MB ต่อไฟล์ ผ่านปุ่ม + หรือ Ctrl+U, วางด้วย Ctrl+V หรือลากมาวางทั้งในช่องพิมพ์และช่อง CLI ไฟล์ถูกเก็บที่ `<โปรเจกต์>/.superai/attachments/` (ควรเพิ่ม `.superai/` ใน `.gitignore`)
- **พูดเพื่อพิมพ์:** กดค้างปุ่มไมค์แล้วพูด หรือคลิกขวาเพื่อเลือกไมค์และภาษา แปลงเสียงด้วย Whisper บนเครื่อง เสียงไม่ถูกส่งออกไปนอกเครื่อง ค่าเริ่มต้นคือโมเดล Thonburian สำหรับภาษาไทย ครั้งแรกแอปจะถามก่อนดาวน์โหลดโมเดล ≈290 MB ข้อความถูกใส่ในช่องพิมพ์ให้ตรวจก่อน แอปไม่ส่งเอง
- **Browser Preview:** Chromium ภายในแอป เปิด `localhost` หรือ URL http/https ได้หลายแท็บ
- **แผงด้านขวา:** แท็บสถานะ, งาน, พรอมป์ต์ที่บันทึกไว้ และ Browser

## ข้อมูลบนเครื่อง

ข้อมูลทั้งหมดอยู่ใน `~/.opencode-multi/` (บน Windows คือ `%USERPROFILE%\.opencode-multi\`) เช่น รายการโปรเจกต์, ประวัติผู้ช่วย, Node.js/Git/CLI ที่แอปติดตั้งให้ และไฟล์ `desktop.log` การกด "ลบจากรายการ" ไม่ลบโฟลเดอร์โปรเจกต์

## สำหรับนักพัฒนา

ต้องมี Node.js 22 ขึ้นไป

```bash
npm install
npm run build
npm start          # เปิดแอป (Windows ดับเบิลคลิก run-studio.cmd ได้)
npm test           # unit tests
npm run test:desktop
```

ถ้าจะพัฒนาเว็บ UI ให้รัน `npm run dev:server` และ `npm run dev` คนละ terminal

โครงสร้างเป็น npm workspaces:

| แพ็กเกจ | หน้าที่ |
| --- | --- |
| `packages/core` | แกน agent, providers, tools และทีม multi-agent |
| `packages/studio/server` | backend Express + WebSocket + node-pty |
| `packages/studio/client` | UI ด้วย React, Vite, Tailwind และ xterm |
| `packages/desktop` | Electron shell และ Browser Preview |

**Release:** เมื่อ push tag `v*` GitHub Actions จะ build และทดสอบบน Windows x64, macOS arm64 และ macOS Intel แล้วแนบไฟล์ ZIP กับ SHA-256 ขึ้น Release ดูรายละเอียดที่ [docs/RELEASE.md](docs/RELEASE.md)
