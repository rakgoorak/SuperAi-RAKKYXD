<p align="center">
  <img src="docs/images/app-icon.png" width="112" alt="SuperAi & RAKKYXD" />
</p>

<h1 align="center">SuperAi &amp; RAKKYXD</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg" alt="Node Version" /></a>
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD/actions/workflows/ci.yml"><img src="https://github.com/rakgoorak/SuperAi-RAKKYXD/actions/workflows/ci.yml/badge.svg?branch=main" alt="Build Status" /></a>
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases"><img src="https://img.shields.io/github/downloads/rakgoorak/SuperAi-RAKKYXD-releases/total?color=2563eb&label=Downloads&logo=github" alt="Total Downloads" /></a>
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest"><img src="https://img.shields.io/github/v/release/rakgoorak/SuperAi-RAKKYXD-releases?label=release&color=blueviolet" alt="Latest Release" /></a>
  <a href="https://rakgoorak.github.io/SuperAi-RAKKYXD/"><img src="https://img.shields.io/badge/website-live-success.svg" alt="Website" /></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-orange.svg" alt="PRs Welcome" /></a>
</p>

<p align="center">
  <a href="README.md">🇬🇧 English</a> &nbsp;|&nbsp; <b>🇹🇭 ภาษาไทย</b> &nbsp;|&nbsp; 🇯🇵 日本語 (ในแอป) &nbsp;|&nbsp; 🇨🇳 简体中文 (ในแอป)
</p>

<p align="center">
  <b>AI ทุกตัวของคุณ ในหน้าต่างเดียว — Minimal, Local-first, ใช้บัญชีของคุณเอง</b><br />
  Claude Code · ChatGPT (Codex) · Antigravity · OpenCode · Freebuff · Ollama (Local)<br />
  Windows และ macOS · UI 4 ภาษา (ไทย / EN / JA / ZH) · รันบนเครื่อง 100% · Bring Your Own Account
</p>

<p align="center">
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-Setup.exe"><b>⬇ ดาวน์โหลดสำหรับ Windows</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-arm64.dmg"><b>Mac (Apple Silicon)</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-x64.dmg"><b>Mac (Intel)</b></a>
</p>

<p align="center">
  <a href="https://rakgoorak.github.io/SuperAi-RAKKYXD/"><b>เว็บไซต์</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest"><b>ดาวน์โหลดทั้งหมด / SHA-256</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/rakgoorak/SuperAi-RAKKYXD/issues"><b>แจ้งปัญหา</b></a>
</p>

<p align="center">
  <img src="docs/images/workspace.png" alt="หน้าหลักของ SuperAi & RAKKYXD ในโหมด Minimal UI" width="900" style="border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);" />
</p>

<p align="center">
  <img src="docs/images/agent.png" alt="หน้าต่างโหมด Agent Team" width="445" style="border-radius: 10px; border: 1px solid #1e2d38;" />
  <img src="docs/images/chat.png" alt="หน้าต่างโหมด Multi-AI Chat" width="445" style="border-radius: 10px; border: 1px solid #1e2d38;" />
</p>

ถ้าคุณใช้ AI หลายตัวพร้อมกันแล้วต้องเปิดหลายโปรแกรมสลับไปมา **SuperAi & RAKKYXD** รวมทุกเครื่องมือไว้ในหน้าต่างเดียว: ให้ทีม AI ช่วยกันเขียนโค้ดและแก้งาน, เปิด CLI หลายเซสชันพร้อมกัน, ค้นหาประวัติแชตทุกค่าย, ควบคุม Git Worktrees คู่ขนาน และตรวจสอบโควตาคงเหลือของแต่ละเจ้าได้ทันที

---

## สารบัญ

- [ดาวน์โหลดและติดตั้ง](#ดาวน์โหลดและติดตั้ง)
- [ฟีเจอร์เด่น](#ฟีเจอร์เด่น)
- [เริ่มใช้งานครั้งแรก](#เริ่มใช้งานครั้งแรก)
- [ระบบอัปเดตอัตโนมัติ](#ระบบอัปเดตอัตโนมัติ)
- [ความเป็นส่วนตัวและความปลอดภัย](#ความเป็นส่วนตัวและความปลอดภัย)
- [แก้ปัญหาที่พบบ่อย](#แก้ปัญหาที่พบบ่อย)
- [สำหรับนักพัฒนา](#สำหรับนักพัฒนา)
- [การมีส่วนร่วม](#การมีส่วนร่วม)

---

## ดาวน์โหลดและติดตั้ง

| แพลตฟอร์ม | ไฟล์ติดตั้ง | ขนาด | รูปแบบ |
| :--- | :--- | :--- | :--- |
| **Windows 10 / 11 (64-bit)** | [SuperAi-RAKKYXD-Setup.exe](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-Setup.exe) | ≈95 MB | ตัวติดตั้งอัตโนมัติ (NSIS) |
| **Mac Apple Silicon (M1/M2/M3/M4)** | [SuperAi-RAKKYXD-macos-arm64.dmg](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-arm64.dmg) | ≈118 MB | Drag & Drop DMG |
| **Mac Intel** | [SuperAi-RAKKYXD-macos-x64.dmg](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest/download/SuperAi-RAKKYXD-macos-x64.dmg) | ≈124 MB | Drag & Drop DMG |

- ไฟล์ทั้งหมดชี้ไปที่เวอร์ชันล่าสุดเสมอ ไม่จำเป็นต้องล็อกอิน GitHub
- หรือเปิด [หน้าเว็บไซต์](https://rakgoorak.github.io/SuperAi-RAKKYXD/) ที่ตรวจจับระบบและแนะนำไฟล์ที่ตรงกับเครื่องของคุณ
- มีไฟล์ ZIP แบบไม่ต้องติดตั้ง (Portable) ให้ดาวน์โหลดในหน้า [Releases](https://github.com/rakgoorak/SuperAi-RAKKYXD-releases/releases/latest)
- มีไฟล์ `.sha256` คู่กันทุกไฟล์สำหรับการตรวจสอบความถูกต้องของข้อมูล

> **Windows SmartScreen / macOS Gatekeeper:** เวอร์ชันปัจจุบันยังไม่ได้ลงนามดิจิทัล บน Windows ให้เลือก **More info → Run anyway** บน macOS ไปที่ **System Settings → Privacy & Security → Open Anyway** (กำลังดำเนินการทำ signed/notarized build)

---

## ฟีเจอร์เด่น

### 1. สามโหมดการทำงาน (Agent, Code, Chat)

| โหมด | ลักษณะการใช้งาน | ความสามารถพิเศษ |
| :--- | :--- | :--- |
| **🤖 Agent** | สั่งงานโครงการใหญ่ ให้ทีม AI ช่วยกันวางแผนและรันงาน | Main Agent แจกจ่ายงานให้ Sub-agents (1–6 ตัว) ทำงานคู่ขนาน พร้อมสรุปผลงานเมื่อเสร็จสิ้น |
| **💻 Code** | หน้าต่าง Terminal & AI CLI แบบมัลติแท็บ | รัน Claude Code, Codex, Antigravity (`agy`), OpenCode, Freebuff หรือ Terminal ทั่วไป |
| **💬 Chat** | ถามคำถามเดียว ให้ AI หลายตัวช่วยกันตอบและสรุป | เปรียบเทียบมุมมองของ AI แต่ละค่าย พร้อมระบบ Synthesis |

### 2. Quick Provider Chat & Safe Mode
- เริ่มพิมพ์คำถามและคุยกับ AI ได้ทันทีตั้งแต่เปิดแอป โดยไม่ต้องสร้างโฟลเดอร์ก่อน
- โหมด **Safe Read-Only** อัตโนมัติเมื่อคุยทั่วไป ป้องกัน AI แก้ไฟล์โดยไม่ตั้งใจ
- ป้ายระบุผู้ให้บริการ (**Provider Badges**) ชัดเจนทั้งในแถบด้านข้าง แท็บเซสชัน และช่องพิมพ์คำสั่ง

### 3. ประวัติการสนทนารวมและค้นหาข้อความ
- รวมประวัติทุกเซสชันและทุก AI ไว้ในแผงเดียว
- ค้นหาข้อความแบบ **Full-Text Search** ได้ทันที
- กรองตามผู้ให้บริการ และเปิดเซสชันเดิมกลับมาคุยต่อได้

### 4. ซ่อนเซสชันโดยไม่ต้องลบ
- กดปุ่มซ่อนเซสชันเพื่อพับเก็บเซสชันที่ไม่ใช้งานออกจากหน้าจอหลัก
- ประวัติและโปรเซสของ AI ยังทำงานต่อ 100%
- กู้คืนกลับมาแสดงได้ตลอดเวลาผ่านชิปด้านบนหรือแถบรายการด้านซ้าย

### 5. Git Worktrees & Branch Switcher
- สลับ Git Branch จริงได้จากแถบเหนือช่องพิมพ์คำสั่ง พร้อมระบบป้องกันการสลับขณะ AI รันงาน
- สร้าง **Parallel Git Worktrees** เพื่อพัฒนาหลายฟีเจอร์แยกโฟลเดอร์พร้อมกัน
- **Smart Merge Banner** ช่วยตรวจสอบและ Merge โค้ดกลับเข้าสู่ `main` พร้อมทำความสะอาด Worktree

### 6. Ctrl + Click เปิด URL ทันที
- กด **Ctrl + Click** (หรือ **Cmd + Click** บน Mac) บนลิงก์ในช่องพิมพ์เพื่อเปิดเบราว์เซอร์
- มีแถบ **Quick Link Chips** แสดงลิงก์ที่ตรวจพบ
- Chat Bubbles แปลง URL เป็นลิงก์ที่คลิกเปิดได้อัตโนมัติ

### 7. Interactive Artifacts Preview
- พรีวิวโค้ดและผลงานแบบสด: HTML, SVG, Tailwind CSS, Mermaid
- ทดสอบ React / JSX / TSX แบบอินเทอร์แอคทีฟด้วย Local Runtime
- โหมดเต็มจอ พร้อมซูมและจัดขนาดไดอะแกรม

### 8. พูดเพื่อพิมพ์ภาษาไทย (Local Whisper)
- กดปุ่มไมโครโฟนค้างไว้แล้วพูดภาษาไทยหรืออังกฤษ
- แปลงเสียงเป็นข้อความด้วย Whisper Thonburian บนเครื่อง 100% ข้อมูลเสียงไม่ถูกส่งออกภายนอก

### 9. ดูโควตาคงเหลือ (Usage Tracker)
- ตรวจสอบโควตาคงเหลือของ Claude, Codex, Antigravity แบบเรียลไทม์ และเครดิตคงเหลือของ OpenRouter, DeepSeek
- แสดงแถบสถานะและเวลารีเซ็ตรอบ 5 ชั่วโมงและรอบสัปดาห์

### 10. Agent Workspace & Clarifying Questions
- วิเคราะห์ความชัดเจนของเป้าหมายก่อนลงมือทำ หากโจทย์กำกวม AI จะถามกลับพร้อมตัวเลือก
- แสดงสถานะการทำงานคู่ขนานของทีม Agent พร้อมบอร์ดจัดแบ่งงานอัตโนมัติ

### 11. ตัวควบคุมสิทธิ์เครื่องมือและความปลอดภัย
- สลับโหมด **Safe Read-only / Plan mode** เพื่อให้ AI อ่านโค้ดและวางแผนโดยไม่แตะไฟล์จริง
- หรือเปิดโหมด **Edit mode** เมื่อต้องการให้ Agent เขียนโค้ด รันเทสต์ และแก้ไขไฟล์

### 12. Cross-Agent Review & Security Audit
- ให้ AI ตรวจสอบโค้ดซึ่งกันและกัน (เช่น Claude เขียน แล้วให้ Antigravity หรือ Codex รีวิว)
- ตรวจจับความปลอดภัยเครือข่าย Localhost และตรวจสอบ Folder Trust ก่อนรันคำสั่ง

### 13. Self-Healing Automated Test Loop
- วนรอบรันทดสอบและซ่อมแซมโค้ดอัตโนมัติเมื่อเกิดข้อผิดพลาด จนกว่าจะผ่าน

### 14. Curated Skills Ecosystem
- ติดตั้งและจัดการ Agent Skills จาก Anthropic, OpenAI, Vercel (skills.sh) และ Cloudflare Security Audit

---

## เริ่มใช้งานครั้งแรก

หน้าต่าง **Setup Guide** จะช่วยตรวจเช็กและติดตั้งสิ่งที่จำเป็น:

1. **Node.js 22 & Git** (ติดตั้งอัตโนมัติหากยังไม่มี)
2. **AI CLI ที่ต้องการ:** Claude Code, Codex, Antigravity (`agy`), OpenCode หรือ Freebuff
3. **เลือกโฟลเดอร์โปรเจกต์** หรือเริ่มคุยในโหมด Quick Chat
4. **Starter Skills (ตัวเลือกเสริม)**

---

## ระบบอัปเดตอัตโนมัติ

- ตรวจสอบเวอร์ชันใหม่เมื่อเปิดโปรแกรมและทุก 30 นาที
- ดาวน์โหลดเบื้องหลังและตรวจสอบ SHA-256 ก่อนอัปเดต
- เซสชัน ประวัติ และข้อมูลโปรเจกต์ยังอยู่ครบหลังอัปเดต

---

## ความเป็นส่วนตัวและความปลอดภัย

- **Local-First Architecture:** โปรแกรมรันบนเครื่องของคุณทั้งหมด ไม่มีเซิร์ฟเวอร์กลาง
- **ใช้บัญชีของคุณเอง:** ทุก AI ทำงานผ่าน CLI ด้วย Session และ API Key ของคุณ API Key ที่บันทึกในการตั้งค่าถูกเข้ารหัสด้วยระบบของเครื่อง และส่งไปที่ผู้ให้บริการเจ้าของ key เท่านั้น
- **นับผู้ใช้แบบไม่ระบุตัวตน:** เพื่อแสดงจำนวนผู้ใช้บนหน้าเว็บ แอปส่งรหัสสุ่มของเครื่อง เวอร์ชันแอป และระบบปฏิบัติการทุก 10 นาที ไม่มีข้อมูลบัญชี โปรเจกต์ ข้อความ หรือไฟล์ ปิดได้ที่ **การตั้งค่า → แจ้งเตือนและคำแนะนำ**
- **ข้อมูลโปรเจกต์:** เก็บที่ `%USERPROFILE%\.opencode-multi` (Windows) หรือ `~/.opencode-multi` (macOS)
- **ไฟล์แนบ:** เก็บใน `.superai/attachments/` ภายในโปรเจกต์ (แนะนำให้ใส่ `.superai/` ใน `.gitignore`)

รายละเอียดทั้งหมดอยู่ใน [PRIVACY.md](PRIVACY.md) การเซ็นโค้ดสำหรับ Windows เป็นไปตาม [Code signing policy](CODE_SIGNING_POLICY.md) อ่านนโยบายการรายงานช่องโหว่ได้ที่ [SECURITY.md](SECURITY.md) และรายชื่อซอฟต์แวร์โอเพนซอร์สที่ใช้ใน [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

---

## แก้ปัญหาที่พบบ่อย

| อาการ | วิธีแก้ไข |
| :--- | :--- |
| **Windows ขึ้น “Windows protected your PC”** | คลิก **More info** แล้วเลือก **Run anyway** (ยังไม่มีใบรับรองดิจิทัล) |
| **macOS แจ้งเตือนว่าเปิดแอปไม่ได้** | ไปที่ **System Settings → Privacy & Security** แล้วคลิก **Open Anyway** |
| **AI แจ้งว่า Model ไม่รองรับบัญชี** | กด Composer Options เพื่อเปลี่ยน Model หรือปล่อยว่างเพื่อใช้ค่าเริ่มต้นของ CLI |
| **หน้าต่าง Usage ไม่ขึ้นข้อมูล** | ใช้งาน CLI ตัวนั้นอย่างน้อยหนึ่งครั้ง แล้วกด Refresh |
| **สลับ Git Branch ไม่ได้** | ตรวจสอบว่าไม่มี AI กำลังรันงาน และไม่มีไฟล์ Uncommitted |

---

## สำหรับนักพัฒนา

### ความต้องการของระบบ
- Node.js 22 ขึ้นไป
- Git for Windows / macOS

### การติดตั้งและพัฒนา
```bash
npm install
npm run build
npm start
npm test
```

### โครงสร้างแพ็กเกจ
```
SuperAi-RAKKYXD/
├── packages/
│   ├── core/              # Agent, Providers และ Tools
│   ├── studio/
│   │   ├── server/        # Express, WebSocket, node-pty, CLI Managers
│   │   └── client/        # Minimal UI (React, Vite, Tailwind, Lucide)
│   └── desktop/           # Electron Shell, Updater, File Previews, Native Tests
├── installer/             # NSIS Installer Script & DMG Assets
└── scripts/               # Build, Package & Release Scripts
```

---

## การมีส่วนร่วม

ยินดีต้อนรับการมีส่วนร่วมจากทุกคน อ่าน [CONTRIBUTING.md](CONTRIBUTING.md) และ [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) ก่อนส่ง Pull Request

---

## ข้อจำกัดความรับผิดชอบ

- **SuperAi & RAKKYXD** เป็นโปรเจกต์โอเพนซอร์สอิสระ **ไม่มีความเกี่ยวข้อง ไม่ได้รับการรับรอง และไม่ได้รับการสนับสนุนจาก** Anthropic, OpenAI, Google หรือผู้ให้บริการ AI รายอื่น
- โค้ด คำสั่ง shell หรือการเปลี่ยนแปลงไฟล์ที่สร้างโดย AI จะรันบนเครื่องของคุณตามสิทธิ์ที่อนุญาต ควรตรวจสอบคำสั่งก่อนอนุมัติ
- การใช้งานโมเดล AI แต่ละค่ายอยู่ภายใต้ข้อกำหนดการให้บริการ (Terms of Service) และนโยบายราคาของผู้ให้บริการนั้นๆ

---

## สัญญาอนุญาต

ซอฟต์แวร์นี้เผยแพร่ภายใต้ [MIT License](LICENSE) © 2026 RAKKYXD &amp; SuperAi Contributors
