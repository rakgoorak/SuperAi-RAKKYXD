import { _electron as electron } from "playwright-core";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
const require = createRequire(import.meta.url);
async function eventually(fn) {
  for (let i = 0; i < 300; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Condition timed out");
}
const output = path.resolve("output/playwright");
await fs.mkdir(output, { recursive: true });
const data = await fs.mkdtemp(path.join(output, "desktop-check-"));
const website = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<html lang="th"><title>SuperAi Preview Test</title><body style="font:20px sans-serif;padding:32px;background:#f5f8fc;color:#123"><h1>เว็บทดสอบ SuperAi</h1><p>${req.url}</p><a href="/next">หน้าถัดไป</a></body></html>`,
  );
});
await new Promise((r) => website.listen(0, "127.0.0.1", r));
const address = `http://127.0.0.1:${website.address().port}`;
const app = await electron.launch({
  executablePath: process.env.SUPERAI_PORTABLE_DIR ? path.join(process.env.SUPERAI_PORTABLE_DIR,"SuperAi-RAKKYXD.exe") : require("electron"),
  args: process.env.SUPERAI_PORTABLE_DIR ? [] : ["packages/desktop"],
  env: { ...process.env, SUPERAI_DATA_DIR: data },
  timeout: 60000,
});
let checks = 0;
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForSelector(".app-shell");
  await page.waitForFunction(() =>
    document.querySelector(".statusbar")?.textContent.includes("เชื่อมต่อแล้ว"),
  );
  // A fresh profile opens the first-run setup guide with real machine checks.
  const setup = page.getByRole("dialog", { name: "เริ่มต้นใช้งาน SuperAi" });
  await setup.waitFor();
  await setup.getByText("Node.js 22", { exact: true }).waitFor();
  await setup.getByText("เข้าสู่ระบบบัญชี AI", { exact: true }).waitFor();
  await setup.getByRole("button", { name: "เสร็จแล้ว" }).click();
  await setup.waitFor({ state: "hidden" });
  checks++;
  const request = async (route, options) =>
    page.evaluate(
      async ({ route, options }) => {
        const r = await fetch(route, {
          ...options,
          headers: { "Content-Type": "application/json" },
        });
        return { status: r.status, body: await r.json() };
      },
      { route, options },
    );
  assert.equal(await page.title(), "SuperAi & RAKKYXD");
  checks++;
  await page
    .getByRole("textbox", { name: "URL เว็บไซต์", exact: true })
    .fill(address + "/first");
  await page.getByRole("button", { name: "เปิด URL", exact: true }).click();
  await eventually(() =>
    page.evaluate(() =>
      window.superai
        .browser("state")
        .then((s) =>
          s.tabs.some(
            (t) => t.title === "SuperAi Preview Test" && !t.loading && !t.error,
          ),
        ),
    ),
  );
  checks++;
  const isolation = await app.evaluate(({ webContents }, url) => {
    const wc = webContents
      .getAllWebContents()
      .find((w) => w.getURL().startsWith(url));
    return wc.executeJavaScript("typeof window.superai");
  }, address);
  assert.equal(isolation, "undefined");
  checks++;
  await page
    .getByRole("textbox", { name: "URL เว็บไซต์", exact: true })
    .fill(address + "/next");
  await page.getByRole("button", { name: "เปิด URL", exact: true }).click();
  await eventually(() =>
    page.evaluate(() =>
      window.superai
        .browser("state")
        .then((s) => s.tabs.some((t) => t.url.endsWith("/next") && t.canBack)),
    ),
  );
  await page.getByRole("button", { name: "ย้อนกลับ", exact: true }).click();
  await eventually(() =>
    page.evaluate(() =>
      window.superai
        .browser("state")
        .then((s) =>
          s.tabs.some((t) => t.url.endsWith("/first") && !t.loading),
        ),
    ),
  );
  checks++;
  await page.getByRole("button", { name: "การตั้งค่า", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await eventually(() =>
    page.evaluate(() =>
      window.superai.browser("state").then((s) => !s.visible),
    ),
  );
  await page.getByRole("button", { name: "เสร็จแล้ว", exact: false }).click();
  checks++;
  const browserImage=await app.evaluate(async ({webContents},url)=>{
    const wc=webContents.getAllWebContents().find(w=>w.getURL().startsWith(url));
    return (await wc.capturePage()).toPNG().toString('base64');
  },address);
  await fs.writeFile(path.join(output,'superai-browser.png'),Buffer.from(browserImage,'base64'));
  await page.screenshot({ path: path.join(output, "superai-workspace.png") });
  await page
    .getByRole("button", { name: "เพิ่มโปรเจกต์", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "ชื่อโปรเจกต์", exact: true })
    .fill("โปรเจกต์ทดสอบ");
  await page
    .getByRole("textbox", { name: "โฟลเดอร์โปรเจกต์", exact: true })
    .fill(data);
  await page
    .getByRole("button", { name: "บันทึกโปรเจกต์", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.ok(
    (await request("/api/workspaces")).body.some(
      (w) => w.name === "โปรเจกต์ทดสอบ",
    ),
  );
  checks++;
  await page
    .getByRole("button", { name: "สร้าง session", exact: false })
    .click();
  await page.getByRole("button", { name: /Terminal.*พร้อมใช้/ }).click();
  await page
    .getByRole("button", { name: "เปิด 1 session", exact: false })
    .click();
  await page.waitForSelector(".xterm");
  await page.getByTitle("ช่องคำสั่งรวม", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "คำสั่ง", exact: true })
    .fill("echo SUPERAI_DESKTOP_OK");
  await page
    .getByRole("button", { name: "ส่งคำสั่ง (Enter)", exact: true })
    .click();
  await eventually(() =>
    page.evaluate(() =>
      fetch("/api/terminals")
        .then((r) => r.json())
        .then((s) =>
          s.some((x) => x.bufferedOutput.includes("SUPERAI_DESKTOP_OK")),
        ),
    ),
  );
  checks++;
  await page.screenshot({ path: path.join(output, "superai-terminal.png") });
  await page
    .getByRole("button", { name: "สร้าง session", exact: false })
    .click();
  await page
    .getByRole("button", { name: /Freebuff.*เปิดได้ 1 session/ })
    .click();
  const options = await page
    .getByRole("dialog")
    .locator("select option")
    .allTextContents();
  assert.deepEqual(options, ["1 session"]);
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  checks++;
  await page.getByRole("button", { name: "สนทนา", exact: true }).click();
  await page
    .getByRole("heading", { name: "เริ่มจากคำถามของคุณ", exact: true })
    .waitFor();
  if(process.env.SUPERAI_LIVE_CLI_TEST==='1') {
    await eventually(()=>page.evaluate(()=>{const m=localStorage.getItem('superai-opencode-model');return !!m&&m!=='auto';}));
    await page.getByRole('textbox',{name:'คำสั่ง',exact:true}).fill('ตอบเพียงคำว่า พร้อม ห้ามแก้ไขไฟล์หรือเรียกเครื่องมือใดๆ');
    await page.getByRole('button',{name:'ส่งคำสั่ง (Enter)',exact:true}).click();
    for(let i=0;i<90;i++) {
      const projects=(await request('/api/workspaces')).body;const project=projects.find(w=>w.name==='โปรเจกต์ทดสอบ');
      const runs=(await request(`/api/conversations/${project.id}`)).body;
      if(runs[0]&&runs[0].status!=='running') {assert.equal(runs[0].status,'completed',runs[0].error);assert.ok(runs[0].output.includes('พร้อม'));break;}
      if(i===89)throw new Error('Live CLI conversation timed out');
      await new Promise(r=>setTimeout(r,1000));
    }
    checks++;
  }
  await page.getByRole("button", { name: "ผู้ช่วย", exact: true }).click();
  await page
    .getByRole("heading", { name: "มอบหมายเป้าหมายให้ทีม AI", exact: true })
    .waitFor();
  checks++;
  await page.getByRole("button", { name: "โค้ด", exact: true }).click();
  await page
    .getByRole("button", { name: "ปิด Terminal", exact: true })
    .first()
    .click();
  await eventually(() =>
    page.evaluate(() =>
      fetch("/api/terminals")
        .then((r) => r.json())
        .then((s) => s.length === 0),
    ),
  );
  checks++;
  assert.deepEqual(errors, []);
  checks++;
  console.log(
    JSON.stringify({
      passed: checks,
      rendererErrors: errors,
      screenshots: output,
    }),
  );
} finally {
  await app.close();
  await new Promise((r) => website.close(r));
}
