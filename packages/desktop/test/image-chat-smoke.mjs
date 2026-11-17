import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../studio/client/dist');
const output = path.resolve('output/image-chat');
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream' }).end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], checks = [];
const check = (value, message) => { assert.ok(value, message); checks.push(message); console.log('PASS ' + message); };
try {
  const page = await browser.newPage({ locale: 'th-TH',  viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai-mode', 'code');
    localStorage.setItem('superai-preview', 'false');
  });
  const imagePath = 'D:/AgentBuild/output/example image.png';
  const answer = `[ดูภาพตัวอย่าง](/D:/AgentBuild/output/example%20image.png)\n\n![ภาพ Markdown](docs/image.png)\n\n[รูปที่หาย](missing.png)\n\n[อ่านเอกสาร](docs/readme.txt)

[คลิปตัวอย่าง](output/clip.webm)

เสร็จแล้วครับ — [คลิปนอกโปรเจกต์](D:/elsewhere/demo.webm) (40.5 วินาที, 2.9 MB)

**Facebook เพจ**

> ก่อนส่งใบขอซื้อ ลองดูขั้นตอนครับ
>
> ดูเพิ่มที่ [เว็บไซต์](https://example.com/demo)
>
> #ERP #ใบขอซื้อ

## หัวข้อใหญ่
### หัวข้อรอง
ทำไฟล์ ZIP แล้ว: \`D:\\Test\\siteprompt-website.zip\` (27.7 MB) *ตัวเอียง* ~~ขีดฆ่า~~

- ข้อแรก
  - ข้อย่อย
- [x] เสร็จแล้ว

\`\`\`ts
const answer: number = 42; // comment
\`\`\`

สูตร \\(E = mc^2\\) และราคา $5 กับ $10

\\[
\\frac{a}{b} = c
\\]

ดูบรรทัด \`src/app.ts:42\`

\`\`\`mermaid
graph LR
  A[เริ่ม] --> B[จบ]
\`\`\``;
  const items = [{ id: 'u', kind: 'user', text: 'แสดงรูปภาพ', attachments: ['saved.png'], at: Date.now() }, { id: 'a', kind: 'assistant', text: answer, at: Date.now() }];
  await page.routeWebSocket('**/ws/chat/images', socket => socket.send(JSON.stringify({ type: 'snapshot', chat: { items, running: false } })));
  const video = await fs.readFile(new URL('./fixtures/clip.webm', import.meta.url));
  const allowed = [];
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/preview-file/allow') { allowed.push(route.request().postDataJSON().path); return route.fulfill({ json: { ok: true } }); }
    if (pathname.endsWith('/preview-file/locate')) {
      const asked = new URL(route.request().url()).searchParams.get('path');
      return route.fulfill({ json: { path: asked.includes('siteprompt') ? asked : 'D:\\elsewhere\\demo.webm' } });
    }
    if (pathname.endsWith('/preview-file')) {
      const requested = new URL(route.request().url()).searchParams.get('path');
      const head = route.request().method() === 'HEAD';
      if (requested === 'missing.png') return route.fulfill({ status: 404, json: { error: 'missing' } });
      if (requested === 'D:/elsewhere/demo.webm' && !allowed.includes('D:\\elsewhere\\demo.webm')) return head ? route.fulfill({ status: 403 }) : route.fulfill({ status: 403, json: { outside: true, file: 'D:\\elsewhere\\demo.webm' } });
      if (requested.endsWith('.webm')) return route.fulfill({ contentType: 'video/webm', body: video });
      return route.fulfill({ contentType: 'image/png', body: await fs.readFile('docs/images/workspace.png') });
    }
    let json = [];
    if (pathname === '/api/workspaces') json = [{ id: 'image-workspace', name: 'Image workspace', rootPath: output, threads: [] }];
    else if (pathname === '/api/health') json = { pty: true };
    else if (pathname === '/api/terminals') json = [{ id: 'images', wsId: 'image-workspace', name: 'Image session', agentType: 'codex', view: 'chat', status: 'running', cwd: output, createdAt: 1 }];
    else if (pathname === '/api/clis') json = [{ id: 'codex', available: true, name: 'Codex', command: 'codex', maxSessions: 10, teamSupported: true }];
    else if (pathname.includes('/conversations/')) json = ['agent', 'chat'].map(mode => ({ id: mode, wsId: 'image-workspace', mode, status: 'completed', prompt: 'ตัวอย่าง', output: answer, createdAt: Date.now() }));
    else if (pathname.includes('/chat/settings')) json = { agent: 'codex', model: '', effort: '', skills: [] };
    else if (pathname.endsWith('/chat')) json = { items, running: false };
    else if (pathname.includes('/auth')) json = { status: 'authenticated', note: 'พร้อมใช้งาน' };
    else if (pathname === '/api/ollama/models') json = { models: [] };
    else if (pathname.includes('/node')) json = { ready: true, installed: true, major: 24 };
    return route.fulfill({ json });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
  const inline = page.getByRole('button', { name: 'ขยายรูป ดูภาพตัวอย่าง', exact: true });
  await inline.waitFor();
  await page.waitForFunction(() => document.querySelector('.markdown-image-open img')?.naturalWidth > 0);
  check(await inline.locator('img').getAttribute('src') === '/api/terminals/images/preview-file?path=' + encodeURIComponent(imagePath), 'answer image loads inline through its originating session');
  check(await page.getByRole('button', { name: 'ขยายรูป ภาพ Markdown', exact: true }).isVisible(), 'standard Markdown image syntax displays a thumbnail');
  check(await page.getByRole('link', { name: 'รูปที่หาย', exact: true }).isVisible() && await page.getByRole('button', { name: 'ขยายรูป รูปที่หาย', exact: true }).count() === 0, 'missing image keeps a Preview fallback link');
  const clip = page.getByLabel('คลิปตัวอย่าง', { exact: true });
  await clip.waitFor();
  await page.waitForFunction(() => document.querySelector('video.markdown-video-player')?.readyState >= 1);
  check(await clip.evaluate(el => el.tagName === 'VIDEO' && el.controls), 'a video link in the answer plays inline with controls');
  const shown = page.getByLabel('คลิปนอกโปรเจกต์', { exact: true });
  await shown.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('video.markdown-video-player')].length === 2 && [...document.querySelectorAll('video.markdown-video-player')].every(v => v.readyState >= 1));
  check(allowed.length === 1, 'a video outside the project plays without a button (allowed once, automatically)');
  check(await page.locator('p', { hasText: 'เสร็จแล้วครับ' }).evaluate(p => p.textContent.includes('(40.5 วินาที, 2.9 MB)') && !p.querySelector('video')), 'the sentence around a video link stays whole; the video sits under it');
  // Diagrams draw a moment after the answer appears; let the layout settle before right-clicking.
  await page.locator('.md-mermaid svg').waitFor({ timeout: 20000 });
  const quote = page.locator('blockquote.md-quote');
  check(await quote.count() === 1 && !(await quote.innerText()).includes('>'), 'lines starting with ">" form one quote block without the ">" marks');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await quote.getByRole('button', { name: 'คัดลอก' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  check(copied.startsWith('ก่อนส่งใบขอซื้อ') && copied.includes('#ERP #ใบขอซื้อ') && !copied.includes('คัดลอก') && !copied.includes('>'), 'Copy on the quote copies just its text: ' + JSON.stringify(copied.slice(0, 40)));
  await quote.getByRole('link', { name: 'เว็บไซต์' }).click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'ตัวเลือกข้อความ' });
  check(await menu.getByRole('menuitem', { name: 'เปิดใน Browser ภายในแอป' }).isVisible() && await menu.getByRole('menuitem', { name: 'เปิดในเบราว์เซอร์ภายนอก' }).isVisible() && await menu.getByRole('menuitem', { name: 'คัดลอกลิงก์' }).isVisible(), 'right-click on a web link offers the built-in and external browser');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__revealed = []; window.superai = { ...(window.superai || {}), platform: 'win32', openExternal: async () => {}, browser: async () => ({ tabs: [], activeId: '' }), onBrowser: () => () => {}, revealFile: async file => { window.__revealed.push(file); } }; });
  // A scroll closes the menu; scroll to the video first, then right-click.
  await shown.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await shown.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'เปิดในโฟลเดอร์' }).click();
  await page.waitForFunction(() => window.__revealed.length === 1);
  check(await page.evaluate(() => window.__revealed[0]) === 'D:\\elsewhere\\demo.webm', 'right-click on a video shows the file in its folder');
  const answerBox = page.locator('.chat-assistant').last();
  check(await answerBox.locator('h2', { hasText: 'หัวข้อใหญ่' }).count() === 1 && await answerBox.locator('h3', { hasText: 'หัวข้อรอง' }).count() === 1, 'headings render at their own level');
  check(await answerBox.locator('em', { hasText: 'ตัวเอียง' }).count() === 1 && await answerBox.locator('del', { hasText: 'ขีดฆ่า' }).count() === 1, 'italic and strikethrough render');
  check(await answerBox.locator('ul ul li', { hasText: 'ข้อย่อย' }).count() === 1 && await answerBox.locator('li.task-list-item input[type=checkbox]').isChecked(), 'nested lists and task lists render');
  check(await answerBox.locator('.md-code-block .hljs-keyword').count() > 0 && await answerBox.locator('.md-code-block .hljs-comment').count() === 1, 'code blocks are syntax highlighted');
  check(await answerBox.locator('.md-code-block code').evaluate(el => !el.classList.contains('md-path')), 'code blocks are not treated as file paths');
  const zipPath = answerBox.locator('code.md-path', { hasText: 'siteprompt-website.zip' });
  await zipPath.click();
  await page.waitForFunction(() => window.__revealed.length === 2);
  check(await page.evaluate(() => window.__revealed[1]) === 'D:\\Test\\siteprompt-website.zip', 'clicking a file path in the answer opens its folder');
  check(await answerBox.locator('.katex').count() === 2 && await answerBox.locator('.katex-display').count() === 1, 'inline \\( \\) and display \\[ \\] math render with KaTeX');
  check(await answerBox.locator('p', { hasText: 'ราคา $5 กับ $10' }).count() === 1, 'single dollar amounts stay plain text');
  const opened = [];
  await page.exposeFunction('__previewOpened', href => opened.push(href));
  await page.evaluate(() => window.addEventListener('superai:open-preview-link', event => window.__previewOpened(event.detail.href)));
  await answerBox.locator('code.md-path', { hasText: 'src/app.ts:42' }).click();
  await page.waitForFunction(() => true);
  await new Promise(resolve => setTimeout(resolve, 200));
  check(opened.includes('src/app.ts:42') && await page.evaluate(() => window.__revealed.length) === 2, 'a path with a line number opens that line in Preview');
  await answerBox.locator('.md-mermaid svg').waitFor({ timeout: 20000 });
  check(await answerBox.locator('.md-mermaid svg').count() === 1 && (await answerBox.locator('.md-mermaid').innerText()).includes('เริ่ม'), 'a mermaid block draws its diagram in the chat');
  await answerBox.locator('.md-mermaid').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'math-diagram.png') });
  await answerBox.getByRole('button', { name: 'ดูโค้ด' }).click();
  check(await answerBox.locator('pre', { hasText: 'graph LR' }).isVisible(), 'the diagram can switch back to its code');
  await answerBox.locator('.md-code-block').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'markdown-blocks.png') });
  await page.screenshot({ path: path.join(output, 'inline-images.png'), fullPage: true });
  await inline.click();
  const viewer = page.getByRole('dialog', { name: 'ดูรูป ดูภาพตัวอย่าง', exact: true });
  const zoom = viewer.getByLabel('ระดับการซูม', { exact: true });
  await viewer.getByRole('button', { name: 'ซูมเข้า', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.image-viewer-controls button')?.disabled);
  const percent = async () => Number((await zoom.innerText()).replace('%', ''));
  const fitted = await percent();
  await viewer.getByRole('button', { name: 'ซูมเข้า', exact: true }).click();
  check(await percent() > fitted, 'zoom in increases the actual image scale');
  await viewer.getByRole('button', { name: 'ซูมออก', exact: true }).click();
  check(Math.abs(await percent() - fitted) <= 1, 'zoom out reduces the image scale');
  await viewer.getByRole('button', { name: '100%', exact: true }).click();
  check(await percent() === 100, '100 percent shows actual pixels');
  await page.keyboard.press('+');
  check(await percent() === 125, 'keyboard plus zooms without closing the viewer');
  const area = viewer.locator('.image-viewer-viewport');
  await area.hover();
  await page.mouse.wheel(0, -100);
  await page.waitForFunction(() => Number(document.querySelector('.image-viewer-controls output').textContent.replace('%', '')) > 125);
  check(await percent() > 125, 'mouse wheel zoom is supported');
  await viewer.getByRole('button', { name: 'ซูมเข้า', exact: true }).click();
  const before = await area.evaluate(el => el.scrollLeft);
  const box = await area.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 70, box.y + box.height / 2); await page.mouse.up();
  check(await area.evaluate(el => el.scrollLeft) > before, 'dragging pans a magnified image');
  await viewer.getByRole('button', { name: 'พอดีจอ', exact: true }).click();
  check(Math.abs(await percent() - fitted) <= 1, 'Fit restores the initial scale');
  await page.screenshot({ path: path.join(output, 'zoom-viewer.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  check(await viewer.locator('.image-viewer-controls').evaluate(el => { const r = el.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }), 'zoom controls fit a narrow viewport');
  check(await viewer.getByRole('button', { name: 'ปิดรูปภาพ', exact: true }).evaluate(el => el.getBoundingClientRect().y >= 65), 'close action stays below native titlebar');
  await page.screenshot({ path: path.join(output, 'zoom-viewer-narrow.png') });
  await page.keyboard.press('Escape');
  check(await inline.evaluate(el => el === document.activeElement), 'closing restores focus to the inline image');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'ดูรูป saved.png', exact: true }).click();
  await page.getByRole('dialog', { name: 'ดูรูป saved.png', exact: true }).getByRole('group', { name: 'ซูมรูปภาพ', exact: true }).waitFor();
  check(true, 'sent attachments share the same zoom viewer');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  const messageBox = page.locator('.composer-box textarea');
  const boxHeight = async () => { await page.waitForTimeout(120); return messageBox.evaluate(el => el.getBoundingClientRect().height); };
  const oneLine = await boxHeight();
  check(oneLine < 60, 'the message box starts as one line: ' + oneLine);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('superai:prepare-message', { detail: { text: 'แก้ข้อความนี้' } })));
  check(Math.abs(await boxHeight() - oneLine) < 2, 'editing or retrying a short message keeps the box one line');
  await messageBox.fill(['บรรทัด 1', 'บรรทัด 2', 'บรรทัด 3'].join('\n'));
  const threeLines = await boxHeight();
  check(threeLines > oneLine + 30, 'the box grows with the text: ' + threeLines);
  await messageBox.fill('');
  check(Math.abs(await boxHeight() - oneLine) < 2, 'the box shrinks back to one line once cleared or sent');
  const modes = page.getByRole('navigation', { name: 'โหมดทำงาน' });
  for (const mode of ['Agent', 'Chat']) {
    await modes.getByRole('button', { name: mode, exact: true }).click();
    const image = page.getByRole('button', { name: 'ขยายรูป ดูภาพตัวอย่าง', exact: true });
    await image.waitFor();
    check((await image.locator('img').getAttribute('src')).startsWith('/api/workspaces/image-workspace/preview-file?'), mode + ' images use their workspace endpoint');
  }
  check(errors.length === 0, 'no renderer errors: ' + errors.join('; '));
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks: checks.length, output }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
