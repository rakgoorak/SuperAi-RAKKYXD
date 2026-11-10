import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { UsagePing } from "./usage.mjs";

test("usage ping sends only id, os and version, keeps one id, and obeys the off switch", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "superai-usage-"));
  try {
    const calls = [];
    const http = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response(null, { status: 204 }); };
    const make = (extra = {}) => new UsagePing({ dir, version: "1.2.3", platform: "win32", endpoint: "https://count.example/", http, ...extra });

    const first = make();
    assert.deepEqual(await first.state(), { available: true, enabled: true });
    assert.equal(await first.send(), true);
    assert.equal(calls[0].url, "https://count.example/ping");
    assert.deepEqual(Object.keys(calls[0].body).sort(), ["id", "os", "version"]);
    assert.match(calls[0].body.id, /^[0-9a-f-]{36}$/);

    // A restart keeps the same id, so one install is counted once.
    await make().send();
    assert.equal(calls[1].body.id, calls[0].body.id);

    // Turned off: nothing is sent, and the choice survives a restart.
    assert.equal((await first.setEnabled(false)).enabled, false);
    assert.equal(await first.send(), false);
    assert.equal(await make().send(), false);
    assert.equal(calls.length, 2);

    // No endpoint configured, a dev build, or a failing network never throws.
    assert.equal(await new UsagePing({ dir, version: "1.2.3", endpoint: "", http }).send(), false);
    assert.equal(await make({ active: false }).send(), false);
    await make().setEnabled(true);
    assert.equal(await make({ http: async () => { throw new Error("offline"); } }).send(), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
