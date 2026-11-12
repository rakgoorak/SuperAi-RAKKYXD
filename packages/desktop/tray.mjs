/** Keep the desktop workspace alive when its window is closed; quit only on an explicit exit. */
export function createTrayController({ app, window, Tray, Menu, icon }) {
  // Create the icon before intercepting close: failure must never leave an unreachable window.
  const tray = new Tray(icon);
  let quitting = false;
  let disposed = false;
  const show = () => {
    if (quitting || disposed || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  };
  const quit = () => { quitting = true; app.quit(); };
  const beforeQuit = () => { quitting = true; };
  const close = event => {
    if (quitting || disposed || tray.isDestroyed()) return;
    event.preventDefault();
    window.hide();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.removeListener('close', close);
    window.removeListener('session-end', quit);
    app.removeListener('before-quit', beforeQuit);
    app.removeListener('activate', show);
    app.removeListener('will-quit', dispose);
    if (!tray.isDestroyed()) tray.destroy();
  };
  try {
    tray.setToolTip('SuperAi & RAKKYXD');
    tray.setContextMenu(Menu.buildFromTemplate([
      { id: 'show-window', label: 'เปิด SuperAi', click: show },
      { type: 'separator' },
      { id: 'quit-app', label: 'ออกจากโปรแกรม (Exit)', click: quit },
    ]));
    tray.on('click', show);
    tray.on('double-click', show);
    window.on('close', close);
    window.on('session-end', quit);
    app.on('before-quit', beforeQuit);
    app.on('activate', show);
    app.on('will-quit', dispose);
  } catch (error) { dispose(); throw error; }
  return { tray, show, quit, dispose };
}
