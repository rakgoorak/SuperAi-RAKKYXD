import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { SelfHealingManager, detectVerificationCommand, extractFailureSummary } from '../server/SelfHealingManager.js';

test('detectVerificationCommand: identifies correct test command per project', async () => {
  const tempDir = path.join(os.tmpdir(), `test-heal-detect-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // 1. package.json with test script
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }));
    assert.equal(await detectVerificationCommand(tempDir), 'npm test');

    // 2. package.json with only build
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ scripts: { build: 'tsc' } }));
    assert.equal(await detectVerificationCommand(tempDir), 'npm run build');

    // 3. package.json with standard "no test specified" -> falls back to build or test
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1', build: 'vite build' } }));
    assert.equal(await detectVerificationCommand(tempDir), 'npm run build');

    // 4. Cargo.toml
    await fs.unlink(path.join(tempDir, 'package.json'));
    await fs.writeFile(path.join(tempDir, 'Cargo.toml'), '[package]\nname="test"');
    assert.equal(await detectVerificationCommand(tempDir), 'cargo test');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test('extractFailureSummary: extracts error messages and stack traces', () => {
  const rawLog = `
> app@1.0.0 test
> vitest

Running 10 tests...
✓ math.test.ts
✖ auth.test.ts
  AssertionError: expected 'active' to equal 'suspended'
    at D:\\project\\auth.test.ts:42:15
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
  
Tests failed: 1
Tests passed: 9
`;

  const summary = extractFailureSummary(rawLog);
  assert.match(summary, /AssertionError/);
  assert.match(summary, /auth\.test\.ts:42/);
});

test('SelfHealingManager: runs verification and executes healing loop', async () => {
  const manager = new SelfHealingManager();
  const tempDir = path.join(os.tmpdir(), `test-heal-loop-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  const flagFile = path.join(tempDir, 'fixed.marker');
  const testScript = path.join(tempDir, 'run-check.js');

  // Script fails if fixed.marker doesn't exist
  await fs.writeFile(testScript, `
const fs = require('fs');
if (!fs.existsSync(process.argv[2])) {
  console.error('FAIL: marker missing');
  process.exit(1);
}
console.log('PASS: marker found');
process.exit(0);
`);

  try {
    // 1. Initial verification fails
    const failResult = await manager.runVerification(tempDir, 'node run-check.js fixed.marker');
    assert.equal(failResult.passed, false);
    assert.equal(failResult.exitCode, 1);
    assert.match(failResult.failureSummary, /FAIL: marker missing/);

    // 2. Healing loop simulation: fails on attempt 1, agent fixes it by creating marker, passes on attempt 2
    let fixApplied = false;
    const loopResult = await manager.runHealingLoop({
      cwd: tempDir,
      command: 'node run-check.js fixed.marker',
      maxAttempts: 3,
      agentSend: async (prompt) => {
        assert.match(prompt, /Self-Healing Loop/);
        assert.match(prompt, /FAIL: marker missing/);
        await fs.writeFile(flagFile, 'ok');
        fixApplied = true;
      },
    });

    assert.equal(loopResult.success, true);
    assert.equal(loopResult.totalAttempts, 2);
    assert.equal(fixApplied, true);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});
