# SuperAi & RAKKYXD

พื้นที่ทำงาน AI ภาษาไทยบน Windows และ macOS มีโปรเจกต์, CLI หลาย session, บทสนทนา, ทีมผู้ช่วย และ browser Preview ภายในแอป พร้อมโปรแกรมพูดเพื่อพิมพ์ **SuperAi Voice & RAKKYXD** แยกต่างหาก

## เปิดใช้งาน

ดาวน์โหลดจาก [GitHub Releases](https://github.com/rakgoorak/SuperAi-RAKKYXD/releases/latest) โดยเลือก Windows x64, Mac Apple Silicon หรือ Mac Intel อ่าน [วิธีติดตั้งและข้อกำหนด](docs/DOWNLOADS.md) ก่อนใช้งาน Repository นี้เป็น private ต้องได้รับสิทธิ์จึงดาวน์โหลดได้

Windows: แตก ZIP ทั้งโฟลเดอร์แล้วเปิด `SuperAi-RAKKYXD.exe` หรือ `SuperAiVoice-RAKKYXD.exe` ส่วน Mac ให้ลากสองไฟล์ `.app` ไปไว้ใน Applications

สำหรับการรันจาก source ต้องมี Node.js 22+ จากนั้นดับเบิลคลิก `run-studio.cmd` เพื่อเปิดโปรแกรมหลัก และ `run-voice.cmd` เพื่อเปิดโปรแกรมเสียง หรือใช้:

```powershell
npm install
npm run build
npm start
npm run voice
```

เปิดโปรแกรมเสียงจากปุ่ม SuperAi Voice ในแอปหลักได้เช่นกัน โปรแกรมเสียงใช้ instance เดียว มีไอคอนใน system tray ปิดหน้าต่างเพื่อซ่อน และเลือก “ออกจากโปรแกรม” ในเมนู tray เพื่อปิดจริง

## เริ่มทำงาน

1. กด **เพิ่มโปรเจกต์** เลือกโฟลเดอร์และตั้งชื่อ
2. กด **สร้าง session** เลือก Terminal, Claude Code, Codex, Gemini CLI, OpenCode หรือ Freebuff เครื่องมือที่ยังไม่ติดตั้งจะแสดงเหตุผลและไม่เปิดปุ่มเริ่ม
3. ใช้บัญชีและขั้นตอน login ของ CLI แต่ละราย ค่าใช้จ่าย/โควตาขึ้นกับบัญชีและผู้ให้บริการ ไม่ดึง cookie เว็บไซต์มาแทนการ login CLI
4. พิมพ์คำสั่งด้านล่าง เลือก session เป้าหมาย หรือทุก session ของโปรเจกต์นี้ Enter เพื่อส่ง และ Shift+Enter เพื่อขึ้นบรรทัดใหม่ ปุ่มสี่เหลี่ยมส่ง Ctrl+C หรือยกเลิกงานผู้ช่วย
5. **Freebuff เปิดพร้อมกันได้ 1 managed session ทั้งระบบ** ต้องรอให้ process และ process ลูกปิดจริงก่อนเปิดใหม่ ข้อจำกัดนี้ไม่ใช่การป้องกันการรันคำสั่ง freebuff ด้วยตนเองนอกแอป

ใน **การตั้งค่า → รุ่นของ OpenCode** กดตรวจรุ่นและเลือกรุ่นที่ผู้ให้บริการมีอยู่ การเลือกนี้ใช้เฉพาะ SuperAi ไม่แก้ global config ของ OpenCode หากไม่มีค่าที่บันทึกไว้ แอปเลือกตัวเลือกในกลุ่ม `opencode/` ที่ชื่อรุ่นลงท้าย `-free` จากรายการที่ CLI รายงาน สามารถเปลี่ยนหรือกลับไปใช้ค่าเดิมได้ ทั้งราคา สิทธิ์และความพร้อมต้องยึดตามผู้ให้บริการ

การจัดวาง session เริ่มแบบ **จัดพอดีจอ** เลือกอัตโนมัติหรือ 2/3/4 คอลัมน์ได้ ช่องสุดท้ายขยายเติมพื้นที่ว่าง ลากหัวช่องเพื่อสลับตำแหน่งหรือใช้ปุ่มย้ายที่หัวช่อง ลากเส้นระหว่างช่องเพื่อปรับสัดส่วน (ใช้ปุ่มลูกศรเมื่อ focus เส้นได้ด้วย) และกดขยายเพื่อดูช่องเดียวโดย process ไม่หยุด โหมดแนวตั้งและสองคอลัมน์แบบช่องใหญ่ยังเลือกได้

พิมพ์ใน CLI แต่ละช่องโดยตรงได้ ปุ่ม **คำสั่งรวม** เปิดช่องส่งให้ session ที่เลือกหรือทุก session ข้อความจาก Voice และพรอมป์ต์ที่บันทึกจะแสดงช่องนี้เพื่อให้ตรวจก่อนส่ง

แผงด้านขวาสลับ **สถานะ / งาน / พรอมป์ต์ / Browser** ได้:
- สถานะอ่าน process จริงและประวัติผู้ช่วย ไม่มีการเดา Context หรือสถานะกำลังคิดของ CLI
- งานเพิ่ม แก้ไข ลบ ส่งคำสั่งเข้า session และทำเครื่องหมายเสร็จด้วยตนเองได้ สถานะส่งแล้วไม่ได้หมายความว่า AI ทำงานสำเร็จ
- พรอมป์ต์บันทึกและเรียกใช้ในช่องคำสั่งได้ โดยยังไม่ส่งอัตโนมัติ
- Browser เป็น Chromium ภายใน Desktop เปลี่ยนแท็บเครื่องมือแล้วหน้าเว็บยังอยู่ และซ่อน native view เมื่อเปิดเครื่องมืออื่นหรือ dialog

หน้าสร้าง session มี **ชุด CLI** ที่บันทึกเองได้หลายชนิด ถ้าเปิดได้บางส่วนแล้วเกิดข้อผิดพลาด การลองใหม่จะเปิดเฉพาะจำนวนที่เหลือ Freebuff ยังคงไม่เกินหนึ่ง session ทั้งระบบ ข้อมูลชุด CLI งาน พรอมป์ต์ และการจัดวางบันทึกบนเครื่องนี้ผ่าน app storage

โหมด **สนทนา / ผู้ช่วย** เลือก Claude Code, Codex, OpenCode หรือ Ollama ในตั้งค่าได้ ค่าเริ่มต้นใช้ OpenCode การอนุญาตแก้ไฟล์และรันคำสั่งเป็น checkbox แยกและปิดไว้เริ่มต้น โหมดผู้ช่วยแบ่งงานผ่าน Supervisor/Coder/Tester/Reviewer ตามลำดับ โหมดเหล่านี้ยังต้องใช้บัญชี CLI ที่ใช้งานได้ หรือ Ollama พร้อม model จริง ไม่มีผลลัพธ์ตัวอย่างแทนคำตอบ

## Preview

เปิดเว็บของคุณจาก terminal ก่อน เช่น dev server ที่พอร์ต 3000 แล้วกด **Preview** ใส่ `localhost:3000` รองรับ URL http/https, ย้อนกลับ/ถัดไป, รีโหลด, หลายแท็บ, ปรับขนาด และเปิดใน browser ภายนอก Desktop ใช้ WebContentsView แยกจาก UI และไม่ให้เว็บไซต์เข้าถึง Node หรือ desktop API

เมื่อใช้ UI ผ่าน browser ปกติ Preview ใช้ iframe ซึ่งบางเว็บไซต์บล็อกได้ เว็บที่จำกัด embedded browser, login หรือ DRM อาจต้องเปิดภายนอก ไม่ปิดการตรวจ certificate หรือการป้องกันของเว็บไซต์

## SuperAi Voice & RAKKYXD

ใช้ Python 3.10+ และ Whisper multilingual บน CPU ไม่ต้องใช้ API key:

1. เปิดโปรแกรมเสียง กด **ติดตั้งระบบเสียง** หากยังไม่พร้อม
2. เลือกโมเดลแล้วกด **ดาวน์โหลดโมเดลที่เลือก** ครั้งแรกต้องใช้อินเทอร์เน็ต Base สมดุลความเร็ว ส่วน Small เหมาะเมื่ออยากเพิ่มความแม่นยำภาษาไทย
3. เลือกไมโครโฟนและภาษาไทย/อังกฤษ/ตรวจอัตโนมัติ
4. กด **เริ่มอัดเสียง** หรือ `Ctrl+Shift+Space` กดอีกครั้งเพื่อหยุดและถอดเสียง
5. ตรวจหรือแก้ข้อความ แล้วกด **ใส่ข้อความ** ข้อความจะเข้าสู่ช่องคำสั่ง SuperAi โดยไม่ execute เอง

เลือกปลายทางเป็นคลิปบอร์ดหรือโปรแกรม Windows ก่อนหน้าได้ ปลายทางถูกจับตอนเริ่มอัด หากหน้าต่างปลายทางปิด/ไม่สามารถโฟกัส/มีสิทธิ์สูงกว่า ให้คัดลอกและวางด้วยตนเอง การแทรกไปทุกโปรแกรมและความแม่นยำจากไมค์จริงต้องทดสอบกับเครื่องใช้งาน

คำสั่งติดตั้งด้วยตนเอง:

```powershell
python -m pip install --user -r packages/voice/requirements.txt
```

ไฟล์เสียงชั่วคราวถูกลบหลังประมวลผล ข้อมูลเสียงไม่ถูกส่งให้บริการ transcription ภายนอก แต่การติดตั้งแพ็กเกจและดาวน์โหลดโมเดลใช้อินเทอร์เน็ต

## ข้อมูลและการพัฒนา

- ข้อมูลโปรเจกต์เดิม: `%USERPROFILE%\.opencode-multi\studio-workspaces.json`
- ประวัติผู้ช่วย: `%USERPROFILE%\.opencode-multi\superai-conversations.json`
- โมเดลเสียง: `%USERPROFILE%\.opencode-multi\whisper-models`
- Log desktop: `%USERPROFILE%\.opencode-multi\desktop.log`
- โฟลเดอร์โปรเจกต์ไม่ถูกลบเมื่อเลือก “ลบจากรายการ” session เป็น process ชั่วคราว ไม่ถูกอ้างว่ายังทำงานหลัง restart

```powershell
npm run build
npm test
npm run test:desktop
```

`test:desktop` เปิดหน้าต่าง Electron ชั่วคราวในข้อมูลทดสอบแยก ไม่ใช้ workspace จริงของผู้ใช้ ตรวจ browser ภายใน, navigation, dialog, โปรเจกต์, terminal, ข้อจำกัด Freebuff และการส่งข้อความจากแอปเสียง โดยไม่เปิดไมโครโฟนหรือใช้บัญชี AI หากตั้ง `SUPERAI_LIVE_CLI_TEST=1` จะเพิ่มการทดสอบสนทนาจริงผ่าน OpenCode ซึ่งใช้สิทธิ์และโควตาของผู้ให้บริการ

ใช้ `npm run dev:server` และ `npm run dev` คนละ terminal เพื่อพัฒนาเว็บ UI หากแก้โค้ดแล้วเปิด Desktop ให้ build ใหม่ก่อน

รุ่นนี้มี source, launcher `.cmd` และ Portable `.exe` พร้อม runtime ในโฟลเดอร์ `release` ยังไม่มี installer ของแบรนด์ที่ลงลายเซ็น และไม่ใช่ source code หรือระบบภายในของ BridgeMind

สร้าง Portable ใหม่หลัง build ด้วย `npm run package:portable` หรือทดสอบ Portable ด้วยการตั้ง `SUPERAI_PORTABLE_DIR` เป็นโฟลเดอร์รุ่นที่สร้าง แล้วรัน `npm run test:desktop`

## Build และเผยแพร่ Release

GitHub Actions build และทดสอบแยกบน Windows x64, macOS arm64 และ macOS Intel เมื่อ push tag `v*` หรือเรียก workflow เอง ต้องผ่านทุกแพ็กเกจก่อนเผยแพร่ Release พร้อม ZIP และ SHA-256 รันบนเครื่องตัวเองด้วย `npm ci`, `npm run build`, `npm test`, `npm run package:release`, `npm run test:release`, `npm run archive:release` โดย Mac ต้องแพ็กบน macOS ให้ตรง architecture ของ Node
