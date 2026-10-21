// Exercises the production TerminalPane with real xterm and a controlled CLI stream.
import { _electron as electron } from 'playwright-core';
import { createServer } from 'vite';
import { WebSocketServer } from 'ws';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const output = path.resolve('output/playwright/terminal-render');
await fs.mkdir(output, { recursive: true });
const data = await fs.mkdtemp(path.join(output, 'profile-'));
const vite = await createServer({ configFile: false, css: { postcss: { plugins: [require('tailwindcss')({ content: [path.resolve('packages/studio/client/src/**/*.{ts,tsx}')]}), require('autoprefixer')()] } }, root: path.resolve('packages/studio/client'), server: { port: 0, host: '127.0.0.1' } });
await vite.listen();
const wss = new WebSocketServer({ noServer: true });
vite.httpServer.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws/terminal/render') wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
});
let socket;
const resizes = [];
wss.on('connection', ws => {
  socket = ws;
  ws.on('message', raw => { const msg = JSON.parse(raw); if (msg.type === 'resize') resizes.push(msg); });
});
let app;
try {
app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('packages/desktop/test/terminal-render-main.mjs')],
  env: { ...process.env, SUPERAI_RENDER_DATA: data, SUPERAI_RENDER_URL: `${vite.resolvedUrls.local[0]}test/terminal-render.html` }, timeout: 60000 });
  const page = await app.firstWindow();
  await page.waitForSelector('.xterm-rows');
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  for (let i = 0; i < 100 && !socket; i++) await new Promise(r => setTimeout(r, 50));
  assert.ok(socket, 'terminal must connect to CLI stream');
  const write = async text => {
    socket.send(JSON.stringify({ type: 'output', data: text }));
    await page.waitForTimeout(150);
  };
  const thai = 'ที่นี่มีน้ำ กำลังแก้ไขข้อความให้อ่านง่าย ไม่ทับกัน';
  await write(`\x1b[2J\x1b[HASCII 0123456789 WMWMWM\r\n${thai}\r\n${thai}\r\n\x1b[1m${thai}\x1b[0m\r\nPROMPT > `);
  await page.screenshot({ path: path.join(output, 'thai.png') });
  const geometry = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.xterm-rows > div')].slice(0, 5);
    const measure = text => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const style = getComputedStyle(document.querySelector('.xterm-rows'));
      ctx.font = `${style.fontSize} ${style.fontFamily}`;
      const metrics = ctx.measureText(text);
      return { ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent };
    };
    return { rows: rows.map(row => ({ text: row.textContent, height: row.getBoundingClientRect().height,
      spans: [...row.children].map(span => ({ text: span.textContent, width: span.getBoundingClientRect().width, spacing: getComputedStyle(span).letterSpacing })) })),
      thaiInk: measure('กี่น้ำผู้ปู่ญู'), englishInk: measure('Wg') };
  });
  await fs.writeFile(path.join(output, 'geometry.json'), JSON.stringify(geometry, null, 2));
  console.log(JSON.stringify({ rowHeight: geometry.rows[1].height, thaiInk: geometry.thaiInk, initialResize: resizes.at(-1) }));
  // A Thai row must leave space for its vowel/tone ink plus readable line separation.
  assert.ok(geometry.rows[1].height >= geometry.thaiInk.ascent + geometry.thaiInk.descent + 3,
    `Thai rows need more separation: row=${geometry.rows[1].height}, ink=${JSON.stringify(geometry.thaiInk)}`);
  // Repaint a long TUI status with a short one. No old suffix may remain.
  await write('\x1b[6;1HWorking: old long status that must disappear');
  await write('\x1b[6;1H\x1b[2KDone');
  assert.equal((await page.locator('.xterm-rows > div').nth(5).textContent()).trim(), 'Done');
  // xterm must have measured with the Thai face already loaded, or marks drift.
  assert.ok(await page.evaluate(() => document.fonts.check('15px "Noto Sans Thai"', 'ก')), 'Noto Sans Thai must be loaded for the terminal');
  // Reading mode shows the same output as plain text, then Esc returns to the live terminal.
  await page.getByRole('button', { name: 'อ่านแบบข้อความ' }).click();
  await page.waitForTimeout(300);
  const reader = page.locator('.terminal-reader');
  assert.ok((await reader.textContent()).includes(thai), 'reading view must contain the Thai output unchanged');
  await page.screenshot({ path: path.join(output, 'reader.png') });
  await write('\r\nหลังเปิดโหมดอ่าน');
  await page.waitForTimeout(300);
  assert.ok((await reader.textContent()).includes('หลังเปิดโหมดอ่าน'), 'reading view must follow new output');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  assert.equal(await reader.count(), 0);
  assert.ok(await page.locator('.xterm').isVisible());
  const beforeResize = resizes.length;
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(800, 500));
  await page.waitForTimeout(300);
  assert.ok(resizes.length > beforeResize, 'CLI must receive new grid dimensions');
  assert.ok(resizes.at(-1).cols < resizes[0].cols);
  await page.locator('#toggle').click();
  await page.locator('#toggle').click();
  await page.waitForTimeout(300);
  assert.ok(await page.locator('.xterm').isVisible());
  assert.ok((await page.locator('.xterm-rows').textContent()).includes('ASCII'));
  console.log(JSON.stringify({ passed: true, resizes: resizes.length, screenshots: output }));
} finally {
  await app?.close();
  wss.close();
  await vite.close();
}
