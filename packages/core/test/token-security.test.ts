import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { CredentialStore, CredentialEncryption } from '../src/providers/CredentialStore.js';
import { BrowserLoginManager, matchesSessionCookie } from '../src/providers/BrowserLogin.js';
import { WebSessionProvider } from '../src/providers/WebSessionProvider.js';
import { OpenAIProvider } from '../src/providers/OpenAIProvider.js';
import { GeminiProvider } from '../src/providers/GeminiProvider.js';
import { AnthropicProvider } from '../src/providers/AnthropicProvider.js';
import { OllamaProvider } from '../src/providers/OllamaProvider.js';
import { createProvider } from '../src/providers/index.js';

const token = 'FAKE-CREDENTIAL-0123456789-sensitive';
// This adapter exercises real authenticated encryption with an ephemeral in-memory key.
// Production uses Electron/OS encryption, never this adapter or a local key file.
function cipher(key = randomBytes(32)): CredentialEncryption {
  return {
    isEncryptionAvailable: () => true,
    encryptString(value) {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', key, iv);
      const bytes = Buffer.concat([c.update(value, 'utf8'), c.final()]);
      return Buffer.concat([iv, c.getAuthTag(), bytes]);
    },
    decryptString(value) {
      const c = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      c.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([c.update(value.subarray(28)), c.final()]).toString('utf8');
    },
  };
}

function fixture(t: any) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-token-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, store: new CredentialStore(dir, cipher()) };
}

test('migrates only after verified encrypted persistence; isolates Gemini session and API', t => {
  const { dir, store } = fixture(t);
  fs.mkdirSync(path.join(dir, 'browser-profile-gemini'));
  fs.writeFileSync(path.join(dir, 'browser-profile-gemini', 'legacy-session'), token);
  fs.writeFileSync(path.join(dir, 'auth.json'), JSON.stringify({ gemini: token, openai: 'fake-api' }));
  assert.equal(store.get('session', 'gemini'), token);
  assert.equal(store.get('api', 'gemini'), undefined);
  assert.equal(store.get('api', 'openai'), 'fake-api');
  assert.equal(fs.existsSync(path.join(dir, 'auth.json')), false);
  assert.equal(fs.existsSync(path.join(dir, 'browser-profile-gemini')), false);
  const encrypted = path.join(dir, 'credentials.enc');
  assert.equal(fs.readFileSync(encrypted).includes(Buffer.from(token)), false);
  if (process.platform !== 'win32') assert.equal(fs.statSync(encrypted).mode & 0o777, 0o600);
  store.saveSession('claude', 'fake-other-service-token');
  store.forgetSession('gemini');
  assert.equal(store.get('session', 'gemini'), undefined);
  assert.equal(store.get('session', 'claude'), 'fake-other-service-token');
});

test('encryption unavailable, insecure backend, corruption and failed verification retain legacy data', t => {
  const { dir } = fixture(t);
  const legacy = path.join(dir, 'auth.json');
  const contents = JSON.stringify({ chatgpt: token });
  fs.mkdirSync(path.join(dir, 'browser-profile-chatgpt'));
  fs.writeFileSync(legacy, contents);
  const base = cipher();
  for (const adapter of [
    { ...base, isEncryptionAvailable: () => false },
    { ...base, getSelectedStorageBackend: () => 'basic_text' },
    { ...base, decryptString: () => 'invalid verification' },
    { ...base, encryptString: () => { throw new Error(token); } },
  ]) {
    assert.throws(() => new CredentialStore(dir, adapter).migrateLegacy(), e => !String(e).includes(token));
    assert.equal(fs.readFileSync(legacy, 'utf8'), contents);
    assert.equal(fs.existsSync(path.join(dir, 'browser-profile-chatgpt')), true);
    assert.equal(fs.existsSync(path.join(dir, 'credentials.enc')), false);
  }
  fs.writeFileSync(path.join(dir, 'credentials.enc'), 'corrupt');
  assert.throws(() => new CredentialStore(dir, base).migrateLegacy());
  assert.equal(fs.readFileSync(legacy, 'utf8'), contents);
});

test('migration conflicts and unknown slots preserve both sources', t => {
  const { dir, store } = fixture(t);
  store.saveSession('chatgpt', token);
  for (const old of [{ chatgpt: 'different-token' }, { unknown: token }]) {
    const contents = JSON.stringify(old);
    fs.writeFileSync(path.join(dir, 'auth.json'), contents);
    assert.throws(() => store.migrateLegacy());
    assert.equal(fs.readFileSync(path.join(dir, 'auth.json'), 'utf8'), contents);
  }
});

test('credentials survive a new process and forgotten sessions do not return on restart', t => {
  const { dir } = fixture(t);
  const key = randomBytes(32);
  const store = new CredentialStore(dir, cipher(key));
  fs.writeFileSync(path.join(dir, 'auth.json'), JSON.stringify({ chatgpt: token }));
  assert.equal(store.get('session', 'chatgpt'), token);
  // Transfer only an ephemeral test key over stdin; no OS store or real profile is opened.
  const script = `
    import fs from 'node:fs';
    import { createDecipheriv } from 'node:crypto';
    import { CredentialStore } from ${JSON.stringify(new URL('../src/providers/CredentialStore.ts', import.meta.url).href)};
    const { dir, key, expected } = JSON.parse(fs.readFileSync(0, 'utf8'));
    const store = new CredentialStore(dir, {
      isEncryptionAvailable: () => true,
      encryptString() { throw new Error('read only probe'); },
      decryptString(value) {
        const c = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), value.subarray(0, 12));
        c.setAuthTag(value.subarray(12, 28));
        return Buffer.concat([c.update(value.subarray(28)), c.final()]).toString('utf8');
      }
    });
    if (store.get('session', 'chatgpt') !== expected) process.exit(2);
    console.log('verified');
  `;
  const restart = (expected?: string) => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
      input: JSON.stringify({ dir, key: key.toString('hex'), expected }), encoding: 'utf8', timeout: 15000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'verified');
    assert.equal((result.stdout + result.stderr).includes(token.slice(0, 10)), false);
  };
  restart(token);
  store.forgetSession('chatgpt');
  restart();
  assert.equal(fs.existsSync(path.join(dir, 'auth.json')), false);
  assert.deepEqual(fs.readdirSync(dir), ['credentials.enc']);
  assert.equal(fs.readFileSync(path.join(dir, 'credentials.enc')).includes(Buffer.from(token)), false);
});

test('failed file replacement preserves credentials and legacy source and removes temporary files', t => {
  const { dir, store } = fixture(t);
  store.saveSession('claude', 'FAKE-EXISTING-CLAUDE-SESSION');
  const encrypted = fs.readFileSync(path.join(dir, 'credentials.enc'));
  const legacy = JSON.stringify({ chatgpt: token });
  fs.writeFileSync(path.join(dir, 'auth.json'), legacy);
  const rename = fs.renameSync;
  const mocked = t.mock.method(fs, 'renameSync', (source, destination) => {
    if (String(destination) === path.join(dir, 'credentials.enc')) throw new Error(token);
    return rename(source, destination);
  });
  assert.throws(() => store.migrateLegacy(), e => !String(e).includes(token.slice(0, 10)));
  assert.deepEqual(fs.readFileSync(path.join(dir, 'credentials.enc')), encrypted);
  assert.equal(fs.readFileSync(path.join(dir, 'auth.json'), 'utf8'), legacy);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['auth.json', 'credentials.enc']);
  mocked.mock.restore();
  assert.equal(store.get('session', 'chatgpt'), token);
  assert.equal(store.get('session', 'claude'), 'FAKE-EXISTING-CLAUDE-SESSION');
});

test('failed forgetting reports failure and preserves the previously saved session', t => {
  const { dir } = fixture(t);
  const encryption = cipher();
  const store = new CredentialStore(dir, encryption);
  store.saveSession('chatgpt', token);
  const mocked = t.mock.method(encryption, 'encryptString', () => { throw new Error(token); });
  assert.throws(() => store.forgetSession('chatgpt'), e => !String(e).includes(token.slice(0, 10)));
  mocked.mock.restore();
  assert.equal(new CredentialStore(dir, encryption).get('session', 'chatgpt'), token);
  assert.deepEqual(fs.readdirSync(dir), ['credentials.enc']);
});

test('cookie selection requires exact name and provider domain, secure and unexpired', () => {
  const cookie = { name: 'sessionKey', domain: '.claude.ai', secure: true, expires: -1 };
  assert.ok(matchesSessionCookie(cookie, 'sessionKey', 'claude.ai'));
  for (const patch of [
    { domain: 'claude.ai.attacker.test' }, { domain: 'evilclaude.ai' },
    { name: 'prefix-sessionKey' }, { name: 'unrelated' }, { secure: false }, { expires: 1 },
  ]) assert.equal(matchesSessionCookie({ ...cookie, ...patch }, 'sessionKey', 'claude.ai'), false);
});

test('browser login returns only status; logout removes encrypted and old browser profile copies', async t => {
  const { dir, store } = fixture(t);
  const original = chromium.connectOverCDP;
  t.after(() => { chromium.connectOverCDP = original; });
  chromium.connectOverCDP = (async () => ({ contexts: () => [{ cookies: async () => [
    { name: 'sessionKey', domain: 'claude.ai.attacker.test', value: 'WRONG-TOKEN', secure: true, expires: -1 },
    { name: 'sessionKey', domain: '.claude.ai', value: token, secure: true, expires: -1 },
  ] }] })) as any;
  const manager = new BrowserLoginManager(store, dir);
  const statuses: string[] = [];
  const result = await manager.login('claude', s => statuses.push(s));
  assert.equal(result.success, true);
  assert.equal(Object.hasOwn(result, 'token'), false);
  assert.equal(JSON.stringify([result, statuses]).includes(token.slice(0, 10)), false);
  assert.equal(store.get('session', 'claude'), token);
  fs.mkdirSync(path.join(dir, 'browser-profile-claude'));
  assert.deepEqual(await manager.logout('claude'), { success: true });
  assert.equal(store.get('session', 'claude'), undefined);
  assert.equal(fs.existsSync(path.join(dir, 'browser-profile-claude')), false);
  assert.throws(() => store.saveSession('../invalid', token));
});

test('dedicated browser uses a nonpersistent context and never scrapes foreign-origin localStorage', async t => {
  const { dir, store } = fixture(t);
  const originalConnect = chromium.connectOverCDP;
  const originalLaunch = chromium.launch;
  t.after(() => { chromium.connectOverCDP = originalConnect; chromium.launch = originalLaunch; });
  chromium.connectOverCDP = (async () => { throw new Error('no CDP'); }) as any;
  let closed = false;
  chromium.launch = (async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {}, isClosed: () => false,
        evaluate: async () => { assert.fail('must not scrape localStorage'); },
      }),
      cookies: async () => [
        { name: 'sessionKey', domain: 'evil.test', value: 'WRONG-FOREIGN-CREDENTIAL', secure: true, expires: -1 },
        { name: 'sessionKey', domain: 'claude.ai', value: token, secure: true, expires: -1 },
      ],
      close: async () => {},
    }),
    close: async () => { closed = true; },
  })) as any;
  const result = await new BrowserLoginManager(store, dir).login('claude');
  assert.equal(result.success, true);
  assert.equal(JSON.stringify(result).includes(token.slice(0, 10)), false);
  assert.equal(store.get('session', 'claude'), token);
  assert.equal(closed, true);
  assert.equal(fs.existsSync(path.join(dir, 'browser-profile-claude')), false);
});

test('factory never substitutes another service session or a session as a Gemini API key', t => {
  const original = CredentialStore.prototype.get;
  t.after(() => { CredentialStore.prototype.get = original; });
  CredentialStore.prototype.get = function(kind, service) {
    return kind === 'session' && service === 'chatgpt' ? token : undefined;
  };
  const provider = createProvider({ provider: 'web_session', webService: 'claude' }) as WebSessionProvider;
  assert.equal(provider.hasSession(), false);
});

test('web sessions reject foreign destinations and aliases before sending anything', async t => {
  let calls = 0;
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = (async () => { calls++; throw new Error(token); }) as typeof fetch;
  for (const endpointUrl of ['https://evil.test', 'https://chatgpt.com.evil.test',
    'https://chatgpt.com@evil.test', 'http://chatgpt.com', 'https://chatgpt.com:444', 'https://claude.ai']) {
    const provider = new WebSessionProvider({ service: 'chatgpt', token, endpointUrl });
    const response = await provider.generate([]);
    assert.equal(response.text.includes(token.slice(0, 10)), false);
  }
  assert.equal(calls, 0);
  const preview = new WebSessionProvider({ service: 'chatgpt', token });
  const chunks: string[] = [];
  await preview.stream([], c => chunks.push(c));
  assert.equal(chunks.join('').includes(token.slice(0, 10)), false);
});

test('credential requests use approved service origins and refuse redirects; redact responses and errors', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let calls = 0;
  globalThis.fetch = (async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(init?.redirect, 'error');
    assert.equal(url.searchParams.has('key'), false);
    assert.ok(['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', 'chatgpt.com'].includes(url.hostname));
    const headers = init?.headers as Record<string, string>;
    assert.ok(Object.values(headers).some(v => v.includes(token)));
    return new Response(JSON.stringify({ text: token, choices: [{ message: { content: token } }],
      content: [{ text: token }], candidates: [{ content: { parts: [{ text: token }] } }] }), { status: 200 });
  }) as typeof fetch;
  const providers = [new OpenAIProvider({ apiKey: token }), new GeminiProvider({ apiKey: token }),
    new AnthropicProvider({ apiKey: token }),
    new WebSessionProvider({ service: 'chatgpt', token, endpointUrl: 'https://chatgpt.com/backend-api/conversation' })];
  for (const provider of providers) {
    const chunks: string[] = [];
    const result = await provider.stream([{ role: 'user', content: 'hello' }], c => chunks.push(c));
    assert.equal(JSON.stringify([result, chunks]).includes(token.slice(0, 10)), false);
  }
  assert.equal(calls, 4);
  globalThis.fetch = (async () => { throw new Error(token); }) as typeof fetch;
  for (const provider of providers) assert.equal((await provider.generate([])).text.includes(token.slice(0, 10)), false);
  let unapprovedCalls = 0;
  globalThis.fetch = (async () => { unapprovedCalls++; throw new Error(); }) as typeof fetch;
  await new OpenAIProvider({ apiKey: token, baseURL: 'https://evil.test' }).generate([]);
  assert.equal(unapprovedCalls, 0);
});

test('decoded tool arguments cannot reconstruct credentials, and ordinary tool calls still work', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const escaped = [...token].map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
  globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: {
    content: 'normal response', tool_calls: [{ id: '1', function: { name: 'test',
      arguments: `{"secret":"${escaped}","ordinary":123}` } }],
  } }] }))) as typeof fetch;
  const result = await new OpenAIProvider({ apiKey: token }).generate([]);
  assert.equal(result.text, 'normal response');
  assert.equal(result.toolCalls?.[0].arguments.ordinary, 123);
  assert.equal(JSON.stringify(result).includes(token.slice(0, 10)), false);
});

test('each service sends only its own credential; HTTP failures never enter chunks or console logs', async t => {
  const cases = [
    { origin: 'https://api.openai.com', header: 'Authorization', value: 'Bearer FAKE-OPENAI-ONLY-KEY',
      secret: 'FAKE-OPENAI-ONLY-KEY', provider: new OpenAIProvider({ apiKey: 'FAKE-OPENAI-ONLY-KEY', baseURL: 'https://api.openai.com/v1' }) },
    { origin: 'https://api.anthropic.com', header: 'x-api-key', value: 'FAKE-ANTHROPIC-ONLY-KEY',
      secret: 'FAKE-ANTHROPIC-ONLY-KEY', provider: new AnthropicProvider({ apiKey: 'FAKE-ANTHROPIC-ONLY-KEY' }) },
    { origin: 'https://generativelanguage.googleapis.com', header: 'x-goog-api-key', value: 'FAKE-GEMINI-ONLY-KEY',
      secret: 'FAKE-GEMINI-ONLY-KEY', provider: new GeminiProvider({ apiKey: 'FAKE-GEMINI-ONLY-KEY' }) },
    ...Object.entries({ chatgpt: 'https://chatgpt.com', claude: 'https://claude.ai',
      gemini: 'https://gemini.google.com', deepseek: 'https://chat.deepseek.com',
      copilot: 'https://copilot.microsoft.com' }).map(([service, origin]) => {
        const secret = `FAKE-${service.toUpperCase()}-ONLY-SESSION`;
        return { origin, header: 'Authorization', value: `Bearer ${secret}`, secret,
          provider: new WebSessionProvider({ service: service as any, token: secret, endpointUrl: `${origin}/test-only` }) };
      }),
  ];
  const logs: unknown[] = [];
  for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const)
    t.mock.method(console, method, (...args) => { logs.push(args); });
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  for (const item of cases) {
    let calls = 0;
    globalThis.fetch = (async (input, init) => {
      calls++;
      assert.equal(new URL(String(input)).origin, item.origin);
      assert.equal(String(input).includes(item.secret), false);
      assert.equal(String(init?.body).includes(item.secret), false);
      assert.equal(init?.redirect, 'error');
      const headers = new Headers(init?.headers);
      assert.equal(headers.get(item.header), item.value);
      const serialized = JSON.stringify([...headers]);
      for (const other of cases) if (other !== item) assert.equal(serialized.includes(other.secret), false);
      return new Response(JSON.stringify({ error: item.secret }), { status: 401 });
    }) as typeof fetch;
    const chunks: string[] = [];
    const result = await item.provider.stream([], chunk => chunks.push(chunk));
    assert.equal(calls, 1, 'a failed request must not retry through another service');
    for (const other of cases) assert.equal(JSON.stringify([result, chunks, logs]).includes(other.secret.slice(0, 10)), false);
  }
});

test('Ollama remains usable locally without forwarding an ambient OpenAI credential', async t => {
  const original = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  t.after(() => {
    globalThis.fetch = original;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  });
  process.env.OPENAI_API_KEY = token;
  let called = 0;
  globalThis.fetch = (async (input, init) => {
    called++;
    assert.ok(['localhost', '192.168.1.5'].includes(new URL(String(input)).hostname));
    assert.equal((init?.headers as Record<string, string>).Authorization, undefined);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'local result' } }] }));
  }) as typeof fetch;
  assert.equal((await new OllamaProvider().generate([])).text, 'local result');
  assert.equal((await new OllamaProvider({ baseURL: 'http://192.168.1.5:11434/v1' }).generate([])).text, 'local result');
  assert.equal(called, 2);
});

test('an explicit environment API key does not require opening encrypted session storage', t => {
  const { dir } = fixture(t);
  const oldCwd = process.cwd();
  process.chdir(dir);
  const original = CredentialStore.prototype.get;
  const oldKey = process.env.GEMINI_API_KEY;
  t.after(() => {
    process.chdir(oldCwd);
    CredentialStore.prototype.get = original;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  });
  process.env.GEMINI_API_KEY = token;
  CredentialStore.prototype.get = () => { throw new Error('store locked'); };
  try {
    assert.equal(createProvider({ provider: 'gemini' }).name, 'gemini');
  } finally {
    // Leave the folder before the fixture deletes it: Windows cannot remove the current directory.
    process.chdir(oldCwd);
  }
});

test('preview forgetting closes tabs and clears shared cookies/storage/cache; blocks concurrent actions', async () => {
  const events: string[] = [];
  const stub = {
    fromPartition(partition: string) {
      assert.equal(partition, 'persist:superai-preview');
      return {
        closeAllConnections: async () => { events.push('connections'); },
        clearStorageData: async () => { events.push('storage'); },
        clearCache: async () => { events.push('cache'); },
        flushStorageData: () => { events.push('flush'); },
      };
    },
  };
  // Execute the actual controller with Electron replaced by an in-memory test double.
  (globalThis as any).__previewSessionTest = stub;
  try {
    const source = fs.readFileSync(new URL('../../desktop/browser.mjs', import.meta.url), 'utf8')
      .replace('import { WebContentsView, session } from "electron";',
        'const WebContentsView = null; const session = globalThis.__previewSessionTest;')
      .replace('"./browser-url.mjs"', JSON.stringify(new URL('../../desktop/browser-url.mjs', import.meta.url).href))
      .replace("'./i18n.mjs'", JSON.stringify(new URL('../../desktop/i18n.mjs', import.meta.url).href));
    const { BrowserController } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const controller = new BrowserController({ on() {}, isDestroyed: () => false,
      webContents: { send: () => events.push('emit') } });
    controller.tabs.set('one', { view: { webContents: { isDestroyed: () => false, close: () => events.push('close') } } });
    controller.activeId = 'one';
    const clearing = controller.forgetSession();
    await assert.rejects(controller.action('create', { url: 'https://example.com' }));
    await clearing;
    assert.deepEqual(events, ['close', 'connections', 'storage', 'cache', 'flush', 'emit']);
    assert.equal(controller.tabs.size, 0);
    assert.equal(controller.activeId, '');
    assert.equal(controller.forgetting, false);
    stub.fromPartition = () => ({
      closeAllConnections: async () => { throw new Error('mock failure'); },
    }) as any;
    await assert.rejects(controller.forgetSession(), /mock failure/);
    assert.equal(controller.forgetting, false);
  } finally { delete (globalThis as any).__previewSessionTest; }
});

test('API keys are saved encrypted, limited to known providers, and can be removed', t => {
  const { dir, store } = fixture(t);
  store.saveApi('openrouter', 'sk-or-secret-123');
  assert.equal(store.get('api', 'openrouter'), 'sk-or-secret-123');
  assert.ok(!fs.readFileSync(path.join(dir, 'credentials.enc'), 'utf8').includes('"api:openrouter":"sk-or-secret-123"'), 'the file is not plain JSON');
  assert.throws(() => store.saveApi('elsewhere', 'x'), /Unsupported/);
  assert.throws(() => store.saveApi('groq', 'two words'), /Invalid/);
  store.forgetApi('openrouter');
  assert.equal(store.get('api', 'openrouter'), undefined);
});

test('a key can still be saved when the old store was encrypted with another key', t => {
  const { dir } = fixture(t);
  new CredentialStore(dir, cipher()).saveSession('chatgpt', token);
  const store = new CredentialStore(dir, cipher());
  assert.throws(() => store.get('api', 'openrouter'), /Unable to read/, 'reading still fails closed');
  store.saveApi('openrouter', 'sk-or-new');
  assert.equal(store.get('api', 'openrouter'), 'sk-or-new');
  assert.equal(store.get('session', 'chatgpt'), undefined, 'nothing from the unreadable store is reused');
  assert.equal(fs.readdirSync(dir).filter(f => f.startsWith('credentials.enc.unreadable-')).length, 1, 'the old file is kept aside');
  const off = new CredentialStore(dir, { ...cipher(), isEncryptionAvailable: () => false });
  assert.throws(() => off.saveApi('groq', 'gsk'), /unavailable/, 'no encryption: nothing is moved or written');
  assert.equal(fs.readdirSync(dir).filter(f => f.startsWith('credentials.enc.unreadable-')).length, 1);
});

test('the store lives in the app data folder when one is set', () => {
  const before = process.env.SUPERAI_DATA_DIR;
  process.env.SUPERAI_DATA_DIR = path.join(os.tmpdir(), 'superai-data-x');
  try { assert.equal((new CredentialStore() as any).directory, process.env.SUPERAI_DATA_DIR); }
  finally { if (before === undefined) delete process.env.SUPERAI_DATA_DIR; else process.env.SUPERAI_DATA_DIR = before; }
});
