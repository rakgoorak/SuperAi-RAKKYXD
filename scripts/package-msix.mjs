import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const xml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);

export function msixVersion(version) {
  // Store submissions reserve the fourth component for Store use.
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('MSIX requires a stable major.minor.patch version');
  const parts = version.split('.').map(Number);
  if (!parts[0] || parts.some(n => n > 65535)) throw new Error('MSIX version components must be <= 65535 and major must be > 0');
  return [...parts, 0].join('.');
}

export function renderManifest(identity, version, arch) {
  if (!['x64', 'arm64'].includes(arch)) throw new Error(`Unsupported Store architecture: ${arch}`);
  return `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">
  <Identity Name="${xml(identity.name)}" Publisher="${xml(identity.publisher)}" Version="${msixVersion(version)}" ProcessorArchitecture="${arch}" />
  <Properties>
    <DisplayName>${xml(identity.displayName)}</DisplayName>
    <PublisherDisplayName>${xml(identity.publisherDisplayName)}</PublisherDisplayName>
    <Description>AI coding workspace with Thai language support</Description>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>
  <Resources><Resource Language="th-TH" /><Resource Language="en-US" /></Resources>
  <Dependencies><TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" /></Dependencies>
  <Applications>
    <Application Id="${xml(identity.applicationId)}" Executable="SuperAi-RAKKYXD.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="${xml(identity.displayName)}" Description="AI coding workspace with Thai language support"
        Square150x150Logo="Assets\\Square150x150Logo.png" Square44x44Logo="Assets\\Square44x44Logo.png" BackgroundColor="transparent" />
    </Application>
  </Applications>
  <Capabilities><rescap:Capability Name="runFullTrust" /></Capabilities>
</Package>
`;
}

export async function prepareMsix({ release, destination, identity, assets }) {
  if (release.platform !== 'windows') throw new Error('Build a Windows release first (npm run package:release on Windows)');
  const version = msixVersion(release.version);
  const manifest = renderManifest(identity, release.version, release.arch);
  const metadataPath = path.join(release.directory, 'resources', 'app', 'package.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  if (metadata.version !== release.version) throw new Error('Release metadata version does not match the staged app');
  const exe = await fs.open(path.join(release.directory, 'SuperAi-RAKKYXD.exe'), 'r');
  try {
    const dos = Buffer.alloc(64);
    await exe.read(dos, 0, 64, 0);
    if (dos.toString('ascii', 0, 2) !== 'MZ') throw new Error('Expected a Windows PE executable');
    const pe = Buffer.alloc(6);
    await exe.read(pe, 0, 6, dos.readUInt32LE(60));
    if (pe.readUInt32LE(0) !== 0x4550 || pe.readUInt16LE(4) !== ({ x64: 0x8664, arm64: 0xaa64 })[release.arch])
      throw new Error('Executable architecture does not match the MSIX manifest');
  } finally { await exe.close(); }
  await fs.mkdir(destination); // Never overwrite an existing staging directory.
  await fs.cp(release.directory, destination, { recursive: true, verbatimSymlinks: true });
  await fs.writeFile(path.join(destination, 'resources', 'app', 'package.json'), JSON.stringify({ ...metadata, distribution: 'microsoft-store' }, null, 2) + '\n');
  await fs.cp(assets, path.join(destination, 'Assets'), { recursive: true });
  await fs.writeFile(path.join(destination, 'AppxManifest.xml'), manifest);
  return version;
}

async function makeAppxPath() {
  if (process.env.MAKEAPPX_PATH) return process.env.MAKEAPPX_PATH;
  const sdk = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin');
  const versions = (await fs.readdir(sdk)).filter(v => /^10\.\d+\.\d+\.\d+$/.test(v)).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
  for (const version of versions) {
    const tool = path.join(sdk, version, 'x64', 'makeappx.exe');
    try { await fs.access(tool); return tool; } catch {}
  }
  throw new Error('Install Windows SDK or set MAKEAPPX_PATH to makeappx.exe');
}

async function main() {
  if (process.platform !== 'win32') throw new Error('Create the MSIX on Windows with Windows SDK installed');
  const release = JSON.parse(await fs.readFile(path.join(root, 'output', 'release-manifest.json'), 'utf8'));
  const identity = JSON.parse(await fs.readFile(path.join(root, 'installer', 'windows', 'store-identity.json'), 'utf8'));
  const tool = await makeAppxPath();
  const parent = path.join(root, 'output', 'msix');
  await fs.mkdir(parent, { recursive: true });
  const destination = path.join(parent, `${release.version}-${release.arch}-${Date.now()}`);
  const version = await prepareMsix({ release, destination, identity, assets: path.join(root, 'installer', 'windows', 'store-assets') });
  const out = path.join(root, 'store-assets');
  await fs.mkdir(out, { recursive: true });
  const artifact = path.join(out, `SuperAi-RAKKYXD-${version}-${release.arch}.msix`);
  // Keep MakeAppx schema and content validation enabled; no /nv or /o.
  execFileSync(tool, ['pack', '/d', destination, '/p', artifact], { stdio: 'inherit' });
  console.log(`Store submission package (unsigned): ${artifact}`);
  console.log(`For local testing with Developer Mode: Add-AppxPackage -Register "${path.join(destination, 'AppxManifest.xml')}"`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
