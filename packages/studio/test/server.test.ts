import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import os from 'node:os';
import { StudioServer } from '../server/StudioServer.js';
import WebSocket from 'ws';

test('StudioServer: REST endpoints and WebSocket terminal streaming', async () => {
  const testPort = 3889;
  const tempWorkspaceFile = path.join(os.tmpdir(), `test-server-ws-${Date.now()}.json`);
  const server = new StudioServer({ port: testPort, customWorkspacePath: tempWorkspaceFile });

  await server.start();

  try {
    // 1. Health check
    const healthRes = await fetch(`http://localhost:${testPort}/api/health`);
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok');

    // 2. Workspaces endpoint
    const wsRes = await fetch(`http://localhost:${testPort}/api/workspaces`);
    const wsData = await wsRes.json();
    assert.ok(Array.isArray(wsData));
    assert.ok(wsData.length > 0);

    // 3. Spawn terminal
    const isWindows = process.platform === 'win32';
    const spawnRes = await fetch(`http://localhost:${testPort}/api/terminals/spawn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-api-terminal',
        forcePipe: true,
        command: isWindows ? 'cmd.exe' : 'sh',
        args: isWindows ? ['/c', 'echo STREAM_TEST_OK'] : ['-c', 'echo STREAM_TEST_OK']
      })
    });
    const session = await spawnRes.json();
    assert.ok(session.id);

    // 4. Connect via WebSocket
    const received: string[] = [];
    const ws = new WebSocket(`ws://localhost:${testPort}/ws/terminal/${session.id}`);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 3000); // resolve after up to 3s

      ws.on('message', (msg) => {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === 'output') {
          received.push(parsed.data);
          if (parsed.data.includes('STREAM_TEST_OK')) {
            clearTimeout(timeout);
            resolve();
          }
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    ws.close();
    assert.ok(received.join('').includes('STREAM_TEST_OK'));

  } finally {
    await server.stop();
  }
});
