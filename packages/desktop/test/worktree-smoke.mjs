import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../studio/client/dist');
const output = path.resolve('output/worktrees');
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Bangkok', reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('superai-setup-dismissed', '1');
    localStorage.setItem('superai-mode', 'code');
  });

  let mergeCalled = false;
  let worktreeDeleted = false;

  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();

    if (pathname === '/api/workspaces') {
      return route.fulfill({
        json: [{ id: 'wt-fixture', name: 'Worktree project', rootPath: output, threads: [] }],
      });
    }
    if (pathname === '/api/health') return route.fulfill({ json: { pty: true } });
    if (pathname === '/api/ollama/models') return route.fulfill({ json: { models: [] } });
    if (pathname.includes('/node')) return route.fulfill({ json: { ready: true, installed: true, major: 24, version: 'v24.0.0' } });

    if (pathname === '/api/workspaces/wt-fixture/worktrees') {
      if (method === 'GET') {
        const wtList = [
          { path: path.join(output, 'main'), branch: 'main', commit: 'abcdef12', isMain: true, isCurrent: worktreeDeleted, relativeDir: '.' },
        ];
        if (!worktreeDeleted) {
          wtList.push({
            path: path.join(output, '.worktrees', 'feature-parallel-test'),
            branch: 'feature-parallel-test',
            commit: '3456789a',
            isMain: false,
            isCurrent: true,
            relativeDir: 'feature-parallel-test',
          });
        }
        const current = wtList.find(w => w.isCurrent) || wtList[0];
        return route.fulfill({
          json: {
            worktrees: wtList,
            current,
            isWorktree: !current.isMain,
          },
        });
      }
      if (method === 'POST') {
        return route.fulfill({
          json: {
            success: true,
            worktree: {
              path: path.join(output, '.worktrees', 'new-branch'),
              branch: 'new-branch',
              commit: '99887766',
              isMain: false,
              isCurrent: false,
              relativeDir: 'new-branch',
            },
          },
        });
      }
      if (method === 'DELETE') {
        worktreeDeleted = true;
        return route.fulfill({ json: { success: true } });
      }
    }

    if (pathname === '/api/workspaces/wt-fixture/worktrees/merge' && method === 'POST') {
      mergeCalled = true;
      worktreeDeleted = true;
      return route.fulfill({
        json: {
          success: true,
          commit: 'c0ffee42',
          deleted: true,
        },
      });
    }

    if (pathname === '/api/workspaces/wt-fixture/changes') {
      return route.fulfill({ json: { files: worktreeDeleted ? [] : ['feature.ts'] } });
    }

    if (pathname === '/api/workspaces/wt-fixture/changed-file') {
      return route.fulfill({
        json: {
          name: 'feature.ts',
          content: 'console.log("new worktree feature");',
          originalContent: '',
          diff: '+console.log("new worktree feature");',
          deleted: false,
        },
      });
    }

    if (pathname === '/api/workspaces/wt-fixture/files') {
      return route.fulfill({ json: { files: ['src/index.ts', 'package.json'] } });
    }

    return route.fulfill({ json: [] });
  });

  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });

  // 1. Open the "ไฟล์ที่เปลี่ยนและผลงาน" dialog
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('superai:show-changes')));
  const changes = page.getByRole('dialog', { name: 'ไฟล์ที่เปลี่ยนและผลงาน' });
  await changes.waitFor({ state: 'visible', timeout: 5000 });

  // 2. Verify Smart Merge Banner is visible
  const mergeBanner = changes.locator('.worktree-smart-merge-banner');
  await mergeBanner.waitFor({ state: 'visible', timeout: 5000 });
  check(await mergeBanner.isVisible(), 'Smart Merge Banner displays when on a worktree');

  // 3. Verify banner content identifies current worktree and main
  const bannerText = await mergeBanner.locator('.worktree-merge-header').innerText();
  check(bannerText.includes('feature-parallel-test') && bannerText.includes('main'), 'Smart Merge Banner shows source branch and target main');

  // 4. Verify checkbox "ลบ Worktree หลังรวมเสร็จ" is checked by default
  const checkbox = mergeBanner.locator('.worktree-delete-checkbox input[type="checkbox"]');
  check(await checkbox.isChecked(), 'Auto-delete worktree checkbox is present and checked');

  // 5. Click the "รวมโค้ดเข้า main ทันที (Merge)" button
  const mergeButton = mergeBanner.getByRole('button', { name: /รวมโค้ดเข้า main ทันที/ });
  check(await mergeButton.isVisible(), 'One-click Merge button is visible');
  await mergeButton.click();

  // 6. Verify merge API was called and success message displayed
  await page.waitForTimeout(500);
  check(mergeCalled, 'Merge API endpoint was invoked');
  const alert = changes.locator('.worktree-alert.success');
  await alert.waitFor({ state: 'visible', timeout: 5000 });
  const alertText = await alert.innerText();
  check(alertText.includes('สำเร็จ') && alertText.includes('c0ffee42'), 'Merge success notification displays commit hash');

  // 7. Verify Worktree trigger button in recovery-actions
  const wtTrigger = changes.locator('.btn-worktree-trigger').first();
  check(await wtTrigger.isVisible(), 'Worktree trigger button is visible in action bar');
  await wtTrigger.click();

  // 8. Verify WorktreeModal opens
  const modal = page.getByRole('dialog', { name: 'จัดการ Git Worktrees' });
  await modal.waitFor({ state: 'visible', timeout: 3000 });
  check(await modal.isVisible(), 'Worktree modal opens on trigger click');

  // 9. Verify Worktrees list in modal shows main
  const modalText = await modal.innerText();
  check(modalText.includes('Main Repo'), 'Worktree modal lists main repository');

  // 10. Close worktree modal
  await modal.locator('.worktree-modal-close').click();
  await modal.waitFor({ state: 'hidden', timeout: 3000 });
  check(!(await modal.isVisible()), 'Worktree modal closes cleanly');

  // 11. Close changes dialog
  await changes.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
  await changes.waitFor({ state: 'hidden', timeout: 3000 });

  // 12. Switch to "ไฟล์" in RightDock
  const filesTabBtn = page.getByRole('navigation', { name: 'เครื่องมือด้านขวา' }).getByRole('button', { name: 'ไฟล์' });
  if (await filesTabBtn.isVisible()) {
    await filesTabBtn.click();
    const fileExplorer = page.locator('.file-explorer-panel');
    await fileExplorer.waitFor({ state: 'visible', timeout: 5000 });
    const explorerWtTrigger = fileExplorer.locator('.btn-worktree-trigger');
    check(await explorerWtTrigger.isVisible(), 'Worktree button is accessible in File Explorer toolbar');
  }

  // 13. Capture screenshot
  await page.screenshot({ path: path.join(output, 'worktree-complete.png') });

  // 14. Verify zero renderer errors
  check(errors.length === 0, `no renderer errors: ${errors.join(', ')}`);
  console.log(JSON.stringify({ checks, output }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
