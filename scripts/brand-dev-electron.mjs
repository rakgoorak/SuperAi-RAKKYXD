import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electron = require('electron');
const { default: rcedit } = await import('rcedit');

try {
  await rcedit(electron, {
    icon: path.resolve('packages/desktop/assets/icon.ico'),
    'version-string': {
      ProductName: 'SuperAi & RAKKYXD',
      FileDescription: 'SuperAi & RAKKYXD',
      CompanyName: 'RAKKYXD',
      OriginalFilename: 'SuperAi-RAKKYXD.exe',
    },
  });
  console.log('Successfully branded electron.exe with SuperAi icon!');
} catch (e) {
  console.log('BRAND_FAILED: ' + e.message);
}
