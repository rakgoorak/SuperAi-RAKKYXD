// Walks every window size × mode (plus Preview dock and the Settings dialog) and fails when something
// sticks out of the window or clips its text without an ellipsis.
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const output = path.resolve('output/playwright/overflow');
await fs.mkdir(output, { recursive: true });
const data = await fs.mkdtemp(path.join(path.resolve('output/playwright'), 'overflow-check-'));
const app = await electron.launch({
  executablePath: process.env.SUPERAI_PORTABLE_DIR ? path.join(process.env.SUPERAI_PORTABLE_DIR, 'SuperAi-RAKKYXD.exe') : require('electron'),
  args: process.env.SUPERAI_PORTABLE_DIR ? [] : ['packages/desktop'],
  env: { SUPERAI_LANG: 'th', ...process.env, SUPERAI_DATA_DIR: data }, timeout: 60000,
});
const sizes = [[1040, 680], [1200, 760], [1366, 768], [1920, 1080]];
const report = [];
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForSelector('.app-shell'); await page.evaluate(() => localStorage.setItem('superai-setup-dismissed', '1')); await page.reload(); await page.waitForSelector('.app-shell');
  const request = (route, body) => page.evaluate(async ({ route, body }) => {
    const response = await fetch(route, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }, { route, body });
  // A long project name and session names are what usually push toolbars and tabs out of the window.
  const name = 'โปรเจกต์ทดสอบชื่อยาวมากสำหรับตรวจว่าข้อความล้นกรอบหรือไม่ Long Project Name';
  const workspace = await request('/api/workspaces', { name, rootPath: data });
  for (let i = 1; i <= 3; i++) await request('/api/terminals/spawn', { wsId: workspace.id, agentType: 'terminal', name: `Terminal ชื่อยาวสำหรับทดสอบ ${i}` });
  await page.evaluate(id => localStorage.setItem('superai-workspace', id), workspace.id);
  await page.reload(); await page.waitForSelector('.app-shell');
  await page.waitForFunction(() => document.querySelectorAll('.terminal-cell').length >= 3);
  const resize = async ([width, height]) => {
    await app.evaluate(({ BrowserWindow }, size) => { const w = BrowserWindow.getAllWindows()[0]; w.unmaximize(); w.setContentSize(...size); }, [width, height]);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForTimeout(150);
  };
  const audit = () => page.evaluate(() => {
    const W = innerWidth, H = innerHeight, found = new Map();
    const describe = el => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${[...el.classList].slice(0, 3).map(c => `.${c}`).join('')}`
      + (el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : '') + ` "${(el.textContent || '').trim().slice(0, 30)}"`;
    // An ancestor that scrolls or clips on that axis contains the element: its own box is what matters.
    const contained = (el, axis) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement)
        if (getComputedStyle(p)[axis] !== 'visible') return true;
      return false;
    };
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg, canvas, .xterm, [hidden], [aria-hidden="true"]')) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
      if ((r.right > W + 1 || r.left < -1) && !contained(el, 'overflowX')) found.set(describe(el), `ล้นแนวนอน ${Math.round(r.left)}–${Math.round(r.right)} / ${W}`);
      if (r.bottom > H + 1 && !contained(el, 'overflowY')) found.set(describe(el), `ล้นแนวตั้ง bottom ${Math.round(r.bottom)} / ${H}`);
      const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (ownText && cs.overflowX !== 'visible' && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis')
        found.set(describe(el), `ข้อความถูกตัด ${el.scrollWidth} > ${el.clientWidth}`);
    }
    // Controls drawn over each other (a squeezed select under the mic button, etc.). Only the part left
    // visible by clipping/scrolling ancestors counts; with a dialog open only its controls are on top.
    const visibleRect = el => {
      let { left, top, right, bottom } = el.getBoundingClientRect();
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const c = p.getBoundingClientRect();
        left = Math.max(left, c.left); top = Math.max(top, c.top); right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom);
      }
      return right - left > 2 && bottom - top > 2 ? { left, top, right, bottom } : null;
    };
    const scope = document.querySelector('dialog[open], .dialog') || document.body;
    const controls = [...scope.querySelectorAll('button, select, input:not([type=hidden]), textarea, a[href]')]
      .filter(el => !el.closest('[hidden], [aria-hidden="true"], .xterm, details:not([open]) > :not(summary)') && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length)
      .map(el => ({ el, r: visibleRect(el) })).filter(c => c.r);
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // A button placed inside a field on purpose (model list toggle, clear button).
      const inside = (x, y) => x.left >= y.left - 1 && x.right <= y.right + 1 && x.top >= y.top - 1 && x.bottom <= y.bottom + 1;
      if (inside(a.r, b.r) || inside(b.r, a.r)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 3 && h > 3) found.set(`${describe(a.el)} × ${describe(b.el)}`, `ปุ่มทับกัน ${Math.round(w)}×${Math.round(h)}px`);
    }
    return [...found].map(([where, what]) => ({ where, what }));
  });
  let shot = 0;
  const check = async (label) => {
    const issues = await audit();
    report.push({ label, issues });
    await page.screenshot({ path: path.join(output, `${String(++shot).padStart(2, '0')}-${label.replace(/[^\w-]+/g, '_')}.png`) });
  };
  for (const size of sizes) {
    await resize(size);
    const tag = size.join('x');
    for (const mode of ['Code', 'Chat', 'Agent']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await check(`${tag}-${mode}`);
    }
    await page.getByRole('button', { name: 'Code', exact: true }).click();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.waitForSelector('.preview-panel');
    await check(`${tag}-Code-preview`);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.getByRole('button', { name: 'การตั้งค่า' }).click();
    for (const tab of ['เครื่องมือ AI', 'Model และ Effort', 'แจ้งเตือนและคำแนะนำ']) {
      await page.locator('.settings-nav').getByRole('button', { name: tab, exact: true }).click();
      await check(`${tag}-settings-${tab}`);
    }
    await page.keyboard.press('Escape');
  }
  const failing = report.filter(r => r.issues.length);
  console.log(JSON.stringify({ checked: report.length, failing, rendererErrors: errors, screenshots: output }, null, 2));
  assert.deepEqual(errors, []);
  assert.equal(failing.length, 0, `${failing.length} หน้าจอมีส่วนล้นกรอบ`);
} finally { await app.close(); }
