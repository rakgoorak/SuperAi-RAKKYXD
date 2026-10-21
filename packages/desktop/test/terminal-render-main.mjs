import { app, BrowserWindow } from 'electron';
app.setPath('userData', process.env.SUPERAI_RENDER_DATA);
app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: 1100, height: 700, show: false, webPreferences: { sandbox: true } });
  await window.loadURL(process.env.SUPERAI_RENDER_URL);
});
app.on('window-all-closed', () => app.quit());
