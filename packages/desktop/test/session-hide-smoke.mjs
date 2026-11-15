import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../studio/client/dist');
const output = path.resolve('output/session-hide');
await fs.mkdir(output, { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, pathname === '/' ? 'index.html' : '.' + pathname);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    const content = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': ({
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.woff2': 'font/woff2',
      })[path.extname(file)] || 'application/octet-stream',
    }).end(content);
  } catch {
    res.writeHead(404).end();
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: process.env.SUPERAI_TEST_BROWSER || 'chrome', headless: true });
const errors = [];
let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
  console.log('PASS ' + message);
};

try {
  const page = await browser.newPage({ locale: 'th-TH',  viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('superai-setup-dismissed', '1');
    localStorage.setItem('superai-mode', 'code');
    localStorage.setItem('superai-canvas-layout-v2', 'split');
    localStorage.removeItem('superai-hidden-sessions');
  });

  const sessions = [
    { id: 'sess-1', name: 'Antigravity CLI · gemini-3.1-flash-high', agentType: 'antigravity', wsId: 'ws-1', cwd: output, status: 'running', view: 'terminal', createdAt: 1000 },
    { id: 'sess-2', name: 'Codex · gpt-5.3-codex', agentType: 'codex', wsId: 'ws-1', cwd: output, status: 'running', view: 'terminal', createdAt: 2000 },
    { id: 'sess-3', name: 'Claude Code · claude-sonnet-4-6', agentType: 'claude-code', wsId: 'ws-1', cwd: output, status: 'running', view: 'terminal', createdAt: 3000 },
  ];

  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    if (pathname === '/api/workspaces') {
      return route.fulfill({ json: [{ id: 'ws-1', name: 'AgentBuild', rootPath: output, threads: [] }] });
    }
    if (pathname === '/api/terminals') {
      return route.fulfill({ json: sessions });
    }
    if (pathname.endsWith('/chat')) {
      return route.fulfill({ json: { messages: [], running: false } });
    }
    if (pathname === '/api/health') return route.fulfill({ json: { pty: true } });
    if (pathname === '/api/ollama/models') return route.fulfill({ json: { models: [] } });
    if (pathname.includes('/node')) return route.fulfill({ json: { ready: true, installed: true, major: 24, version: 'v24.0.0' } });
    if (pathname === '/api/clis') {
      return route.fulfill({
        json: [
          { id: 'antigravity', name: 'Antigravity CLI', command: 'agy', available: true, maxSessions: 6 },
          { id: 'codex', name: 'Codex', command: 'codex', available: true, maxSessions: 6 },
          { id: 'claude-code', name: 'Claude Code', command: 'claude', available: true, maxSessions: 6 },
        ],
      });
    }
    if (pathname === '/api/cli/versions') return route.fulfill({ json: { tools: [] } });
    if (pathname === '/api/usage') return route.fulfill({ json: { providers: [], updatedAt: Date.now() } });
    if (pathname.startsWith('/api/conversations/')) return route.fulfill({ json: [] });
    if (pathname.includes('/worktrees')) {
      return route.fulfill({
        json: {
          worktrees: [{ path: output, branch: 'main', commit: '12345678', isMain: true, isCurrent: true, relativeDir: '.' }],
          current: { path: output, branch: 'main', commit: '12345678', isMain: true, isCurrent: true, relativeDir: '.' },
          isWorktree: false,
        },
      });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto(`http://127.0.0.1:${server.address().port}`);

  // 1. All 3 sessions are visible initially
  const countBadge = page.locator('.canvas-heading .count-badge');
  await countBadge.waitFor({ state: 'visible' });
  check((await countBadge.textContent())?.trim() === '3 session', 'Initial workspace canvas shows 3 sessions');

  const visibleCells = page.locator('.terminal-cell:not(.not-visible)');
  check((await visibleCells.count()) === 3, 'All 3 session panes are visible in the grid');

  // 2. Hide session 3 from its pane header button
  const hideBtn = page.locator('#session-sess-3 button[aria-label^="ซ่อน "]');
  await hideBtn.waitFor({ state: 'visible' });
  await hideBtn.click();

  check((await countBadge.textContent())?.trim() === '2 session', 'Count badge updates to 2 session after hiding 1 session');
  check((await visibleCells.count()) === 2, 'Only 2 session panes remain visible on the main canvas grid');
  check((await page.locator('.terminal-cell').count()) === 3, 'Hidden session pane stays mounted in DOM (.not-visible) so state is preserved');

  // 3. Sidebar still lists all 3 sessions and marks the hidden one with "ซ่อนอยู่"
  const sidebarRows = page.locator('.sidebar-session-row');
  check((await sidebarRows.count()) === 3, 'All 3 sessions remain in the left sidebar without being deleted');
  const hiddenBadge = page.locator('.sidebar-hidden-badge');
  await hiddenBadge.waitFor({ state: 'visible' });
  check((await hiddenBadge.textContent())?.trim() === 'ซ่อนอยู่', 'Hidden session shows "ซ่อนอยู่" badge in left sidebar');

  // 4. Header bar shows hidden session restore chip ("ซ่อนอยู่ 1:")
  const hiddenBar = page.locator('.hidden-sessions-bar');
  await hiddenBar.waitFor({ state: 'visible' });
  const restoreChip = hiddenBar.locator('.hidden-session-chip');
  check((await restoreChip.count()) === 1, 'Workspace header bar shows restore chip for the hidden session');

  await page.screenshot({ path: path.join(output, '01-two-visible-one-hidden.png') });

  // 5. Clicking the restore chip brings the 3rd session back to the grid
  await restoreChip.click();
  check((await countBadge.textContent())?.trim() === '3 session', 'Clicking restore chip restores count to 3 session');
  check((await visibleCells.count()) === 3, 'All 3 session panes are visible again after restoring');

  // 6. Also verify hiding via the delete confirmation dialog ("ซ่อนไว้ก่อน (ไม่ลบ)")
  const deleteBtn = page.locator('#session-sess-2 button[title^="ลบ "]');
  await deleteBtn.click();
  const hideInsteadBtn = page.locator('[role="dialog"] button:has-text("ซ่อนไว้ก่อน (ไม่ลบ)")');
  await hideInsteadBtn.waitFor({ state: 'visible' });
  await hideInsteadBtn.click();
  check((await visibleCells.count()) === 2, 'Clicking "ซ่อนไว้ก่อน (ไม่ลบ)" in delete dialog hides the session without deleting');

  // Restore via sidebar click
  const sidebarSession2 = page.locator('.sidebar-session', { hasText: 'Codex' });
  await sidebarSession2.click();
  check((await visibleCells.count()) === 3, 'Clicking hidden session in left sidebar restores it to the canvas');

  check(errors.length === 0, 'Zero page/renderer errors during session hide/restore flow');
  console.log(`\nALL ${checks} CHECKS PASSED!`);
} finally {
  await browser.close();
  server.close();
}
