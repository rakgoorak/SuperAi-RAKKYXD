// Capture the real native tray/menu so the smoke test can invoke its actual callbacks.
import { Tray, dialog } from 'electron';
dialog.showErrorBox = (title, message) => console.error(`[tray startup] ${title}: ${message}`);
const setContextMenu = Tray.prototype.setContextMenu;
Tray.prototype.setContextMenu = function (menu) {
  globalThis.superaiTrayFixture = { tray: this, menu };
  return setContextMenu.call(this, menu);
};
await import('../app.mjs');
