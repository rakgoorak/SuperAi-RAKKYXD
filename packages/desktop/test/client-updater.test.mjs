import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ClientBundleUpdater } from "../client-updater.mjs";

test("ClientBundleUpdater: initial source is builtin when bundleDir has no index.html", async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "superai-client-test-"));
  try {
    const builtIn = path.join(tmp, "builtin-dist");
    await fsp.mkdir(builtIn, { recursive: true });
    await fsp.writeFile(path.join(builtIn, "index.html"), "<h1>Builtin</h1>");

    const updater = new ClientBundleUpdater({
      userDataDir: tmp,
      builtInDist: builtIn,
    });

    assert.equal(updater.state.activeSource, "builtin");
    assert.equal(updater.getActiveDist(), builtIn);
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
});

test("ClientBundleUpdater: applyLocalBundle switches activeDist to dynamic and can be reset", async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "superai-client-test-"));
  try {
    const builtIn = path.join(tmp, "builtin-dist");
    await fsp.mkdir(builtIn, { recursive: true });
    await fsp.writeFile(path.join(builtIn, "index.html"), "<h1>Builtin</h1>");

    const updater = new ClientBundleUpdater({
      userDataDir: tmp,
      builtInDist: builtIn,
    });

    const newDist = path.join(tmp, "staged-new-dist");
    await fsp.mkdir(newDist, { recursive: true });
    await fsp.writeFile(path.join(newDist, "index.html"), "<h1>New OTA UI</h1>");
    await fsp.writeFile(path.join(newDist, "app.js"), "console.log('updated');");

    const res = await updater.applyLocalBundle(newDist);
    assert.equal(res.status, "ready");
    assert.equal(updater.state.activeSource, "dynamic");
    assert.equal(updater.getActiveDist(), updater.bundleDir);

    const content = await fsp.readFile(path.join(updater.bundleDir, "index.html"), "utf8");
    assert.equal(content, "<h1>New OTA UI</h1>");

    // Reset to built-in
    const resetRes = await updater.resetToBuiltIn();
    assert.equal(resetRes.activeSource, "builtin");
    assert.equal(updater.getActiveDist(), builtIn);
    assert.equal(fs.existsSync(updater.bundleDir), false);
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
});

test("ClientBundleUpdater: check detects superai-client-dist.zip asset from mocked GitHub release", async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "superai-client-test-"));
  try {
    const builtIn = path.join(tmp, "builtin-dist");
    await fsp.mkdir(builtIn, { recursive: true });
    await fsp.writeFile(path.join(builtIn, "index.html"), "<h1>Builtin</h1>");

    const mockReleases = [
      {
        tag_name: "v1.2.5",
        published_at: "2026-11-18T14:00:00Z",
        assets: [
          {
            id: 101,
            name: "superai-client-dist.zip",
            size: 2500000,
            browser_download_url: "https://github.com/mock/superai-client-dist.zip",
            updated_at: "2026-11-18T14:05:00Z",
          },
          {
            id: 102,
            name: "superai-client-dist.zip.sha256",
            size: 100,
            browser_download_url: "https://github.com/mock/superai-client-dist.zip.sha256",
          },
        ],
      },
    ];

    const mockHttp = async () => ({
      ok: true,
      status: 200,
      json: async () => mockReleases,
    });

    const updater = new ClientBundleUpdater({
      userDataDir: tmp,
      builtInDist: builtIn,
      http: mockHttp,
    });

    const state = await updater.check();
    assert.equal(state.status, "available");
    assert.ok(state.candidate);
    assert.equal(state.candidate.zip.name, "superai-client-dist.zip");
    assert.equal(state.candidate.releaseTag, "v1.2.5");
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
});
