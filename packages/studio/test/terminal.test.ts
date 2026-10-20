import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { TerminalSessionManager } from '../server/TerminalSessionManager.js';
import { WorkspaceRegistry } from '../server/WorkspaceRegistry.js';

test('TerminalSessionManager: spawns a process and buffers output', async () => {
  const manager = new TerminalSessionManager();
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'sh';
  const args = isWindows ? ['/c', 'echo Hello BridgeMind Multi-Terminal'] : ['-c', 'echo Hello BridgeMind Multi-Terminal'];

  const session = manager.spawnSession({
    name: 'test-session',
    command,
    args,
    forcePipe: true
  });

  assert.ok(session.id);
  assert.strictEqual(session.name, 'test-session');

  // Wait for process output
  await new Promise<void>((resolve, reject) => {
    const timer=setTimeout(()=>reject(new Error('Terminal output timed out')),5000);
    let unsub=()=>{};
    unsub = manager.subscribe(session.id, (chunk) => {
      if (chunk.includes('Hello BridgeMind Multi-Terminal')) {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
  });

  assert.ok(session.bufferedOutput.includes('Hello BridgeMind Multi-Terminal'));
  manager.killAll();
});

test('WorkspaceRegistry: manages workspaces and threads', () => {
  const tempFile = path.join(os.tmpdir(), `test-workspaces-${Date.now()}.json`);
  const registry = new WorkspaceRegistry(tempFile);

  const workspaces = registry.getWorkspaces();
  assert.ok(workspaces.length > 0);

  const customWs = registry.createWorkspace('my-project', process.cwd());
  assert.strictEqual(customWs.name, 'my-project');

  const thread = registry.addThread(customWs.id, {
    title: 'Claude Worker',
    type: 'claude-code'
  });
  assert.strictEqual(thread.title, 'Claude Worker');
  assert.strictEqual(thread.type, 'claude-code');

  registry.updateThread(customWs.id, thread.id, { status: 'running', unreadCount: 5 });
  const updatedWs = registry.getWorkspace(customWs.id);
  assert.strictEqual(updatedWs?.threads[0].status, 'running');
  assert.strictEqual(updatedWs?.threads[0].unreadCount, 5);

  registry.setActiveThread(customWs.id, thread.id);
  // Setting active thread clears unreadCount
  assert.strictEqual(registry.getWorkspace(customWs.id)?.threads[0].unreadCount, 0);

  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
  }
});
