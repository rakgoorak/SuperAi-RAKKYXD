import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { closeApp } from './test/smoke-harness.mjs';

test('Windows smoke cleanup hides and bounds its taskkill helper', { skip: process.platform !== 'win32' }, async () => {
  const original = childProcess.execFileSync;
  const calls = [];
  childProcess.execFileSync = (...args) => { calls.push(args); return Buffer.alloc(0); };
  syncBuiltinESMExports();
  try {
    // Exercise the real fallback without starting or killing any OS process.
    const app = { process: () => ({ pid: 12345678 }), close: async () => { throw new Error('fixture close failed'); } };
    await closeApp(app, { log() {} });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'taskkill');
    assert.deepEqual(calls[0][1], ['/PID', '12345678', '/T', '/F']);
    assert.equal(calls[0][2].windowsHide, true, 'background cleanup must not create a visible Windows console');
    assert.ok(calls[0][2].timeout > 0 && calls[0][2].timeout <= 10000, 'cleanup helper must have a deadline');
  } finally { childProcess.execFileSync = original; syncBuiltinESMExports(); }
});

test('normal Electron close never invokes taskkill', async () => {
  const original = childProcess.execFileSync;
  const calls = [];
  childProcess.execFileSync = (...args) => { calls.push(args); return Buffer.alloc(0); };
  syncBuiltinESMExports();
  try {
    await closeApp({ process: () => ({ pid: 12345678 }), close: async () => {} }, { log() {} });
    assert.equal(calls.length, 0);
  } finally { childProcess.execFileSync = original; syncBuiltinESMExports(); }
});

test('failed Windows termination is reported rather than silently claiming cleanup', { skip: process.platform !== 'win32' }, async () => {
  const original = childProcess.execFileSync;
  const logs = [];
  childProcess.execFileSync = () => { throw new Error('fixture termination denied'); };
  syncBuiltinESMExports();
  try {
    await closeApp({ process: () => ({ pid: 12345678 }), close: async () => { throw new Error('fixture close failed'); } }, { log: message => logs.push(message) });
    assert.ok(logs.some(message => message.includes('cleanup failed') && message.includes('12345678')), 'failed cleanup must leave an actionable breadcrumb');
  } finally { childProcess.execFileSync = original; syncBuiltinESMExports(); }
});
