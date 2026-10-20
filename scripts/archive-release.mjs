import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
const manifest = JSON.parse(await fs.readFile('output/release-manifest.json', 'utf8'));
await fs.mkdir('release-assets', { recursive: true });
const archive = path.resolve('release-assets', manifest.label + '.zip');
if (process.platform === 'darwin') {
  execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', manifest.directory, archive], { stdio: 'inherit' });
} else {
  execFileSync('tar.exe', ['-a', '-c', '-f', archive, '-C', path.dirname(manifest.directory), path.basename(manifest.directory)], { stdio: 'inherit' });
}
const hash = createHash('sha256');
for await (const chunk of createReadStream(archive)) hash.update(chunk);
await fs.writeFile(archive + '.sha256', `${hash.digest('hex')}  ${path.basename(archive)}\n`);
console.log(archive);
