<p align="center">
  <img src="docs/images/app-icon.png" width="112" alt="SuperAi & RAKKYXD" />
</p>

<h1 align="center">SuperAi &amp; RAKKYXD</h1>

<p align="center">
  <b>AI ทุกตัวของคุณ ในหน้าต่างเดียว</b><br />
  Claude · ChatGPT (Codex) · Antigravity · OpenCode · Freebuff<br />
  Windows และ macOS · ภาษาไทย · ใช้บัญชี AI ของคุณเอง
</p>

<p align="center">
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-Setup.exe"><b>ดาวน์โหลดสำหรับ Windows</b></a>
  ·
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-arm64.dmg"><b>Mac (Apple Silicon)</b></a>
  ·
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-x64.dmg"><b>Mac (Intel)</b></a>
</p>

<p align="center"><img src="docs/images/workspace.png" alt="หน้าหลักของ SuperAi & RAKKYXD" width="860" /></p>

ถ้าคุณใช้ AI หลายตัวพร้อมกัน แล้วต้องเปิดหลายโปรแกรมสลับไปมา SuperAi & RAKKYXD รวมทุกตัวไว้ในที่เดียว: ให้ AI หลายตัวช่วยกันทำงาน, เปิด CLI หลายแท็บ, ถามคำถามเดียวกับทุกตัวแล้วสรุปให้ และดูได้ว่าโควตาของแต่ละเจ้าเหลือเท่าไร

---

## สารบัญ

- [ดาวน์โหลดและติดตั้ง](#ดาวน์โหลดและติดตั้ง)
- [สามโหมดการทำงาน](#สามโหมดการทำงาน)
- [ดูโควตาที่เหลือ (Usage)](#ดูโควตาที่เหลือ-usage)
- [ความสามารถอื่นๆ](#ความสามารถอื่นๆ)
- [เริ่มใช้งานครั้งแรก](#เริ่มใช้งานครั้งแรก)
- [อัปเดตและถอนการติดตั้ง](#อัปเดตและถอนการติดตั้ง)
- [ความเป็นส่วนตัวและข้อมูลบนเครื่อง](#ความเป็นส่วนตัวและข้อมูลบนเครื่อง)
- [แก้ปัญหาที่พบบ่อย](#แก้ปัญหาที่พบบ่อย)
- [สำหรับนักพัฒนา](#สำหรับนักพัฒนา)

---

## ดาวน์โหลดและติดตั้ง

| เครื่อง | ไฟล์ติดตั้ง | ขนาด |
| --- | --- | --- |
| Windows 10/11 (64-bit) | [SuperAi-RAKKYXD-Setup.exe](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-Setup.exe) | ≈90 MB |
| Mac Apple Silicon (M1 ขึ้นไป) | [SuperAi-RAKKYXD-macos-arm64.dmg](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-arm64.dmg) | ≈110 MB |
| Mac Intel | [SuperAi-RAKKYXD-macos-x64.dmg](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-x64.dmg) | ≈115 MB |

ลิงก์ด้านบนชี้ไปที่เวอร์ชันล่าสุดเสมอ ดาวน์โหลดได้โดยไม่ต้องล็อกอิน GitHub ทุกไฟล์มี `.sha256` ไว้ตรวจความถูกต้อง และมีไฟล์ ZIP แบบไม่ต้องติดตั้ง (portable) ในหน้า [Releases](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest)

### Windows

ดับเบิลคลิก `SuperAi-RAKKYXD-Setup.exe` รอแตกไฟล์สักครู่ แล้วตัวติดตั้งจะเปิดขึ้นมา:

1. เลือกโฟลเดอร์ (ค่าเริ่มต้น `%LOCALAPPDATA%\Programs\SuperAi-RAKKYXD` ไม่ต้องใช้สิทธิ์ผู้ดูแลระบบ)
2. เลือกว่าจะ **สร้างทางลัดบนเดสก์ท็อป** และ **เปิดโปรแกรมเมื่อติดตั้งเสร็จ** หรือไม่
3. กด **ติดตั้ง** วงโคจรรอบโลโก้คือแถบความคืบหน้า เมื่อครบรอบก็พร้อมใช้

<p align="center">
  <img src="docs/images/installer.png" alt="ตัวติดตั้ง Windows" width="430" />
  <img src="docs/images/installer-done.png" alt="ติดตั้งเสร็จ" width="430" />
</p>

ตัวติดตั้งเพิ่มทางลัดใน Start Menu และรายการใน **Settings → Apps** สำหรับถอนการติดตั้ง ถ้าต้องการติดตั้งหลายเครื่องแบบไม่ต้องกดอะไร ใช้ `SuperAi-RAKKYXD-Setup.exe /S`

> ถ้า Windows ขึ้น “Windows protected your PC” ให้กด **More info → Run anyway** (โปรแกรมยังไม่มีใบรับรองผู้พัฒนาแบบเสียเงิน)

### macOS 11 ขึ้นไป

เปิดไฟล์ `.dmg` แล้วลาก **SuperAi & RAKKYXD** ไปที่ **Applications** ครั้งแรกถ้า macOS ไม่ยอมเปิด ให้ไปที่ **System Settings → Privacy & Security → Open Anyway**

---

## สามโหมดการทำงาน

ทุกที่ที่เลือก AI เลือกได้ 3 อย่าง: **ผู้ให้บริการ** (Claude, ChatGPT ผ่าน Codex CLI, Antigravity, OpenCode หรือ Ollama บนเครื่อง), **Model** และ **Effort** (ระดับความคิด) รายชื่อรุ่นดึงจาก CLI จริง พิมพ์ชื่อเองได้ ถ้ารุ่นใดใช้กับบัญชีของคุณไม่ได้ แอปจะบอกให้เปลี่ยนรุ่น

### Agent: ทีม AI ช่วยกันทำงาน

เลือก **Main** 1 ตัว และ **Sub-agent** 1–6 ตัว แต่ละตัวเลือกผู้ให้บริการ/model/effort แยกกันได้ Main อ่านโปรเจกต์ วางแผน แล้วแจกงาน งานที่ไม่ต้องรอกันจะทำพร้อมกัน งานที่ต้องใช้ผลของงานอื่นจะรอแล้วได้รับผลนั้นไปทำต่อ หน้าจอแสดงว่าแต่ละตัวกำลังทำอะไร รายการงาน และไทม์ไลน์ เมื่อเสร็จ Main สรุปว่าใครทำอะไร ไฟล์ไหนเปลี่ยน และงานไหนไม่สำเร็จ

การอนุญาตให้ Sub-agent **แก้ไฟล์และรันคำสั่ง** เป็นสวิตช์ที่ปิดไว้ก่อนเสมอ

<p align="center"><img src="docs/images/agent.png" alt="โหมด Agent" width="860" /></p>

### Code: CLI หลายแท็บในหน้าต่างเดียว

เปิด Terminal, Claude Code, Codex, Antigravity CLI (`agy`), OpenCode และ Freebuff ได้หลายแท็บ เลือก model และ effort ตอนเปิดแท็บ จัดคอลัมน์ ลากสลับ ปรับขนาด หรือขยายดูทีละช่อง มีช่อง **คำสั่งรวม** สำหรับส่งข้อความเดียวไปหลายแท็บพร้อมกัน (Freebuff เปิดได้ครั้งละ 1 session และใช้ได้เฉพาะโหมดนี้)

### Chat: ถามครั้งเดียว ได้ความเห็นจากทุก AI

เลือก Main 1–5 ตัว พิมพ์คำถามครั้งเดียว ทุกตัวตอบแยกกันในการ์ดของตัวเอง แล้วให้ **ผู้สรุป** รวมผล เลือกได้ว่าจะ “รวมทุกความเห็น” หรือ “คัดส่วนที่ดี ตัดส่วนที่อ่อนออก” ผู้สรุปบอกเสมอว่า AI ตัวไหนแนะนำอะไร

<p align="center"><img src="docs/images/chat.png" alt="โหมด Chat" width="860" /></p>

---

## ดูโควตาที่เหลือ (Usage)

กดปุ่ม **Usage** ที่มุมขวาบน ดูได้ทันทีว่าแต่ละเจ้าเหลือโควตาเท่าไร บนปุ่มแสดงตัวเลขที่เหลือน้อยที่สุด (เอาเมาส์ชี้เพื่อดูว่าเป็นของตัวไหน)

| ผู้ให้บริการ | ข้อมูลที่แสดง |
| --- | --- |
| Claude | โควตา 5 ชั่วโมง และรายสัปดาห์ (% ที่เหลือ + เวลารีเซ็ต) |
| ChatGPT (Codex) | โควตา 5 ชั่วโมง และรายสัปดาห์ (จากการใช้ Codex ครั้งล่าสุด) |
| Antigravity | 5 ชั่วโมง และรายสัปดาห์ แยกตามกลุ่มรุ่น (Gemini, Claude/GPT ฯลฯ) |
| OpenCode | ไม่มีโควตารวม แสดงจำนวน session, token และค่าใช้จ่าย 7 วันแทน |
| Freebuff | CLI ยังไม่มีคำสั่งให้ดูโควตา |

สีของแถบบอกระดับ: เขียว (เหลือมากกว่า 50%), เหลือง (20–50%), แดง (น้อยกว่า 20%) ข้อมูลอ่านจาก CLI ในเครื่องด้วยบัญชีของคุณ ตรวจให้เองตอนเปิดโปรแกรมและทุก 10 นาที หรือกดรีเฟรชเมื่อไรก็ได้

<p align="center"><img src="docs/images/usage.png" alt="หน้าต่าง Usage" width="860" /></p>

---

## ความสามารถอื่นๆ

- **Skills:** AI อ่านโปรเจกต์แล้วเสนอ skill ที่จำเป็นจากแหล่งทางการของ [Anthropic](https://github.com/anthropics/skills) และ [OpenAI](https://github.com/openai/skills) พร้อมเหตุผล ติดตั้งเมื่อคุณกดยืนยันทีละรายการ แล้ว CLI จะเรียกใช้เองเมื่องานเกี่ยวข้อง
- **ปุ่มอัปเดตโปรแกรม:** ตรวจเวอร์ชันใหม่ให้เองทุกครั้งที่เปิด กดเดียวดาวน์โหลด ตรวจ SHA-256 แล้วติดตั้งทับ ไม่ต้องลบแล้วติดตั้งใหม่
- **แนบรูปและ PDF:** PNG, JPG, GIF, WEBP และ PDF ไม่เกิน 20 MB ต่อไฟล์ ผ่านปุ่ม + หรือ Ctrl+U, วางด้วย Ctrl+V หรือลากมาวาง ทั้งในช่องพิมพ์และในแท็บ CLI
- **พูดเพื่อพิมพ์:** กดค้างปุ่มไมค์แล้วพูด แปลงเสียงด้วย Whisper บนเครื่อง (โมเดล Thonburian สำหรับภาษาไทย) เสียงไม่ออกจากเครื่อง ข้อความเข้าช่องพิมพ์ให้ตรวจก่อนส่งเสมอ
- **Browser Preview:** เบราว์เซอร์ในแอป เปิดเว็บที่กำลังพัฒนา (`localhost`) ได้หลายแท็บข้างงานของคุณ
- **แผงด้านขวา:** สถานะ, งาน, พรอมป์ต์ที่บันทึกไว้ และ Browser

---

## เริ่มใช้งานครั้งแรก

เปิดโปรแกรมครั้งแรกจะมีหน้า **เริ่มต้นใช้งาน** ที่ตรวจเครื่องจริงทีละขั้น และมีปุ่มติดตั้งสิ่งที่ขาดให้ ไม่ต้องใช้สิทธิ์ผู้ดูแลระบบ

1. Node.js 22 (ติดตั้งให้อัตโนมัติ)
2. Git for Windows (เฉพาะ Windows ส่วน Mac ใช้ `xcode-select --install`)
3. CLI ของ AI ที่ต้องการ: Claude Code, Codex, OpenCode, Antigravity CLI หรือ Freebuff
4. เลือกโฟลเดอร์โปรเจกต์
5. เข้าสู่ระบบ CLI ด้วยบัญชีของคุณเอง (ค่าใช้จ่ายและโควตาขึ้นกับผู้ให้บริการ)
6. เลือก model และ effort เริ่มต้นของแต่ละผู้ให้บริการ เปลี่ยนภายหลังได้ใน **การตั้งค่า**
7. (ไม่บังคับ) ให้ AI เสนอ Skills ที่จำเป็นต่อโปรเจกต์

---

## อัปเดตและถอนการติดตั้ง

- **อัปเดต:** เมื่อมีเวอร์ชันใหม่ ปุ่ม **อัปเดตโปรแกรม** ที่แถบซ้ายจะมีจุดสีเขียว กด **ดาวน์โหลดอัปเดต** แล้ว **ติดตั้งและเปิดใหม่** โปรแกรมจะปิด ติดตั้งทับ แล้วเปิดขึ้นมาเอง โปรเจกต์ ประวัติ และการตั้งค่าอยู่ครบ
- **ถอนการติดตั้ง (Windows):** Settings → Apps → SuperAi & RAKKYXD → Uninstall ตัวถอนจะลบทางลัดและโฟลเดอร์โปรแกรม แต่เก็บโปรเจกต์และการตั้งค่าของคุณไว้
- **ถอนการติดตั้ง (Mac):** ลากแอปจาก Applications ไปที่ถังขยะ

---

## ความเป็นส่วนตัวและข้อมูลบนเครื่อง

- โปรแกรมไม่มีเซิร์ฟเวอร์ของตัวเอง ทุกอย่างทำงานบนเครื่องคุณ และคุยกับ AI ผ่าน CLI ที่คุณล็อกอินเอง โปรแกรมไม่เก็บรหัสผ่าน
- ข้อมูลอยู่ใน `~/.opencode-multi/` (Windows: `%USERPROFILE%\.opencode-multi\`) เช่น รายการโปรเจกต์, ประวัติ Agent/Chat, เครื่องมือที่แอปติดตั้งให้ และ `desktop.log`
- ไฟล์ที่แนบเก็บที่ `<โปรเจกต์>/.superai/attachments/` ส่วน Skills อยู่ที่ `.claude/skills` และ `.agents/skills` ของโปรเจกต์ (แนะนำให้เพิ่ม `.superai/` ใน `.gitignore`)
- กด “ลบจากรายการ” ไม่ลบโฟลเดอร์โปรเจกต์ของคุณ

---

## แก้ปัญหาที่พบบ่อย

| อาการ | วิธีแก้ |
| --- | --- |
| Windows ขึ้น “Windows protected your PC” | กด **More info → Run anyway** |
| Mac ขึ้นว่าเปิดแอปไม่ได้ | System Settings → Privacy & Security → **Open Anyway** |
| AI ตอบว่ารุ่นนี้ใช้กับบัญชีไม่ได้ | เลือก model อื่นในช่อง Model หรือเว้นว่างเพื่อใช้ค่าของ CLI |
| Usage ของ Codex ไม่ขึ้น | ใช้ Codex สักครั้ง (โหมด Code หรือ Agent/Chat) แล้วกดรีเฟรช |
| ปุ่มอัปเดตบอกว่าไม่มีสิทธิ์เขียนโฟลเดอร์ | ย้ายโปรแกรมไปไว้ในโฟลเดอร์ของผู้ใช้ หรือติดตั้งใหม่ด้วย Setup.exe |
| CLI ทำงานไม่ได้หลังติดตั้ง | เปิดหน้า **เริ่มต้นใช้งาน** แล้วกด “ตรวจอีกครั้ง” และตรวจว่าเข้าสู่ระบบแล้ว |

รายละเอียดการติดตั้งเพิ่มเติมอยู่ที่ [docs/DOWNLOADS.md](docs/DOWNLOADS.md)

---

## สำหรับนักพัฒนา

ต้องมี Node.js 22 ขึ้นไป

```bash
npm install
npm run build
npm start              # เปิดแอป (Windows ดับเบิลคลิก run-studio.cmd ได้)
npm test               # unit tests
npm run test:desktop   # เปิด Electron จริงแล้วตรวจหน้าจอหลัก
npm run test:team      # โหมด Agent และ Chat ด้วยข้อมูลจำลอง
```

พัฒนาเว็บ UI แบบ hot reload: รัน `npm run dev:server` และ `npm run dev` คนละ terminal

| โฟลเดอร์ | หน้าที่ |
| --- | --- |
| `packages/core` | แกน agent, providers และ tools |
| `packages/studio/server` | backend: Express + WebSocket + node-pty, Agent/Chat, Usage, Skills |
| `packages/studio/client` | UI: React, Vite, Tailwind, xterm |
| `packages/desktop` | Electron shell, Browser Preview, ตัวอัปเดต และหน้าตัวติดตั้ง (`installer/`) |
| `installer/` | สคริปต์ NSIS ของ Setup.exe และภาพพื้นหลัง `.dmg` |
| `scripts/` | แพ็กโปรแกรม, สร้างตัวติดตั้ง (`build-installer.mjs`) และสร้างไอคอน/โลโก้ (`brand/make-icons.py`) |

### ออกเวอร์ชันใหม่

1. แก้เลขเวอร์ชันใน `package.json` และเขียนสิ่งที่เปลี่ยนใน `docs/RELEASE.md`
2. push แล้วสร้าง tag เช่น `git tag -a v1.0.2 -m "v1.0.2" && git push origin v1.0.2`
3. GitHub Actions จะ build และทดสอบบน Windows x64, macOS arm64 และ macOS Intel สร้าง Setup.exe, .dmg และ ZIP แล้วเผยแพร่ขึ้น [SuperAi-RAKKYXD-releases](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases) (ต้องมี secret `RELEASES_TOKEN`)
4. ผู้ใช้จะเห็นปุ่มอัปเดตในโปรแกรมเอง

สร้างไอคอนและโลโก้ทุกขนาดใหม่จากภาพแบรนด์: `python scripts/brand/make-icons.py <ภาพแบรนด์>`
