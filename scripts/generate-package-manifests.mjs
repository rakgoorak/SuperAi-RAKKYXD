// Regenerate winget and Homebrew cask manifests from the latest public release.
// Usage: npm run manifests:update
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO = 'rakgoorak/SuperAi-RAKKYXD-releases';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'superai-manifest-updater' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const response = await fetch(API, { headers });
if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
const release = await response.json();
const version = String(release.tag_name).replace(/^v/, '');
const assets = new Map(release.assets.map((asset) => [asset.name, asset]));

const required = {
  windows: 'SuperAi-RAKKYXD-Setup.exe',
  macArm: 'SuperAi-RAKKYXD-macos-arm64.dmg',
  macIntel: 'SuperAi-RAKKYXD-macos-x64.dmg',
};
for (const [key, name] of Object.entries(required)) {
  if (!assets.has(name)) throw new Error(`Missing asset ${name} in ${release.tag_name} (${key})`);
}

async function sha256(name) {
  const checksum = assets.get(`${name}.sha256`);
  if (checksum) {
    const text = await (await fetch(checksum.browser_download_url, { headers })).text();
    const match = text.trim().match(/^([a-f0-9]{64})/i);
    if (match) return match[1].toLowerCase();
  }
  const digest = assets.get(name)?.digest;
  if (digest?.startsWith('sha256:')) return digest.slice(7);
  throw new Error(`No SHA-256 available for ${name}`);
}

const [winHash, armHash, intelHash] = await Promise.all([
  sha256(required.windows),
  sha256(required.macArm),
  sha256(required.macIntel),
]);

const download = (name) => `https://github.com/${REPO}/releases/download/v${version}/${name}`;
const sourceUrl = 'https://github.com/rakgoorak/SuperAi-RAKKYXD';

const winget = `# yaml-language-server: $schema=https://aka.ms/winget-manifest.singleton.1.6.0.schema.json
PackageIdentifier: rakgoorak.SuperAiRAKKYXD
PackageVersion: ${version}
PackageLocale: en-US
Publisher: RAKKYXD
PublisherUrl: https://github.com/rakgoorak
PublisherSupportUrl: ${sourceUrl}/issues
Author: RAKKYXD
PackageName: SuperAi & RAKKYXD
PackageUrl: ${sourceUrl}
License: MIT
LicenseUrl: ${sourceUrl}/blob/main/LICENSE
Copyright: Copyright (c) 2026 RAKKYXD & SuperAi Contributors
ShortDescription: All your AI coding assistants in one local-first desktop workspace.
Description: Open-source desktop workspace for Claude Code, Codex, Antigravity, OpenCode, Freebuff, and local Ollama. Includes multi-agent teams, Git worktrees, artifact previews, voice dictation, and quota tracking. Runs locally with your own accounts.
Moniker: superai
Tags:
  - ai
  - claude
  - codex
  - developer-tools
  - electron
  - llm
  - ollama
  - opencode
ReleaseNotesUrl: https://github.com/${REPO}/releases/tag/v${version}
Installers:
  - Architecture: x64
    InstallerType: nsis
    InstallerUrl: ${download(required.windows)}
    InstallerSha256: ${winHash.toUpperCase()}
    InstallerSwitches:
      Silent: /S
      SilentWithProgress: /S
ManifestType: singleton
ManifestVersion: 1.6.0
`;

const cask = `cask "superai-rakkyxd" do
  version "${version}"
  name "SuperAi & RAKKYXD"
  desc "Local-first desktop workspace for multiple AI coding assistants"
  homepage "${sourceUrl}"

  on_arm do
    sha256 "${armHash}"
    url "https://github.com/${REPO}/releases/download/v#{version}/SuperAi-RAKKYXD-macos-arm64.dmg",
        verified: "github.com/${REPO}/"
  end

  on_intel do
    sha256 "${intelHash}"
    url "https://github.com/${REPO}/releases/download/v#{version}/SuperAi-RAKKYXD-macos-x64.dmg",
        verified: "github.com/${REPO}/"
  end

  depends_on macos: ">= :big_sur"

  app "SuperAi-RAKKYXD.app"

  zap trash: [
    "~/.opencode-multi",
  ]
end
`;

await fs.mkdir(path.resolve('packaging/winget'), { recursive: true });
await fs.mkdir(path.resolve('packaging/homebrew/Casks'), { recursive: true });
await fs.writeFile(path.resolve('packaging/winget/rakgoorak.SuperAiRAKKYXD.yaml'), winget);
await fs.writeFile(path.resolve('packaging/homebrew/Casks/superai-rakkyxd.rb'), cask);
console.log(`Updated manifests for v${version}`);
console.log(`  packaging/winget/rakgoorak.SuperAiRAKKYXD.yaml`);
console.log(`  packaging/homebrew/Casks/superai-rakkyxd.rb`);
