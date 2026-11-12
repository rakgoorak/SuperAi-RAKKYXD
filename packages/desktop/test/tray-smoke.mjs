import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closeApp, stepper, watchdog, watchPage } from './smoke-harness.mjs';

const require = createRequire(import.meta.url), steps = stepper('tray');
const output = path.resolve('output/tray');
await fs.mkdir(output, { recursive: true });
const data = await fs.mkdtemp(path.join(output, 'profile-'));
let desktop, processHandle;
const guard = watchdog(90000, steps, () => closeApp(desktop, steps));
try {
  steps.step('launch isolated real desktop');
  desktop = await electron.launch({ executablePath: require('electron'), args: [path.resolve('packages/desktop/test/tray-main.mjs')],
    env: { ...process.env, SUPERAI_DATA_DIR: data }, timeout: 60000 });
  processHandle = desktop.process();
  processHandle.stderr?.on('data', chunk => steps.log(String(chunk).trim()));
  const page = await desktop.firstWindow();
  watchPage(page, steps);
  page.on('pageerror', error => steps.log(error.message));
  steps.step('waiting for workspace UI');
  await page.waitForSelector('.app-shell');
  await page.evaluate(() => { window.traySmokeMarker = 'same renderer'; });
  const initial = await desktop.evaluate(({ BrowserWindow }) => ({ windowId: BrowserWindow.getAllWindows()[0].id,
    trayLive: !globalThis.superaiTrayFixture.tray.isDestroyed(), menu: globalThis.superaiTrayFixture.menu.items.map(item => ({ id: item.id, label: item.label })) }));
  assert.equal(initial.trayLive, true);
  assert.ok(initial.menu.some(item => item.id === 'quit-app' && item.label.includes('Exit')));
  const base = new URL(page.url()).origin;
  const response = await fetch(base + '/api/terminals/spawn', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentType: 'terminal', name: 'Tray background job', command: process.execPath,
      args: ['-e', "setTimeout(() => console.log('TRAY_BACKGROUND_OK'), 1500)"], cwd: data, forcePipe: true }) });
  const task = await response.json(); assert.equal(response.ok, true, JSON.stringify(task));

  steps.step('X hides without stopping the server or background process');
  await desktop.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).close(), initial.windowId);
  const hidden = await desktop.evaluate(({ BrowserWindow }, id) => ({ visible: BrowserWindow.fromId(id).isVisible(), windows: BrowserWindow.getAllWindows().length }), initial.windowId);
  assert.equal(hidden.visible, false);
  assert.ok(hidden.windows > 0);
  const deadline = Date.now() + 15000;
  let completed;
  do {
    const sessions = await (await fetch(base + '/api/terminals')).json();
    completed = sessions.find(item => item.id === task.id && item.bufferedOutput.includes('TRAY_BACKGROUND_OK'));
    if (!completed) await new Promise(resolve => setTimeout(resolve, 100));
  } while (!completed && Date.now() < deadline);
  assert.ok(completed, 'the hidden app must keep its background process running');

  steps.step('tray click restores the same renderer and conversation');
  await desktop.evaluate(() => globalThis.superaiTrayFixture.tray.emit('click'));
  assert.equal(await desktop.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).isVisible(), initial.windowId), true);
  assert.equal(await page.evaluate(() => window.traySmokeMarker), 'same renderer');
  await page.screenshot({ path: path.join(output, 'restored.png') });

  steps.step('Open restores a minimized/hidden window');
  await desktop.evaluate(({ BrowserWindow }, id) => { const main = BrowserWindow.fromId(id); main.minimize(); main.close(); }, initial.windowId);
  await desktop.evaluate(() => globalThis.superaiTrayFixture.menu.getMenuItemById('show-window').click());
  const restored = await desktop.evaluate(({ BrowserWindow }, id) => { const main = BrowserWindow.fromId(id); return { visible: main.isVisible(), minimized: main.isMinimized() }; }, initial.windowId);
  assert.equal(restored.visible, true); assert.equal(restored.minimized, false);

  steps.step('native tray Exit terminates the app');
  const closed = desktop.waitForEvent('close', { timeout: 15000 });
  await desktop.evaluate(() => { setTimeout(() => globalThis.superaiTrayFixture.menu.getMenuItemById('quit-app').click(), 50); });
  await closed;
  assert.equal(processHandle.exitCode, 0);
  desktop = undefined;
  console.log(JSON.stringify({ passed: true, menu: initial.menu, backgroundContinued: true, rendererPreserved: true, exitCode: processHandle.exitCode, screenshots: output }));
} finally {
  clearTimeout(guard);
  if (desktop && processHandle?.exitCode === null && processHandle?.signalCode === null) await closeApp(desktop, steps);
}
