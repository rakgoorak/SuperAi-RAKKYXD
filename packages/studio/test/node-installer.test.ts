import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getNodeStatus, managedNodeDir, managedNodeBin, cliPath } from '../server/CliCatalog.js';
import { findManagedNode } from '../server/NodeInstaller.js';

test('managedNodeDir and managedNodeBin point into .opencode-multi/node-v22', () => {
  assert.ok(managedNodeDir().includes('.opencode-multi'));
  assert.ok(managedNodeDir().endsWith('node-v22'));
  if (process.platform === 'win32') {
    assert.equal(managedNodeBin(), managedNodeDir());
  } else {
    assert.ok(managedNodeBin().endsWith(path.join('node-v22', 'bin')));
  }
  assert.ok(cliPath().includes(managedNodeBin()));
});

test('getNodeStatus evaluates node and npm presence and reports version & ready state', () => {
  // Test with mock find returning null
  const missing = getNodeStatus(() => null);
  assert.equal(missing.installed, false);
  assert.equal(missing.ready, false);
  assert.equal(missing.version, null);

  // Test with node 20
  const oldNode = getNodeStatus(
    (cmd) => (['node', 'npm'].includes(cmd) ? '/usr/bin/' + cmd : null),
    () => '20.11.1',
  );
  assert.equal(oldNode.installed, true);
  assert.equal(oldNode.ready, false);
  assert.equal(oldNode.major, 20);

  // Test with node 22
  const readyNode = getNodeStatus(
    (cmd) => (['node', 'npm'].includes(cmd) ? '/usr/bin/' + cmd : null),
    () => '22.23.0',
  );
  assert.equal(readyNode.installed, true);
  assert.equal(readyNode.ready, true);
  assert.equal(readyNode.major, 22);
});

test('findManagedNode correctly identifies binaries in base directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'managed-node-test-'));
  try {
    assert.equal(findManagedNode(tmp), null);
    const nodeFile = process.platform === 'win32' ? path.join(tmp, 'node.exe') : path.join(tmp, 'bin', 'node');
    const npmFile = process.platform === 'win32' ? path.join(tmp, 'npm.cmd') : path.join(tmp, 'bin', 'npm');
    fs.mkdirSync(path.dirname(nodeFile), { recursive: true });
    fs.mkdirSync(path.dirname(npmFile), { recursive: true });
    fs.writeFileSync(nodeFile, 'mock-node');
    fs.writeFileSync(npmFile, 'mock-npm');

    const result = findManagedNode(tmp);
    assert.ok(result);
    assert.equal(result?.node, nodeFile);
    assert.equal(result?.npm, npmFile);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
