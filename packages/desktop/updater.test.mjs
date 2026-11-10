import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Updater, compareVersions, pickAsset, parseChecksum, installTarget, windowsTar, updateKind } from "./updater.mjs";

test("versions compare numerically and pre-releases sort before releases", () => {
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("v1.0.0", "1.0"), 0);
  assert.equal(compareVersions("1.0.0-beta.1", "1.0.0"), -1);
  assert.equal(compareVersions("0.9.9", "1.0.0"), -1);
});

test("asset choice follows OS and CPU and pairs the checksum", () => {
  const assets = ["windows-x64", "macos-arm64", "macos-x64"].flatMap((l) => [
    { name: `SuperAi-RAKKYXD-v1.0.0-${l}.zip` }, { name: `SuperAi-RAKKYXD-v1.0.0-${l}.zip.sha256` },
  ]);
  assert.equal(pickAsset(assets, "win32", "x64").zip.name, "SuperAi-RAKKYXD-v1.0.0-windows-x64.zip");
  assert.equal(pickAsset(assets, "darwin", "arm64").sha.name, "SuperAi-RAKKYXD-v1.0.0-macos-arm64.zip.sha256");
  assert.equal(pickAsset(assets, "linux", "x64"), null);
  assert.equal(pickAsset(assets, "win32", "arm64"), null);
  const unversioned = [{ name: "SuperAi-RAKKYXD-windows-x64.zip" }, { name: "SuperAi-RAKKYXD-windows-x64.zip.sha256" }];
  assert.equal(pickAsset(unversioned, "win32", "x64").sha.name, "SuperAi-RAKKYXD-windows-x64.zip.sha256");
});

test("checksum lines and install targets are parsed safely", () => {
  const sum = "a".repeat(64);
  assert.equal(parseChecksum(`${sum}  App.zip\n`, "App.zip"), sum);
  assert.equal(parseChecksum(`${sum}  Other.zip`, "App.zip"), null);
  assert.equal(installTarget("/Applications/SuperAi-RAKKYXD.app/Contents/MacOS/SuperAi-RAKKYXD", "darwin"), "/Applications/SuperAi-RAKKYXD.app");
  assert.equal(installTarget(path.join("C:", "Apps", "SuperAi", "SuperAi-RAKKYXD.exe"), "win32"), path.join("C:", "Apps", "SuperAi"));
});

const release = (version, assets) => new Response(JSON.stringify({ tag_name: `v${version}`, body: "notes", html_url: "https://github.com/x/y/releases/tag/v" + version, assets }));

test("check reports available, latest and missing releases without downloading", async () => {
  const assets = [{ name: `SuperAi-RAKKYXD-v2.0.0-${process.platform === "win32" ? "windows" : "macos"}-${process.arch}.zip`, size: 10, browser_download_url: "https://github.com/a.zip" }];
  let u = new Updater({ currentVersion: "1.0.0", packaged: true, http: async () => release("2.0.0", assets) });
  assert.equal((await u.check()).status, "available");
  u = new Updater({ currentVersion: "2.0.0", packaged: true, http: async () => release("2.0.0", assets) });
  assert.equal((await u.check()).status, "latest");
  u = new Updater({ currentVersion: "1.0.0", packaged: true, http: async () => new Response("{}", { status: 404 }) });
  assert.equal((await u.check()).status, "none");
  u = new Updater({ currentVersion: "1.0.0", packaged: true, http: async () => { throw new Error("offline"); } });
  assert.match((await u.check()).error, /offline/);
});

async function fixtureZip(dir, version = "2.0.0") {
  const label = `SuperAi-RAKKYXD-v${version}-${process.platform === "win32" ? "windows" : "macos"}-${process.arch}`;
  const payload = path.join(dir, `src-${version}`, label);
  const appDir = process.platform === "darwin" ? path.join(payload, "SuperAi-RAKKYXD.app", "Contents", "Resources", "app") : path.join(payload, "resources", "app");
  await fs.mkdir(appDir, { recursive: true });
  await fs.writeFile(path.join(appDir, "package.json"), JSON.stringify({ version }));
  await fs.writeFile(path.join(payload, process.platform === "darwin" ? "SuperAi-RAKKYXD.app/Contents/Info.plist" : "SuperAi-RAKKYXD.exe"), "new");
  const zip = path.join(dir, `${label}.zip`);
  if (process.platform === "darwin") execFileSync("ditto", ["-c", "-k", "--keepParent", payload, zip]);
  else execFileSync(windowsTar(), ["-a", "-c", "-f", zip, "-C", path.dirname(payload), label]);
  const data = await fs.readFile(zip);
  return { name: path.basename(zip), data, sha: createHash("sha256").update(data).digest("hex") };
}

test("download verifies SHA-256, extracts the app and rejects tampered files", { skip: !["win32", "darwin"].includes(process.platform) }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "superai-updater-"));
  try {
    const zip = await fixtureZip(dir);
    const make = (sha) => async (url) => {
      const u = String(url);
      if (u.includes("api.github.com")) return release("2.0.0", [
        { name: zip.name, size: zip.data.length, browser_download_url: `https://github.com/r/releases/download/v2.0.0/${zip.name}` },
        { name: `${zip.name}.sha256`, browser_download_url: `https://github.com/r/releases/download/v2.0.0/${zip.name}.sha256` },
      ]);
      if (u.endsWith(".sha256")) return new Response(`${sha}  ${zip.name}\n`);
      return new Response(zip.data, { headers: { "content-length": String(zip.data.length) } });
    };
    const states = [];
    const ok = new Updater({ currentVersion: "1.0.0", packaged: true, http: make(zip.sha), tempDir: dir, onState: (s) => states.push(s.status) });
    await ok.check();
    const ready = await ok.download();
    assert.equal(ready.status, "ready", ready.error);
    assert.ok(states.includes("downloading") && states.includes("extracting"));
    assert.ok(ready.source.endsWith(process.platform === "darwin" ? ".app" : `${process.arch}`));

    const bad = new Updater({ currentVersion: "1.0.0", packaged: true, http: make("b".repeat(64)), tempDir: dir });
    await bad.check();
    const failed = await bad.download();
    assert.equal(failed.status, "error");
    assert.match(failed.error, /SHA-256/);

    // The release says 2.0.0 but the ZIP holds an older build: installing it would change nothing.
    const old = await fixtureZip(dir, "1.9.0");
    const staleHttp = async (url) => {
      const u = String(url);
      if (u.includes("api.github.com")) return release("2.0.0", [
        { name: old.name, size: old.data.length, browser_download_url: `https://github.com/r/releases/download/v2.0.0/${old.name}` },
        { name: `${old.name}.sha256`, browser_download_url: `https://github.com/r/releases/download/v2.0.0/${old.name}.sha256` },
      ]);
      if (u.endsWith(".sha256")) return new Response(`${old.sha}  ${old.name}\n`);
      return new Response(old.data, { headers: { "content-length": String(old.data.length) } });
    };
    const stale = new Updater({ currentVersion: "1.0.0", packaged: true, http: staleHttp, tempDir: dir });
    await stale.check();
    const refused = await stale.download();
    assert.equal(refused.status, "error");
    assert.match(refused.error, /v1\.9\.0/);

    const dev = new Updater({ currentVersion: "1.0.0", packaged: false, http: make(zip.sha), tempDir: dir });
    await dev.check();
    await assert.rejects(dev.download(), /โหมดพัฒนา/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("downloads only from GitHub hosts", async () => {
  const u = new Updater({ currentVersion: "1.0.0", packaged: true, http: async (url) => String(url).includes("api.github.com")
    ? release("2.0.0", [{ name: `x-${process.platform === "win32" ? "windows" : "macos"}-${process.arch}.zip`, browser_download_url: "https://evil.example/x.zip" }, { name: `x-${process.platform === "win32" ? "windows" : "macos"}-${process.arch}.zip.sha256`, browser_download_url: "https://evil.example/x.sha256" }])
    : new Response("") });
  await u.check();
  const state = await u.download();
  assert.equal(state.status, "error");
  assert.match(state.error, /GitHub/);
});

test("a hard update is detected even when a later soft release came after it", async () => {
  assert.equal(updateKind("Fixes\n<!-- superai-update: hard -->"), "hard");
  assert.equal(updateKind("Fixes"), "soft");
  const os = process.platform === "win32" ? "windows" : "macos";
  const rel = (v, body, extra = {}) => ({ tag_name: `v${v}`, body, html_url: "https://github.com/x", assets: [{ name: `S-${os}-${process.arch}.zip`, size: 1, browser_download_url: "https://github.com/a.zip" }], ...extra });
  const list = [rel("1.0.5", "soft"), rel("1.0.4", "<!-- superai-update: hard -->\nImportant"), rel("1.0.3", "old"), rel("1.0.9", "<!-- superai-update: hard -->", { prerelease: true })];
  const http = async () => new Response(JSON.stringify(list));
  let s = await new Updater({ currentVersion: "1.0.3", packaged: true, http }).check();
  assert.equal(s.latestVersion, "1.0.5");
  assert.equal(s.mandatory, true);
  s = await new Updater({ currentVersion: "1.0.4", packaged: true, http }).check();
  assert.equal(s.status, "available");
  assert.equal(s.mandatory, false);
  s = await new Updater({ currentVersion: "1.0.2", packaged: true, http: async () => new Response(JSON.stringify([rel("1.0.4", "<!-- superai-update: hard -->\nImportant")])) }).check();
  assert.equal(s.notes, "Important");
});

test("losing the connection keeps an update an earlier check found", async () => {
  let online = true;
  const os = process.platform === "win32" ? "windows" : "macos";
  const u = new Updater({ currentVersion: "1.0.0", packaged: true, http: async () => {
    if (!online) throw new Error("offline");
    return release("2.0.0", [{ name: `S-${os}-${process.arch}.zip`, size: 1, browser_download_url: "https://github.com/a.zip" }]);
  } });
  assert.equal((await u.check()).status, "available");
  online = false;
  assert.equal((await u.check()).status, "available");
});
