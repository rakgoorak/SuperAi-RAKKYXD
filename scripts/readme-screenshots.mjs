// Captures the README and website screenshots from the real app, in English or Thai.
//
//   npm run build -w packages/studio/client
//   node scripts/readme-screenshots.mjs en     -> docs/images/*.png + product-tour.gif
//   node scripts/readme-screenshots.mjs th     -> docs/images/th/*.png + product-tour.gif
//
// The AI answers come from a local fixture server (no account or network needed), and the usage
// panel is fed fixture quotas. The tour GIF needs ffmpeg on PATH.
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lang = process.argv[2];
if (lang !== 'en' && lang !== 'th') throw new Error('usage: node scripts/readme-screenshots.mjs en|th');
const out = path.join(root, 'docs/images', lang === 'en' ? '' : lang);
await fs.mkdir(out, { recursive: true });

// The window's text is keyed by its Thai source; look up the English the same way the app does.
const dictionary = async (file) => {
  const source = await fs.readFile(path.join(root, file), 'utf8');
  return JSON.parse(source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1));
};
const en = await dictionary('packages/studio/client/src/locales/en.ts');
const L = (key, ...values) => (lang === 'th' ? key : en[key] || key).replace(/\{(\d+)\}/g, (_, i) => values[Number(i)]);

const T = {
  en: {
    goal: 'Add a dark mode switch to the settings page and test it',
    note: 'Build the switch first, then review and test it.',
    tasks: ['Add the dark mode switch', 'Review the change and run the tests'],
    coder: 'Added a **Dark mode** switch to `src/settings/Appearance.tsx`. It saves the choice and follows the system theme by default.\n\n- Files changed: `Appearance.tsx`, `theme.css`\n- Tests: `npm test` passed (42)',
    reviewer: 'Reviewed the change: the switch works with the keyboard, contrast passes in both themes, and `npm test` passes. One suggestion: remember the choice per device.',
    report: '## Done\n\n- **Sub-agent 1** added the Dark mode switch (`Appearance.tsx`, `theme.css`).\n- **Sub-agent 2** reviewed it and ran the tests: 42 passed.\n\n**Next step:** try the switch in the app and decide whether to remember it per device.',
    question: 'Which database should I use for a small SaaS app?',
    answer1: '**PostgreSQL.** It is reliable, free, and handles relational data, JSON and full-text search in one place. Managed options such as Supabase or Neon make it easy to start.',
    answer2: 'Start with **PostgreSQL** unless your data is mostly documents. Add Redis later only if you need caching or queues.',
    summary: '## Summary\n\nBoth AIs recommend **PostgreSQL** for a small SaaS app.\n\n## Who suggested what\n\n- **Main 1:** PostgreSQL on a managed host such as Supabase or Neon.\n- **Main 2:** PostgreSQL first, Redis later for caching.\n\n## Final recommendation\n\nUse managed PostgreSQL now and add Redis only when you need it.',
    usage: { short: '5 hours', weekly: 'Weekly', weeklyAll: 'Weekly (all models)' },
  },
  th: {
    goal: 'เพิ่มปุ่มสลับโหมดมืดในหน้าตั้งค่าและทดสอบ',
    note: 'สร้างปุ่มก่อน แล้วตรวจและทดสอบ',
    tasks: ['เพิ่มปุ่มสลับโหมดมืด', 'ตรวจการแก้ไขและรันเทสต์'],
    coder: 'เพิ่มปุ่ม **โหมดมืด** ใน `src/settings/Appearance.tsx` แล้ว บันทึกค่าที่เลือกไว้ และใช้ธีมตามระบบเป็นค่าเริ่มต้น\n\n- ไฟล์ที่แก้: `Appearance.tsx`, `theme.css`\n- เทสต์: `npm test` ผ่าน (42)',
    reviewer: 'ตรวจแล้ว: ปุ่มใช้ด้วยคีย์บอร์ดได้ สีอ่านง่ายทั้งสองธีม และ `npm test` ผ่าน ข้อเสนอ: จำค่าแยกตามเครื่อง',
    report: '## เสร็จแล้ว\n\n- **Sub-agent 1** เพิ่มปุ่มโหมดมืด (`Appearance.tsx`, `theme.css`)\n- **Sub-agent 2** ตรวจและรันเทสต์: ผ่าน 42 ข้อ\n\n**ขั้นต่อไป:** ลองกดปุ่มในแอป แล้วเลือกว่าจะจำค่าแยกตามเครื่องหรือไม่',
    question: 'แอป SaaS เล็กๆ ควรใช้ฐานข้อมูลอะไรดี',
    answer1: '**PostgreSQL** เสถียร ฟรี และรองรับข้อมูลแบบตาราง JSON และค้นหาข้อความได้ในที่เดียว ใช้บริการอย่าง Supabase หรือ Neon ก็เริ่มได้ง่าย',
    answer2: 'เริ่มด้วย **PostgreSQL** ถ้าข้อมูลไม่ได้เป็นเอกสารเป็นหลัก ค่อยเพิ่ม Redis ทีหลังเมื่อต้องใช้ cache หรือคิวงาน',
    summary: '## สรุปคำตอบ\n\nทั้งสอง AI แนะนำ **PostgreSQL** สำหรับแอป SaaS เล็กๆ\n\n## ใครเสนออะไร\n\n- **Main 1:** PostgreSQL บนบริการอย่าง Supabase หรือ Neon\n- **Main 2:** PostgreSQL ก่อน แล้วค่อยเพิ่ม Redis สำหรับ cache\n\n## คำแนะนำสุดท้าย\n\nใช้ PostgreSQL แบบมีผู้ดูแลตอนนี้ และเพิ่ม Redis เมื่อจำเป็นเท่านั้น',
    usage: { short: '5 ชั่วโมง', weekly: 'รายสัปดาห์', weeklyAll: 'รายสัปดาห์ (ทุกรุ่น)' },
  },
}[lang];

const work = await fs.mkdtemp(path.join(root, 'output', `readme-shots-${lang}-`));
const project = path.join(work, 'my-app');
await fs.mkdir(path.join(project, 'src'), { recursive: true });
await fs.writeFile(path.join(project, 'README.md'), '# my-app\n');
await fs.writeFile(path.join(project, 'src/index.ts'), 'export {};\n');
const git = (...args) => execFileSync('git', args, { cwd: project, windowsHide: true });
git('init', '-b', 'main'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-m', 'init');

const service = http.createServer(async (req, res) => {
  if (req.url === '/api/tags') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ models: ['gpt-oss:20b', 'qwen3-coder:30b', 'gemma3:27b'].map(name => ({ name })) })); return; }
  let input = ''; for await (const chunk of req) input += chunk;
  const body = JSON.parse(input), prompt = body.messages.map(m => m.content).join('\n');
  // The prompts are Thai whatever the app language; these markers only pick which fixture answers.
  const content = prompt.includes('ผู้สรุปความเห็น') ? T.summary
    : prompt.includes('Sub-agent ที่มี') ? JSON.stringify({ note: T.note, tasks: [{ id: 'a', title: T.tasks[0], assignee: 1, instructions: 'implement' }, { id: 'b', title: T.tasks[1], assignee: 2, instructions: 'review', dependsOn: ['a'] }] })
    : prompt.includes('ทุก Sub-agent ทำงานเสร็จแล้ว') ? T.report
    : prompt.includes('Sub-agent ในทีม') ? (body.model === 'qwen3-coder:30b' ? T.coder : T.reviewer)
    : body.model === 'qwen3-coder:30b' ? T.answer1 : T.answer2;
  await new Promise(r => setTimeout(r, 300));
  res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content } }] }));
});
await new Promise(resolve => service.listen(0, '127.0.0.1', resolve));

const app = await electron.launch({
  executablePath: require('electron'), args: [path.join(root, 'packages/desktop')], timeout: 60000,
  env: { ...process.env, SUPERAI_LANG: lang, SUPERAI_DATA_DIR: work, SUPERAI_OLLAMA_URL: `http://127.0.0.1:${service.address().port}`, SUPERAI_TEST_MODE: '1' },
});
const shots = [];
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.app-shell');
  await page.evaluate((lang) => { localStorage.setItem('superai-setup-dismissed', '1'); localStorage.setItem('superai_locale', lang); localStorage.setItem('superai-mode', 'code'); }, lang);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell');
  const size = (w, h) => app.evaluate(({ BrowserWindow }, [w, h]) => { const win = BrowserWindow.getAllWindows()[0]; win.unmaximize(); win.setContentSize(w, h); }, [w, h]).then(() => page.waitForTimeout(400));
  const shot = async (name) => { await page.mouse.move(0, 0); await page.waitForTimeout(300); const file = path.join(out, name); await page.screenshot({ path: file }); shots.push(file); console.log('saved', path.relative(root, file)); };
  const request = (route, body) => page.evaluate(async ({ route, body }) => { const res = await fetch(route, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined); if (!res.ok) throw new Error(await res.text()); return res.json(); }, { route, body });
  const modes = page.getByRole('navigation', { name: L('โหมดทำงาน') });

  // Only the fixture project in the sidebar (the app may add the folder it was started from).
  for (const ws of await request('/api/workspaces')) await page.evaluate((id) => fetch(`/api/workspaces/${id}`, { method: 'DELETE' }), ws.id);
  await request('/api/workspaces', { name: 'my-app', rootPath: project });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell');
  await page.getByRole('button', { name: 'my-app', exact: true }).click();

  // Home screen
  await size(1280, 800);
  await shot('workspace.png');

  // Usage panel with fixture quotas
  await page.route('**/api/usage/**', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    const short = { label: T.usage.short, remainingPercent: 87, resetsAt: '2027-01-01T21:00:00Z' };
    const weekly = { label: T.usage.weekly, remainingPercent: 59, resetsAt: '2027-01-05T21:00:00Z' };
    const windows = id === 'claude-code' ? [short, { ...weekly, label: T.usage.weeklyAll }] : id === 'antigravity' ? [{ ...short, group: 'Gemini Models' }, { ...weekly, group: 'Gemini Models' }] : id === 'codex' ? [short, weekly] : [];
    return route.fulfill({ json: { id, name: id, status: 'ok', updatedAt: Date.now(), windows } });
  });
  await size(1440, 900);
  await page.getByRole('button', { name: 'Usage', exact: true }).click();
  const usage = page.getByRole('dialog', { name: L('โควตาการใช้งาน'), exact: true });
  await usage.locator('.usage-row').nth(5).waitFor();
  await shot('usage.png');
  await page.keyboard.press('Escape');

  // Agent team
  await size(1280, 800);
  await modes.getByRole('button', { name: 'Agent', exact: true }).click();
  await page.getByRole('button', { name: L('ตั้งค่าทีม Agent'), exact: true }).click();
  for (const [label, model] of [['Main', 'gpt-oss:20b'], ['Sub-agent 1', 'qwen3-coder:30b'], ['Sub-agent 2', 'gemma3:27b']]) {
    await page.getByLabel(L('ผู้ให้บริการของ{0}', label), { exact: true }).selectOption('ollama');
    await page.getByLabel(L('model ของ{0}', label), { exact: true }).fill(model);
  }
  await page.getByRole('button', { name: L('บันทึกทีม'), exact: true }).click();
  await page.getByLabel(L('คำสั่ง'), { exact: true }).fill(T.goal);
  await page.keyboard.press('Enter');
  await page.locator('.agent-card').nth(2).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.task-board li').length === 2 && !document.querySelector('.composer [aria-label][class*="stop"]'), null, { timeout: 30000 }).catch(() => {});
  await page.getByText(T.report.split('\n')[0].replace(/^#+\s*/, ''), { exact: true }).first().waitFor({ timeout: 30000 });
  await page.locator('.conversation-scroll').evaluate(el => { el.scrollTop = 0; });
  await shot('agent.png');

  // Ask several AIs
  await size(1100, 760);
  await modes.getByRole('button', { name: 'Chat', exact: true }).click();
  await page.getByRole('button', { name: L('ตั้งค่าทีม Chat'), exact: true }).click();
  const remove3 = page.getByTitle(L('เอา{0}ออก', 'Main 3'), { exact: true });
  while (await remove3.count()) await remove3.click();
  if (!await page.getByLabel(L('model ของ{0}', 'Main 2'), { exact: true }).count()) await page.getByRole('button', { name: new RegExp(L('เพิ่ม Main (').replace('(', '\\(')) }).click();
  if (!await page.getByLabel(L('model ของ{0}', L('ผู้สรุป')), { exact: true }).count()) await page.getByLabel(L('ให้ AI สรุปผลรวม')).check();
  for (const [label, model] of [['Main 1', 'qwen3-coder:30b'], ['Main 2', 'gemma3:27b'], [L('ผู้สรุป'), 'gpt-oss:20b']]) {
    await page.getByLabel(L('ผู้ให้บริการของ{0}', label), { exact: true }).selectOption('ollama');
    await page.getByLabel(L('model ของ{0}', label), { exact: true }).fill(model);
  }
  await page.getByRole('button', { name: L('บันทึกทีม'), exact: true }).click();
  await page.getByLabel(L('คำสั่ง'), { exact: true }).fill(T.question);
  await page.keyboard.press('Enter');
  await page.locator('.answer-card').nth(1).waitFor({ timeout: 30000 });
  await page.getByText(T.summary.split('\n')[0].replace(/^#+\s*/, ''), { exact: true }).first().waitFor({ timeout: 30000 });
  await page.locator('.conversation-scroll').evaluate(el => { el.scrollTop = 0; });
  await shot('chat.png');
} finally {
  await app.close().catch(() => {});
  await new Promise(resolve => service.close(resolve));
}

// Tour GIF: home, Agent team, several AIs; each frame fitted into 1120x792.
const frames = ['workspace.png', 'agent.png', 'chat.png'].map(name => path.join(out, name));
const list = path.join(work, 'frames.txt');
await fs.writeFile(list, frames.map(f => `file '${f.replace(/\\/g, '/')}'\nduration 3`).join('\n') + `\nfile '${frames.at(-1).replace(/\\/g, '/')}'\n`);
const fit = 'scale=1120:792:force_original_aspect_ratio=decrease,pad=1120:792:(ow-iw)/2:(oh-ih)/2:color=0x1f1f1e';
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
  '-vf', `${fit},fps=1,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none`, '-loop', '0', path.join(out, 'product-tour.gif')]);
console.log('saved', path.relative(root, path.join(out, 'product-tour.gif')));
await fs.rm(work, { recursive: true, force: true }).catch(() => {});
