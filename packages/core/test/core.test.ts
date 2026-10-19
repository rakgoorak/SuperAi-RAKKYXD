import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { BashTool } from '../src/tools/BashTool.js';
import { ViewFileTool, WriteFileTool } from '../src/tools/FileTools.js';
import { createProvider } from '../src/providers/index.js';
import { AgentLoop } from '../src/agent/AgentLoop.js';
import { BrowserLoginManager } from '../src/providers/BrowserLogin.js';

test('BashTool executes commands cleanly', async () => {
  const tool = new BashTool();
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'echo CORE_TOOL_OK' : 'echo CORE_TOOL_OK';
  const result = await tool.execute({ command });
  assert.ok(result.success);
  assert.ok(result.output.includes('CORE_TOOL_OK'));
});

test('FileTools reads and writes files', async () => {
  const tempFile = path.join(os.tmpdir(), `test-file-${Date.now()}.txt`);
  const writeTool = new WriteFileTool();
  const viewTool = new ViewFileTool();

  const writeRes = await writeTool.execute({ filePath: tempFile, content: 'Testing 1 2 3' });
  assert.ok(writeRes.success);

  const viewRes = await viewTool.execute({ filePath: tempFile });
  assert.ok(viewRes.success);
  assert.ok(viewRes.output.includes('Testing 1 2 3'));

  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
});

test('createProvider instantiates MockProvider', async () => {
  const provider = createProvider({ provider: 'mock' });
  const response = await provider.generate([{ role: 'user', content: 'hello' }]);
  assert.ok(response.text.length > 0);
});

test('AgentLoop processes turn with mock provider', async () => {
  const provider = createProvider({ provider: 'mock' });
  const loop = new AgentLoop(
    { id: 'agent-1', name: 'Tester', role: 'Tester Agent', systemPrompt: 'You test things.' },
    provider,
    []
  );
  const result = await loop.run('Write a function', { cwd: process.cwd() });
  assert.ok(result.success);
  assert.ok(result.output);
});

test('BrowserLoginManager initializes correctly', () => {
  const manager = new BrowserLoginManager();
  assert.ok(manager);
});
