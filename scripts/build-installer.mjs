// Build the end-user installer from the packaged app (run after package:release):
//   Windows -> release-assets/SuperAi-RAKKYXD-Setup.exe   (NSIS: pick folder, desktop shortcut, uninstaller)
//   macOS   -> release-assets/SuperAi-RAKKYXD-macos-<arch>.dmg (drag the app to Applications)
// Names carry no version so /releases/latest/download/<name> always serves the newest build.
import fs from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(await fs.readFile('output/release-manifest.json', 'utf8'));
await fs.mkdir('release-assets', { recursive: true });

async function checksum(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  await fs.writeFile(file + '.sha256', `${hash.digest('hex')}  ${path.basename(file)}\n`);
}

function makensis() {
  const candidates = [
    ...(process.env.PATH || '').split(path.delimiter).map((dir) => path.join(dir, 'makensis.exe')),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'NSIS', 'makensis.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'NSIS', 'makensis.exe'),
  ];
  const found = candidates.find((file) => existsSync(file));
  if (!found) throw new Error('NSIS (makensis) is required: winget install NSIS.NSIS');
  return found;
}

let output;
if (process.platform === 'win32') {
  output = path.resolve('release-assets', 'SuperAi-RAKKYXD-Setup.exe');
  execFileSync(makensis(), [
    '/V2', '/INPUTCHARSET', 'UTF8',
    `/DVERSION=${manifest.version}`,
    `/DSRCDIR=${manifest.directory}`,
    `/DOUTFILE=${output}`,
    `/DICON=${path.resolve('packages/desktop/assets/icon.ico')}`,
    path.resolve('installer/windows/installer.nsi'),
  ], { stdio: 'inherit' });
  const winCert = process.env.WIN_CERT_FILE || process.env.CSC_LINK;
  const winPass = process.env.WIN_CERT_PASSWORD || process.env.CSC_KEY_PASSWORD;
  const signtool = process.env.SIGNTOOL_PATH || 'signtool.exe';
  if (winCert) {
    console.log(`Signing setup installer ${output} with signtool...`);
    const args = ['sign', '/fd', 'SHA256', '/tr', 'http://timestamp.digicert.com', '/td', 'SHA256', '/f', winCert];
    if (winPass) args.push('/p', winPass);
    args.push(output);
    try {
      execFileSync(signtool, args, { stdio: 'inherit' });
      console.log('Signed setup installer successfully.');
    } catch (e) {
      console.warn(`signtool signing setup failed: ${e.message}`);
    }
  } else {
    console.log('[Security Notice] SuperAi-RAKKYXD-Setup.exe is unsigned. Set WIN_CERT_FILE and WIN_CERT_PASSWORD to sign.');
  }
} else if (process.platform === 'darwin') {
  output = path.resolve('release-assets', `SuperAi-RAKKYXD-macos-${manifest.arch}.dmg`);
  const app = (await fs.readdir(manifest.directory)).find((name) => name.endsWith('.app'));
  if (!app) throw new Error('No .app in the packaged release');
  await fs.rm(output, { force: true });
  // Branded window: app on the left, arrow, Applications on the right (appdmg writes the
  // Finder layout itself, so no AppleScript/GUI session is needed on CI).
  const spec = path.resolve('output', `dmg-${Date.now()}.json`);
  await fs.writeFile(spec, JSON.stringify({
    title: 'SuperAi & RAKKYXD',
    background: path.resolve('installer/macos/dmg-background.png'),
    'icon-size': 112,
    window: { size: { width: 660, height: 400 } },
    format: 'UDZO',
    contents: [
      { x: 180, y: 190, type: 'file', path: path.join(manifest.directory, app) },
      { x: 480, y: 190, type: 'link', path: '/Applications' },
    ],
  }, null, 2));
  try {
    execFileSync('npx', ['--yes', 'appdmg@0.6.6', spec, output], { stdio: 'inherit' });
  } catch (error) {
    // Fall back to a plain disk image (app + Applications link) rather than failing the release.
    console.warn(`appdmg failed (${error.message}); building a plain disk image`);
    const staging = path.resolve('output', `dmg-${Date.now()}`);
    await fs.mkdir(staging, { recursive: true });
    execFileSync('ditto', [path.join(manifest.directory, app), path.join(staging, app)]);
    await fs.symlink('/Applications', path.join(staging, 'Applications'));
    for (let attempt = 1; ; attempt++) {
      try {
        execFileSync('hdiutil', ['create', '-volname', 'SuperAi & RAKKYXD', '-srcfolder', staging, '-fs', 'HFS+', '-format', 'UDZO', '-ov', output], { stdio: 'inherit' });
        break;
      } catch (hdiError) {
        if (attempt >= 4) throw hdiError;
        await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
      }
    }
  }

  // Notarize and staple if Apple credentials provided
  const appleId = process.env.APPLE_ID;
  const applePass = process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  const keychainProfile = process.env.APPLE_KEYCHAIN_PROFILE;
  if (keychainProfile || (appleId && applePass && teamId)) {
    console.log('Submitting DMG to Apple for Notarization...');
    const notaryArgs = ['notarytool', 'submit', output, '--wait'];
    if (keychainProfile) {
      notaryArgs.push('--keychain-profile', keychainProfile);
    } else {
      notaryArgs.push('--apple-id', appleId, '--password', applePass, '--team-id', teamId);
    }
    try {
      execFileSync('xcrun', notaryArgs, { stdio: 'inherit' });
      console.log('Notarization succeeded! Stapling ticket to DMG...');
      execFileSync('xcrun', ['stapler', 'staple', output], { stdio: 'inherit' });
      console.log('DMG stapled successfully.');
    } catch (notaryError) {
      console.warn(`Notarization failed: ${notaryError.message}`);
    }
  } else {
    console.log('[Security Notice] DMG is not notarized. On macOS 14/15, Gatekeeper will require security bypass.');
    console.log('To notarize, set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID.');
  }
} else {
  throw new Error('Build installers on Windows or macOS');
}
await checksum(output);
console.log(output);
