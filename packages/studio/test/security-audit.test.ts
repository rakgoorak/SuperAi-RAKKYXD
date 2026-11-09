import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { StudioServer, isValidLocalHost } from '../server/StudioServer.js';
import { trustFolder } from '../server/FolderTrust.js';

function rawHttpGet(port: number, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: '/api/health',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('isValidLocalHost: accepts local loopback and rejects spoofed/external hostnames', () => {
  // Valid local hosts
  assert.equal(isValidLocalHost('localhost'), true);
  assert.equal(isValidLocalHost('localhost:3888'), true);
  assert.equal(isValidLocalHost('127.0.0.1'), true);
  assert.equal(isValidLocalHost('127.0.0.1:3888'), true);
  assert.equal(isValidLocalHost('[::1]'), true);
  assert.equal(isValidLocalHost('[::1]:3888'), true);
  assert.equal(isValidLocalHost(undefined), true);

  // Spoofed hostnames (e.g. DNS rebinding / bracket bypass vectors)
  assert.equal(isValidLocalHost('[attacker.com]:3888'), false);
  assert.equal(isValidLocalHost('[attacker.com]'), false);
  assert.equal(isValidLocalHost('attacker.com:3888'), false);
  assert.equal(isValidLocalHost('attacker.com'), false);
  assert.equal(isValidLocalHost('evil-localhost'), false);
  assert.equal(isValidLocalHost('localhost.evil.com'), false);
  assert.equal(isValidLocalHost('127.0.0.1.nip.io'), false);
  assert.equal(isValidLocalHost('[::2]:3888'), false);
  assert.equal(isValidLocalHost('localhost:abc'), false);
});

test('StudioServer: security defenses against cross-site requests and host spoofing', async () => {
  const tempWorkspaceFile = path.join(os.tmpdir(), `test-security-ws-${Date.now()}.json`);
  const server = new StudioServer({ port: 0, customWorkspacePath: tempWorkspaceFile });
  await server.start();
  const testPort = server.getPort();

  try {
    // 1. Normal localhost request succeeds
    const okRes = await fetch(`http://127.0.0.1:${testPort}/api/health`);
    assert.equal(okRes.status, 200);

    // 2. Cross-site request header (Sec-Fetch-Site: cross-site) is blocked with 403
    const crossSiteRes = await fetch(`http://127.0.0.1:${testPort}/api/health`, {
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    });
    assert.equal(crossSiteRes.status, 403);
    const crossSiteData = await crossSiteRes.json();
    assert.match(crossSiteData.error, /cross-site/i);

    // 3. Spoofed Host header with square bracket bypass is blocked with 403 via raw HTTP
    const spoofedHostRes = await rawHttpGet(testPort, { Host: `[attacker.com]:${testPort}` });
    assert.equal(spoofedHostRes.status, 403);

    // 4. Disallowed Origin is blocked with 403
    const disallowedOriginRes = await fetch(`http://127.0.0.1:${testPort}/api/health`, {
      headers: { Origin: 'http://malicious-site.com' },
    });
    assert.equal(disallowedOriginRes.status, 403);

    // 5. Allowed Origin succeeds
    const allowedOriginRes = await fetch(`http://127.0.0.1:${testPort}/api/health`, {
      headers: { Origin: `http://localhost:${testPort}` },
    });
    assert.equal(allowedOriginRes.status, 200);
  } finally {
    await server.stop();
  }
});

test('FolderTrust: rejects control characters and newlines', () => {
  assert.equal(trustFolder('codex', 'C:\\valid\\path\n[malicious_toml]'), false);
  assert.equal(trustFolder('codex', 'C:\\valid\\path\r\ntrust_level="trusted"'), false);
  assert.equal(trustFolder('codex', 'C:\\valid\\path\0nullbyte'), false);
  assert.equal(trustFolder('claude-code', 'D:\\project\x00escape'), false);
  assert.equal(trustFolder('antigravity', 'D:\\project\nbreak'), false);
});
