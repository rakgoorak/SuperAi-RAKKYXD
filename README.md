# SuperAi & RAKKYXD

พื้นที่ทำงาน AI ภาษาไทยบน Windows และ macOS ใช้ AI CLI หลายตัวพร้อมกันในหน้าต่างเดียว มี 3 โหมด **Agent**, **Code** และ **Chat** เลือกผู้ให้บริการ/model/effort ได้ทุกที่ พร้อม Skills, browser Preview, แนบรูป/PDF และพูดเพื่อพิมพ์ เริ่มได้แม้เครื่องยังไม่มีอะไรติดตั้ง

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
6. เลือก model และ effort เริ่มต้นของแต่ละผู้ให้บริการ (เว้นว่างเพื่อใช้ค่าของ CLI) เปลี่ยนภายหลังได้ใน **การตั้งค่า**
7. (ไม่บังคับ) ให้ AI เสนอ Skills ที่จำเป็นต่อโปรเจกต์

## ความสามารถหลัก

ทุกที่ที่เลือก AI เลือกได้ทั้ง **ผู้ให้บริการ** (Claude, ChatGPT ผ่าน Codex CLI, Antigravity, OpenCode หรือ Ollama บนเครื่อง), **Model** และ **Effort** รายชื่อรุ่นดึงจาก CLI จริงและพิมพ์ชื่อเองได้ ถ้ารุ่นใช้กับบัญชีของคุณไม่ได้ แอปจะบอกให้เปลี่ยนรุ่น

- **Agent:** เลือก Main 1 ตัว และ Sub-agent 1–6 ตัว Main อ่านโปรเจกต์ วางแผน แล้วแจกงาน งานที่ไม่ต้องรอกันทำพร้อมกัน งานที่ต้องใช้ผลงานอื่นจะรอและได้รับผลนั้น หน้าจอแสดงว่าแต่ละตัวกำลังทำงานไหน ข้อความล่าสุดจาก CLI รายการงาน และไทม์ไลน์ เมื่อเสร็จ Main สรุปว่าใครทำอะไร ไฟล์ไหนเปลี่ยน และงานไหนไม่สำเร็จ สิทธิ์ให้ Sub-agent แก้ไฟล์/รันคำสั่งปิดไว้เป็นค่าเริ่มต้น
- **Code:** Terminal, Claude Code, Codex, Antigravity CLI (`agy`), OpenCode และ Freebuff (เปิดได้ครั้งละ 1 session) หลายแท็บในหน้าต่างเดียว เลือก model และ effort ตอนเปิดแท็บ จัดคอลัมน์ ลากสลับ ปรับขนาด และขยายดูทีละช่องได้ มีช่อง **คำสั่งรวม** ส่งข้อความไปหลาย session พร้อมกัน Freebuff ใช้ได้เฉพาะโหมดนี้
- **Chat:** เลือก Main 1–5 ตัว พิมพ์ครั้งเดียวส่งให้ทุกตัว แต่ละตัวตอบแยกการ์ด แล้วให้ผู้สรุปรวมผล เลือกได้ว่า “รวมทุกความเห็น” หรือ “คัดส่วนที่ดี ตัดส่วนที่อ่อนออก” ผู้สรุปบอกเสมอว่า AI ตัวไหนแนะนำอะไร
- **Skills:** AI อ่านโปรเจกต์แล้วเสนอ skill จากแหล่งทางการของ [Anthropic](https://github.com/anthropics/skills) และ [OpenAI](https://github.com/openai/skills) พร้อมเหตุผล ติดตั้งเมื่อคุณกดยืนยันทีละรายการ ลงที่ `.claude/skills` และ `.agents/skills` ของโปรเจกต์ ให้ CLI เรียกใช้เองเมื่องานเกี่ยวข้อง
- **แนบรูปและ PDF:** รองรับ PNG, JPG, GIF, WEBP และ PDF ไม่เกิน 20 MB ต่อไฟล์ ผ่านปุ่ม + หรือ Ctrl+U, วางด้วย Ctrl+V หรือลากมาวางทั้งในช่องพิมพ์และช่อง CLI ไฟล์ถูกเก็บที่ `<โปรเจกต์>/.superai/attachments/` (ควรเพิ่ม `.superai/` ใน `.gitignore`)
- **พูดเพื่อพิมพ์:** กดค้างปุ่มไมค์แล้วพูด หรือคลิกขวาเพื่อเลือกไมค์และภาษา แปลงเสียงด้วย Whisper บนเครื่อง เสียงไม่ถูกส่งออกไปนอกเครื่อง ค่าเริ่มต้นคือโมเดล Thonburian สำหรับภาษาไทย ครั้งแรกแอปจะถามก่อนดาวน์โหลดโมเดล ≈290 MB ข้อความถูกใส่ในช่องพิมพ์ให้ตรวจก่อน แอปไม่ส่งเอง
- **Browser Preview:** Chromium ภายในแอป เปิด `localhost` หรือ URL http/https ได้หลายแท็บ
- **แผงด้านขวา:** แท็บสถานะ, งาน, พรอมป์ต์ที่บันทึกไว้ และ Browser

## ข้อมูลบนเครื่อง

ข้อมูลทั้งหมดอยู่ใน `~/.opencode-multi/` (บน Windows คือ `%USERPROFILE%\.opencode-multi\`) เช่น รายการโปรเจกต์, ประวัติ Agent/Chat, Node.js/Git/CLI ที่แอปติดตั้งให้ และไฟล์ `desktop.log` การกด "ลบจากรายการ" ไม่ลบโฟลเดอร์โปรเจกต์

## สำหรับนักพัฒนา

ต้องมี Node.js 22 ขึ้นไป

```bash
npm install
npm run build
npm start          # เปิดแอป (Windows ดับเบิลคลิก run-studio.cmd ได้)
npm test           # unit tests
npm run test:desktop
npm run test:team    # โหมด Agent และ Chat ด้วยข้อมูลจำลอง
```

ถ้าจะพัฒนาเว็บ UI ให้รัน `npm run dev:server` และ `npm run dev` คนละ terminal

โครงสร้างเป็น npm workspaces:

| แพ็กเกจ | หน้าที่ |
| --- | --- |
| `packages/core` | แกน agent, providers และ tools |
| `packages/studio/server` | backend Express + WebSocket + node-pty |
| `packages/studio/client` | UI ด้วย React, Vite, Tailwind และ xterm |
| `packages/desktop` | Electron shell และ Browser Preview |

**Release:** เมื่อ push tag `v*` GitHub Actions จะ build และทดสอบบน Windows x64, macOS arm64 และ macOS Intel แล้วแนบไฟล์ ZIP กับ SHA-256 ขึ้น Release ดูรายละเอียดที่ [docs/RELEASE.md](docs/RELEASE.md)
