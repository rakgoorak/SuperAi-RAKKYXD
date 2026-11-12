import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createTrayController } from './tray.mjs';

function fixture() {
  const app = new EventEmitter();
  app.quits = 0;
  app.quit = () => { app.quits++; app.emit('before-quit'); };
  const window = new EventEmitter();
  Object.assign(window, { hidden: false, minimized: false, destroyed: false, focusCount: 0,
    isDestroyed: () => window.destroyed, isMinimized: () => window.minimized,
    restore: () => { window.minimized = false; }, show: () => { window.hidden = false; },
    hide: () => { window.hidden = true; }, focus: () => { window.focusCount++; } });
  class Tray extends EventEmitter {
    constructor(icon) { super(); this.icon = icon; this.destroyed = false; }
    setToolTip(text) { this.tooltip = text; }
    setContextMenu(menu) { this.menu = menu; }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
  }
  const controller = createTrayController({ app, window, Tray, Menu: { buildFromTemplate: template => template }, icon: 'brand.ico' });
  const close = () => { let prevented = false; window.emit('close', { preventDefault: () => { prevented = true; } }); return prevented; };
  return { app, window, controller, close };
}

test('X hides the main window without quitting or destroying it', () => {
  const f = fixture();
  assert.equal(f.close(), true);
  assert.equal(f.window.hidden, true);
  assert.equal(f.window.destroyed, false);
  assert.equal(f.app.quits, 0);
  assert.equal(f.controller.tray.tooltip, 'SuperAi & RAKKYXD');
});

test('tray click, double-click, menu Open and app activation restore the same window', () => {
  const f = fixture();
  for (const open of [() => f.controller.tray.emit('click'), () => f.controller.tray.emit('double-click'), () => f.controller.tray.menu.find(item => item.id === 'show-window').click(), () => f.app.emit('activate')]) {
    f.window.hidden = true; f.window.minimized = true;
    open();
    assert.equal(f.window.hidden, false);
    assert.equal(f.window.minimized, false);
  }
  assert.equal(f.window.focusCount, 4);
});

test('tray Exit and external app.quit allow the window to close', () => {
  const f = fixture();
  f.controller.tray.menu.find(item => item.id === 'quit-app').click();
  assert.equal(f.app.quits, 1);
  assert.equal(f.close(), false);
  assert.equal(f.window.hidden, false);
  const external = fixture();
  external.app.emit('before-quit');
  assert.equal(external.close(), false, 'updater and OS quit must not hide instead');
});

test('session end quits and final shutdown destroys the tray and removes listeners', () => {
  const f = fixture();
  f.window.emit('session-end');
  assert.equal(f.app.quits, 1);
  f.app.emit('will-quit');
  assert.equal(f.controller.tray.isDestroyed(), true);
  assert.equal(f.window.listenerCount('close'), 0);
  assert.equal(f.app.listenerCount('activate'), 0);
});

test('a destroyed tray never traps a window in the background', () => {
  const f = fixture();
  f.controller.tray.destroy();
  assert.equal(f.close(), false);
});
