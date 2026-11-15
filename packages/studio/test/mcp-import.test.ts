import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMcpJson } from '../client/src/mcpImport.js';

test('pasted mcpServers JSON becomes servers the add route accepts', () => {
  assert.deepEqual(parseMcpJson('{ "mcpServers": { "playwright": { "command": "npx", "args": ["@playwright/mcp@latest", "--extension"] } } }'),
    [{ name: 'playwright', type: 'stdio', command: 'npx', args: ['@playwright/mcp@latest', '--extension'] }]);
  assert.equal(parseMcpJson('"playwright": { "command": "npx", "args": [] },').length, 1, 'inner part without the outer braces');
  const vscode = parseMcpJson('{ "servers": { "docs": { "type": "sse", "url": "https://x.dev/sse" }, "gh": { "url": "https://api.example.com/mcp", "env": { "TOKEN": 1 } } } }');
  assert.deepEqual(vscode.map((s) => [s.name, s.type, s.url]), [['docs', 'sse', 'https://x.dev/sse'], ['gh', 'http', 'https://api.example.com/mcp']]);
  assert.deepEqual(vscode[1].env, { TOKEN: '1' });
  assert.equal(parseMcpJson('{ "my server!": { "command": "node" } }')[0].name, 'my-server');
  assert.throws(() => parseMcpJson('{ not json'), /JSON/);
  assert.throws(() => parseMcpJson('{ "mcpServers": { "a": { "foo": 1 } } }'), /EMPTY/);
});
