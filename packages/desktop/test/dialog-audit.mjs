import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closeApp, stepper } from './smoke-harness.mjs';

const require = createRequire(import.meta.url);
const steps = stepper('dialog-audit');
const outputDir = path.resolve('output/dialog-audit');
await fs.mkdir(outputDir, { recursive: true });

const data = await fs.mkdtemp(path.resolve('output/audit-data-'));
const app = await electron.launch({
  executablePath: require('electron'),
  args: ['packages/desktop'],
  env: { SUPERAI_LANG: 'th', ...process.env, SUPERAI_DATA_DIR: data },
  timeout: 60000,
});

const auditReport = [];

try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  steps.step('page-ready');
  await page.waitForSelector('.app-shell');
  await page.waitForFunction(() => document.querySelector('.statusbar')?.textContent.includes('เชื่อมต่อแล้ว'));

  const resize = async (w, h) => {
    await app.evaluate(({ BrowserWindow }, [width, height]) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setContentSize(width, height);
    }, [w, h]);
    await page.waitForTimeout(300);
  };

  const measureElement = async (selector) => {
    return page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        selector: sel,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
        scroll: { scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight, clientWidth: el.clientWidth, clientHeight: el.clientHeight, scrollTop: el.scrollTop },
        overflowsX: el.scrollWidth > el.clientWidth + 1,
        overflowsY: el.scrollHeight > el.clientHeight + 1,
        styles: {
          position: style.position,
          display: style.display,
          overflow: style.overflow,
          overflowY: style.overflowY,
          overflowX: style.overflowX,
          maxHeight: style.maxHeight,
          maxWidth: style.maxWidth,
          zIndex: style.zIndex,
        },
      };
    }, selector);
  };

  // 1. SETUP GUIDE DIALOG (Fresh profile opens it automatically)
  steps.step('setup-guide');
  await resize(1280, 800);
  const setupDialog = page.getByRole('dialog', { name: 'เริ่มต้นใช้งาน SuperAi' });
  await setupDialog.waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(outputDir, '01-setup-guide-normal.png') });

  let setupMetrics = await measureElement('.dialog');
  auditReport.push({ dialog: 'setup-guide', viewport: '1280x800', metrics: setupMetrics });

  // Check setup guide on narrow screen
  await resize(850, 600);
  await page.screenshot({ path: path.join(outputDir, '02-setup-guide-narrow.png') });
  setupMetrics = await measureElement('.dialog');
  auditReport.push({ dialog: 'setup-guide', viewport: '850x600', metrics: setupMetrics });

  // Dismiss setup guide for subsequent tests
  await page.getByRole('button', { name: 'ปิดไว้ก่อน' }).click();
  await setupDialog.waitFor({ state: 'hidden' });
  await resize(1280, 800);

  // Setup mock project
  const ws = await page.evaluate(async (rootPath) => {
    return (await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'โปรเจกต์ทดสอบ UI Dialog', rootPath }),
    })).json();
  }, data);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell');
  await page.evaluate(() => localStorage.setItem('superai-setup-dismissed', '1'));

  // 2. SESSION LAUNCH DIALOG
  steps.step('session-dialog');
  // Click "+" in sidebar or open session
  await page.getByRole('button', { name: 'โปรเจกต์ทดสอบ UI Dialog', exact: true }).click();
  await page.getByRole('button', { name: 'เปิด session ใหม่' }).click();
  const sessionDialog = page.getByRole('dialog', { name: 'เปิด session ใหม่' });
  await sessionDialog.waitFor();
  await page.screenshot({ path: path.join(outputDir, '03-session-dialog-normal.png') });
  let sessionMetrics = await measureElement('.dialog');
  auditReport.push({ dialog: 'session', viewport: '1280x800', metrics: sessionMetrics });

  // Test ModelCombo inside Session dialog (if headless CLI available or SeatPicker)
  // Check preset details in session dialog
  const createPresetDetails = page.locator('details:has-text("สร้างชุด CLI ของคุณ")');
  if (await createPresetDetails.count()) {
    await createPresetDetails.locator('summary').click();
    await page.screenshot({ path: path.join(outputDir, '04-session-dialog-presets-expanded.png') });
  }

  // Check narrow screen session dialog
  await resize(800, 600);
  await page.screenshot({ path: path.join(outputDir, '05-session-dialog-narrow.png') });
  await resize(1280, 800);
  await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await sessionDialog.waitFor({ state: 'hidden' });

  // 3. SETTINGS DIALOG
  steps.step('settings-dialog');
  // Open settings from sidebar
  await page.getByRole('button', { name: 'การตั้งค่า', exact: true }).click();
  const settingsDialog = page.getByRole('dialog', { name: 'การตั้งค่าพื้นที่ทำงาน' });
  await settingsDialog.waitFor();

  // Tab: tools
  await page.screenshot({ path: path.join(outputDir, '06-settings-tools.png') });
  auditReport.push({ dialog: 'settings-tools', metrics: await measureElement('.dialog') });

  // Tab: models
  await page.getByRole('button', { name: 'Model และ Effort' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outputDir, '07-settings-models.png') });
  auditReport.push({ dialog: 'settings-models', metrics: await measureElement('.dialog') });

  // Check ModelCombo inside Settings! Look at how dropdown behaves!
  const modelToggles = page.locator('.settings-content .model-combo-toggle');
  if (await modelToggles.count() > 0) {
    await modelToggles.first().click();
    await page.waitForTimeout(200);
    const comboListMetrics = await measureElement('.model-combo-list');
    const inputMetrics = await measureElement('.settings-content .model-combo input');
    await page.screenshot({ path: path.join(outputDir, '08-settings-modelcombo-opened.png') });
    auditReport.push({ element: 'settings-modelcombo-dropdown', comboListMetrics, inputMetrics });
    await page.keyboard.press('Escape');
  }

  // Tab: folders
  await page.getByRole('button', { name: 'โฟลเดอร์' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outputDir, '09-settings-folders.png') });

  // Tab: voice
  await settingsDialog.getByRole('button', { name: 'เสียง', exact: true }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outputDir, '10-settings-voice.png') });

  // Test Settings on narrow viewport
  await resize(700, 550);
  await page.screenshot({ path: path.join(outputDir, '11-settings-narrow.png') });
  await resize(1280, 800);

  await page.getByRole('button', { name: 'เสร็จแล้ว' }).click();
  await settingsDialog.waitFor({ state: 'hidden' });

  // 4. ADD / EDIT PROJECT DIALOG
  steps.step('project-dialog');
  await page.getByRole('button', { name: 'เพิ่มโปรเจกต์', exact: true }).click();
  const projectDialog = page.getByRole('dialog', { name: 'เพิ่มโปรเจกต์' });
  await projectDialog.waitFor();

  // Test with extra long inputs
  await page.getByRole('textbox', { name: 'ชื่อโปรเจกต์' }).fill('โปรเจกต์พัฒนาระบบตรวจสอบขนาดหน้าจอและ Dialog UI อัตโนมัติที่มีชื่อยาวมากๆ เพื่อทดสอบการล้นกรอบและการตัดข้อความ');
  await page.getByLabel('โฟลเดอร์โปรเจกต์').fill('D:\\SuperVeryLongPathName\\WithExtremelyDeeplyNestedDirectories\\ThatExceedTypicalWindowWidths\\AndContainMultipleThaiAndEnglishSegments\\TestProjectFolder');
  await page.screenshot({ path: path.join(outputDir, '12-project-dialog-long-inputs.png') });
  auditReport.push({ dialog: 'project-dialog', metrics: await measureElement('.dialog') });

  await page.getByRole('button', { name: 'ยกเลิก' }).click();
  await projectDialog.waitFor({ state: 'hidden' });

  // 5. SKILLS DIALOG
  steps.step('skills-dialog');
  // Trigger skills dialog via window dispatch or sidebar
  await page.evaluate(() => {
    // Look for skills button or set dialog
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Skills'));
    if (btn) btn.click();
  });
  const skillsDialog = page.getByRole('dialog', { name: 'Skills ของโปรเจกต์' });
  if (await skillsDialog.count()) {
    await skillsDialog.waitFor();
    await page.screenshot({ path: path.join(outputDir, '13-skills-dialog-catalog.png') });
    auditReport.push({ dialog: 'skills-dialog-catalog', metrics: await measureElement('.dialog') });

    // Switch to skills.sh tab
    await page.getByRole('button', { name: 'ค้นหาบน skills.sh' }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outputDir, '14-skills-dialog-search.png') });

    await page.getByRole('button', { name: 'เสร็จแล้ว' }).click();
    await skillsDialog.waitFor({ state: 'hidden' });
  }

  // 6. HISTORY DIALOG
  steps.step('history-dialog');
  // Trigger history dialog
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('ประวัติ') || b.textContent?.includes('ประวัติ'));
    if (btn) btn.click();
  });
  const historyDialog = page.getByRole('dialog', { name: 'ค้นหาประวัติบทสนทนา' });
  if (await historyDialog.count()) {
    await historyDialog.waitFor();
    await page.screenshot({ path: path.join(outputDir, '15-history-dialog-empty.png') });
    auditReport.push({ dialog: 'history-dialog', metrics: await measureElement('.dialog') });

    // Fill search
    await page.getByRole('textbox', { name: 'ค้นหาประวัติบทสนทนา' }).fill('ทดสอบค้นหาข้อความที่มีความยาวมากๆ');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outputDir, '16-history-dialog-search.png') });

    // Close via close icon
    await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
    await historyDialog.waitFor({ state: 'hidden' });
  }

  // 7. CHANGES & DIFF DIALOG
  steps.step('changes-dialog');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('ไฟล์ที่เปลี่ยน') || b.textContent?.includes('ไฟล์ที่เปลี่ยน') || b.textContent?.includes('Changes'));
    if (btn) btn.click();
  });
  const changesDialog = page.getByRole('dialog', { name: 'ไฟล์ที่เปลี่ยนและผลงาน' });
  if (await changesDialog.count()) {
    await changesDialog.waitFor();
    await page.screenshot({ path: path.join(outputDir, '17-changes-dialog-normal.png') });
    auditReport.push({ dialog: 'changes-dialog', metrics: await measureElement('.dialog') });

    // Narrow screen to check 650px responsive breakpoint
    await resize(640, 500);
    await page.screenshot({ path: path.join(outputDir, '18-changes-dialog-responsive-640.png') });
    await resize(1280, 800);

    await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
    await changesDialog.waitFor({ state: 'hidden' });
  }

  // 8. CONFIRMATION DIALOGS (session-delete / delete project)
  steps.step('confirmation-dialogs');
  // Test project delete dialog
  await page.evaluate(() => {
    // Trigger delete project dialog
    const deleteBtn = Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('ลบโปรเจกต์'));
    if (deleteBtn) deleteBtn.click();
  });
  const deleteDialog = page.getByRole('dialog', { name: 'ลบโปรเจกต์จากรายการ?' });
  if (await deleteDialog.count()) {
    await deleteDialog.waitFor();
    await page.screenshot({ path: path.join(outputDir, '19-delete-project-dialog.png') });
    auditReport.push({ dialog: 'delete-project', metrics: await measureElement('.dialog') });
    await page.getByRole('button', { name: 'ยกเลิก' }).click();
    await deleteDialog.waitFor({ state: 'hidden' });
  }

  // 9. USAGE POPOVER
  steps.step('usage-popover');
  const usageBtn = page.getByRole('button', { name: 'โควตาการใช้งานของแต่ละผู้ให้บริการ' });
  if (await usageBtn.count()) {
    await usageBtn.click();
    const usagePopover = page.getByRole('dialog', { name: 'โควตาการใช้งาน' });
    await usagePopover.waitFor();
    await page.screenshot({ path: path.join(outputDir, '20-usage-popover-normal.png') });
    auditReport.push({ popup: 'usage-popover', metrics: await measureElement('.usage-popover') });

    // Check on narrow screen
    await resize(600, 600);
    await page.screenshot({ path: path.join(outputDir, '21-usage-popover-narrow.png') });
    auditReport.push({ popup: 'usage-popover-narrow', metrics: await measureElement('.usage-popover') });
    await resize(1280, 800);

    // Close usage
    await page.keyboard.press('Escape');
    await usagePopover.waitFor({ state: 'hidden' });
  }

  // 10. ATTACHMENT MENU POPOVER
  steps.step('attach-menu');
  const attachBtn = page.getByRole('button', { name: 'แนบไฟล์' });
  if (await attachBtn.count()) {
    await attachBtn.click();
    await page.waitForSelector('.attach-popover');
    await page.screenshot({ path: path.join(outputDir, '22-attach-menu-popover.png') });
    auditReport.push({ popup: 'attach-menu', metrics: await measureElement('.attach-popover') });
    await page.keyboard.press('Escape');
  }

  // 11. SLASH COMMAND MENU
  steps.step('slash-menu');
  const composer = page.getByRole('textbox', { name: 'คำสั่ง' });
  if (await composer.count()) {
    await composer.fill('/');
    await page.waitForTimeout(300);
    if (await page.locator('.slash-menu').count()) {
      await page.screenshot({ path: path.join(outputDir, '23-slash-menu-popup.png') });
      auditReport.push({ popup: 'slash-menu', metrics: await measureElement('.slash-menu') });
    }
    await composer.fill('');
  }

  // 12. DIALOG WITH SIMULATED ERROR STATE
  steps.step('dialog-error-state');
  // Open Add project dialog and trigger error
  await page.getByRole('button', { name: 'เพิ่มโปรเจกต์', exact: true }).click();
  await projectDialog.waitFor();
  await page.evaluate(() => {
    // Inject error state into dialog to see how it renders
    const dialogEl = document.querySelector('.dialog');
    if (dialogEl) {
      const heading = dialogEl.querySelector('.dialog-heading');
      const err = document.createElement('div');
      err.className = 'dialog-error';
      err.setAttribute('role', 'alert');
      err.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>ไม่สามารถเชื่อมต่อกับไดเรกทอรีที่ระบุได้ เนื่องจากไม่มีสิทธิ์การเข้าถึงไฟล์ (EACCES: permission denied, scandir "D:\\RestrictedFolder\\SystemVolumeInformation") กรุณาตรวจสอบสิทธิ์ผู้ดูแลระบบหรือเลือกโฟลเดอร์อื่น</span>';
      heading.after(err);
    }
  });
  await page.screenshot({ path: path.join(outputDir, '24-dialog-error-state.png') });
  await page.getByRole('button', { name: 'ยกเลิก' }).click();

  // Save audit report
  await fs.writeFile(path.join(outputDir, 'audit-report.json'), JSON.stringify(auditReport, null, 2), 'utf-8');
  steps.log('Audit completed successfully');
} catch (err) {
  steps.log(`ERROR during audit: ${err.stack}`);
} finally {
  await closeApp(app, steps);
}
