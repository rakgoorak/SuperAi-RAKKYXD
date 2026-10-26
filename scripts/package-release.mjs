import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { stageApp } from './stage-app.mjs';

const require = createRequire(import.meta.url);
const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
if (!['win32', 'darwin'].includes(process.platform)) throw new Error('Build release on Windows or macOS');
const platform = process.platform === 'win32' ? 'windows' : 'macos';
const arch = process.env.TARGET_ARCH || process.arch;
const label = `SuperAi-RAKKYXD-v${version}-${platform}-${arch}`;
const destination = path.resolve('release', label);
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.mkdir(destination); // Never overwrite a previous build.
let main;
if (process.platform === 'win32') {
  await fs.cp(path.dirname(require('electron')), destination, { recursive: true, filter: source => !source.endsWith('default_app.asar') });
  main = path.join(destination, 'SuperAi-RAKKYXD.exe');
  await fs.rename(path.join(destination, 'electron.exe'), main);
  // Brand the executable (icon + file details shown in Explorer and the taskbar).
  const { default: rcedit } = await import('rcedit');
  await rcedit(main, {
    icon: path.resolve('packages/desktop/assets/icon.ico'),
    'version-string': { ProductName: 'SuperAi & RAKKYXD', FileDescription: 'SuperAi & RAKKYXD', CompanyName: 'RAKKYXD', OriginalFilename: 'SuperAi-RAKKYXD.exe' },
    'file-version': version, 'product-version': version,
  });
  await stageApp(path.join(destination, 'resources', 'app'));
  const winCert = process.env.WIN_CERT_FILE || process.env.CSC_LINK;
  const winPass = process.env.WIN_CERT_PASSWORD || process.env.CSC_KEY_PASSWORD;
  const signtool = process.env.SIGNTOOL_PATH || 'signtool.exe';
  if (winCert) {
    console.log(`Signing executable ${main} with signtool...`);
    const args = ['sign', '/fd', 'SHA256', '/tr', 'http://timestamp.digicert.com', '/td', 'SHA256', '/f', winCert];
    if (winPass) args.push('/p', winPass);
    args.push(main);
    try {
      execFileSync(signtool, args, { stdio: 'inherit' });
      console.log('Signed Windows executable successfully.');
    } catch (e) {
      console.warn(`signtool signing failed: ${e.message}`);
    }
  } else {
    console.log('[Security Notice] Windows executable is unsigned. To prevent SmartScreen warnings, set WIN_CERT_FILE and WIN_CERT_PASSWORD.');
  }
} else {
  const { packager } = await import('@electron/packager');
  const staging = path.resolve('output', `release-stage-${Date.now()}`);
  // macOS wants .icns: build it from the 1024 px PNG with the system tools.
  const iconset = path.resolve('output', `icon-${Date.now()}.iconset`);
  await fs.mkdir(iconset, { recursive: true });
  for (const size of [16, 32, 128, 256, 512]) for (const scale of [1, 2]) {
    const px = size * scale, name = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`;
    execFileSync('sips', ['-z', String(px), String(px), path.resolve('packages/desktop/assets/icon.png'), '--out', path.join(iconset, name)], { stdio: 'ignore' });
  }
  const icns = iconset.replace(/\.iconset$/, '.icns');
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icns]);
  await stageApp(staging);
  for (const name of ['SuperAi-RAKKYXD']) {
    const [built] = await packager({ dir: staging, out: path.resolve('output', `mac-package-${name}-${Date.now()}`),
      name, executableName: name, platform: 'darwin', arch,
      electronVersion: require('electron/package.json').version, appVersion: version, prune: false, asar: false,
      appBundleId: 'com.rakgoorak.superai', icon: icns,
      extendInfo: { NSMicrophoneUsageDescription: 'โหมดเสียงของ SuperAi ใช้ไมโครโฟนเพื่อแปลงเสียงพูดเป็นข้อความบนเครื่องของคุณ' },
      darwinDarkModeSupport: true,
    });
    const app = path.join(destination, `${name}.app`);
    await fs.cp(path.join(built, `${name}.app`), app, { recursive: true, verbatimSymlinks: true });
    const identity = process.env.APPLE_SIGNING_IDENTITY || process.env.CSC_NAME;
    if (identity) {
      console.log(`Signing with Apple Developer Identity: ${identity}`);
      execFileSync('codesign', ['--force', '--deep', '--options', 'runtime', '--sign', identity, '--entitlements', path.resolve('scripts/entitlements.mac.plist'), app], { stdio: 'inherit' });
    } else {
      console.warn('[Security Warning] Signing with ad-hoc identity (-). On macOS 14/15, Gatekeeper will require security bypass unless signed with Apple Developer ID and notarized.');
      execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--entitlements', path.resolve('scripts/entitlements.mac.plist'), app], { stdio: 'inherit' });
    }
    const executable = path.join(app, 'Contents', 'MacOS', name);
    main = executable;
  }
}
await fs.copyFile('README.md', path.join(destination, 'README.md'));
await fs.copyFile('docs/DOWNLOADS.md', path.join(destination, 'INSTALL-TH.md'));
await fs.mkdir('output', { recursive: true });
const manifest = { directory: destination, main, platform, arch, version, label };
await fs.writeFile('output/release-manifest.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
