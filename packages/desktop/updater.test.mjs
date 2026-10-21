import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Updater, compareVersions, pickAsset, parseChecksum, installTarget, windowsTar } from "./updater.mjs";

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

async function fixtureZip(dir) {
  const label = `SuperAi-RAKKYXD-v2.0.0-${process.platform === "win32" ? "windows" : "macos"}-${process.arch}`;
  const payload = path.join(dir, "src", label);
  if (process.platform === "darwin") await fs.mkdir(path.join(payload, "SuperAi-RAKKYXD.app", "Contents"), { recursive: true });
  else await fs.mkdir(path.join(payload, "resources", "app"), { recursive: true });
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
