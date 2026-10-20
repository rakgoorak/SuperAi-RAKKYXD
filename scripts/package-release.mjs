import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { stageApp } from './stage-app.mjs';

const require = createRequire(import.meta.url);
const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
if (!['win32', 'darwin'].includes(process.platform)) throw new Error('Build release on Windows or macOS');
const platform = process.platform === 'win32' ? 'windows' : 'macos';
const label = `SuperAi-RAKKYXD-v${version}-${platform}-${process.arch}`;
const destination = path.resolve('release', label);
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.mkdir(destination); // Never overwrite a previous build.
let main;
if (process.platform === 'win32') {
  await fs.cp(path.dirname(require('electron')), destination, { recursive: true, filter: source => !source.endsWith('default_app.asar') });
  main = path.join(destination, 'SuperAi-RAKKYXD.exe');
  await fs.rename(path.join(destination, 'electron.exe'), main);
  await stageApp(path.join(destination, 'resources', 'app'));
} else {
  const { packager } = await import('@electron/packager');
  const staging = path.resolve('output', `release-stage-${Date.now()}`);
  await stageApp(staging);
  for (const name of ['SuperAi-RAKKYXD']) {
    const [built] = await packager({ dir: staging, out: path.resolve('output', `mac-package-${name}-${Date.now()}`),
      name, executableName: name, platform: 'darwin', arch: process.arch,
      electronVersion: require('electron/package.json').version, appVersion: version, prune: false, asar: false,
      appBundleId: 'com.rakgoorak.superai',
      extendInfo: { NSMicrophoneUsageDescription: 'โหมดเสียงของ SuperAi ใช้ไมโครโฟนเพื่อแปลงเสียงพูดเป็นข้อความบนเครื่องของคุณ' },
      darwinDarkModeSupport: true,
    });
    const app = path.join(destination, `${name}.app`);
    await fs.cp(path.join(built, `${name}.app`), app, { recursive: true, verbatimSymlinks: true });
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--entitlements', path.resolve('scripts/entitlements.mac.plist'), app], { stdio: 'inherit' });
    const executable = path.join(app, 'Contents', 'MacOS', name);
    main = executable;
  }
}
await fs.copyFile('README.md', path.join(destination, 'README.md'));
await fs.copyFile('docs/DOWNLOADS.md', path.join(destination, 'INSTALL-TH.md'));
await fs.mkdir('output', { recursive: true });
const manifest = { directory: destination, main, platform, arch: process.arch, version, label };
await fs.writeFile('output/release-manifest.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
