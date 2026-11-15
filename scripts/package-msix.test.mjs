import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareMsix, msixVersion } from './package-msix.mjs';

const identity = JSON.parse(await fs.readFile(new URL('../installer/windows/store-identity.json', import.meta.url), 'utf8'));
const assets = path.resolve('installer/windows/store-assets');

test('Store versions reject prereleases, overflow, and a reserved fourth component', () => {
  assert.equal(msixVersion('1.0.33'), '1.0.33.0');
  for (const version of ['1.0.33-beta', '1.0.33.1', '0.1.0', '1.65536.0', '1.2'])
    assert.throws(() => msixVersion(version));
});

test('MSIX staging preserves the original release and rejects mismatched payloads', async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-msix-'));
  try {
    const directory = path.join(work, 'release');
    const app = path.join(directory, 'resources', 'app');
    await fs.mkdir(app, { recursive: true });
    const metadata = { name: 'superai', version: '1.0.33', main: 'bootstrap.mjs' };
    await fs.writeFile(path.join(app, 'package.json'), JSON.stringify(metadata));
    await fs.writeFile(path.join(app, 'bootstrap.mjs'), '// fixture');
    const pe = Buffer.alloc(134);
    pe.write('MZ'); pe.writeUInt32LE(128, 60); pe.writeUInt32LE(0x4550, 128); pe.writeUInt16LE(0x8664, 132);
    await fs.writeFile(path.join(directory, 'SuperAi-RAKKYXD.exe'), pe);
    const release = { directory, platform: 'windows', arch: 'x64', version: '1.0.33' };
    const destination = path.join(work, 'staged');
    await prepareMsix({ release, destination, identity, assets });
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(app, 'package.json'))), metadata);
    const staged = JSON.parse(await fs.readFile(path.join(destination, 'resources', 'app', 'package.json')));
    assert.equal(staged.distribution, 'microsoft-store');
    assert.equal(staged.main, metadata.main);
    const manifest = await fs.readFile(path.join(destination, 'AppxManifest.xml'), 'utf8');
    assert.ok(manifest.includes(`Name="${identity.name}" Publisher="${identity.publisher}"`));
    assert.match(manifest, /SuperAi&amp;RAKKYXD/);
    assert.match(manifest, /Name="runFullTrust"/);
    for (const file of ['StoreLogo.png', 'Square44x44Logo.png', 'Square150x150Logo.png'])
      await fs.access(path.join(destination, 'Assets', file));
    assert.deepEqual(await fs.readFile(path.join(destination, 'SuperAi-RAKKYXD.exe')), pe);
    await assert.rejects(prepareMsix({ release, destination, identity, assets }), /EEXIST/);
    for (const [change, message] of [
      [{ platform: 'macos' }, /Windows release/],
      [{ arch: 'arm64' }, /architecture/],
      [{ version: '1.0.34' }, /version does not match/],
    ]) {
      const rejected = path.join(work, 'rejected');
      await assert.rejects(prepareMsix({ release: { ...release, ...change }, destination: rejected, identity, assets }), message);
      await assert.rejects(fs.access(rejected), /ENOENT/);
    }
  } finally { await fs.rm(work, { recursive: true, force: true }); }
});
