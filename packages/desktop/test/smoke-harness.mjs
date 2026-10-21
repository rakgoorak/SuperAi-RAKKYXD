// Shared guard rails for the Electron smoke tests: a CI hang must say where it stopped.
import { execFileSync } from 'node:child_process';

/** Step logger. Every step is printed with the seconds since start, so a hang shows the last step reached. */
export function stepper(name) {
  const start = Date.now();
  let current = 'start';
  const log = (msg) => process.stdout.write(`[${name} +${((Date.now() - start) / 1000).toFixed(1)}s] ${msg}\n`);
  return {
    step(label) { current = label; log(label); },
    log,
    get current() { return current; },
  };
}

/** Reject after `ms` with a message naming what was being waited for. */
export function withTimeout(promise, ms, what) {
  let timer;
  const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/** Print renderer console errors and crashes as they happen. */
export function watchPage(page, steps) {
  page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') steps.log(`renderer ${msg.type()}: ${msg.text()}`); });
  page.on('crash', () => steps.log('renderer crashed'));
}

/** Close the app, but never hang on it: after 15 s kill the whole process tree. */
export async function closeApp(app, steps) {
  if (!app) return;
  const proc = app.process();
  try {
    await withTimeout(app.close(), 15000, 'app.close()');
  } catch (error) {
    steps.log(`${error.message}; killing process tree`);
    try {
      if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
      else proc.kill('SIGKILL');
    } catch {}
  }
}

/** Last resort: if the whole test exceeds `ms`, report the step it was on and exit non-zero. */
export function watchdog(ms, steps, onTimeout) {
  const timer = setTimeout(async () => {
    steps.log(`WATCHDOG: no finish after ${ms / 1000}s, stuck at step "${steps.current}"`);
    try { await withTimeout(Promise.resolve(onTimeout?.()), 10000, 'watchdog diagnostics'); } catch (e) { steps.log(e.message); }
    process.exit(1);
  }, ms);
  // Not unref'd: a hang on a bare pending promise must still reach this report.
  return timer;
}

/** Save a screenshot without letting a stuck renderer block the report. */
export async function snapshot(page, file, steps) {
  try {
    await withTimeout(page.screenshot({ path: file }), 10000, 'screenshot');
    steps.log(`screenshot: ${file}`);
  } catch (e) {
    steps.log(`screenshot failed: ${e.message}`);
  }
}
