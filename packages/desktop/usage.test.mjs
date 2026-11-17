import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { UsagePing } from "./usage.mjs";

const setup = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "superai-usage-"));
  const calls = [];
  const http = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response(null, { status: 204 }); };
  const make = (extra = {}) => new UsagePing({ dir, version: "1.2.3", platform: "win32", endpoint: "https://count.example/", http, ...extra });
  return { dir, calls, http, make, saved: async () => JSON.parse(await fs.readFile(path.join(dir, "usage.json"), "utf8")) };
};

test("usage ping sends nothing and keeps no id until the person agrees", async () => {
  const { dir, calls, make } = await setup();
  try {
    const first = make();
    assert.deepEqual(await first.state(), { available: true, enabled: false, asked: false });
    assert.equal(await first.send(), false);
    assert.equal(calls.length, 0);
    await assert.rejects(fs.readFile(path.join(dir, "usage.json")), "no id is stored before the answer");
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test("after yes it sends only id, os and version, keeps one id, and obeys a later no", async () => {
  const { dir, calls, http, make, saved } = await setup();
  try {
    const first = make();
    assert.deepEqual(await first.setEnabled(true), { available: true, enabled: true, asked: true });
    assert.equal(await first.send(), true);
    assert.equal(calls.at(-1).url, "https://count.example/ping");
    assert.deepEqual(Object.keys(calls.at(-1).body).sort(), ["id", "os", "version"]);
    assert.match(calls.at(-1).body.id, /^[0-9a-f-]{36}$/);
    const id = calls.at(-1).body.id;

    // A restart keeps the same id, so one install is counted once.
    await make().send();
    assert.equal(calls.at(-1).body.id, id);

    // No: nothing is sent, the id is deleted, and the choice survives a restart.
    const sent = calls.length;
    assert.deepEqual(await first.setEnabled(false), { available: true, enabled: false, asked: true });
    assert.equal(await first.send(), false);
    assert.equal(await make().send(), false);
    assert.equal(calls.length, sent);
    assert.equal((await saved()).id, null);

    // No endpoint configured, a dev build, or a failing network never throws.
    assert.equal(await new UsagePing({ dir, version: "1.2.3", endpoint: "", http }).send(), false);
    await make().setEnabled(true);
    assert.equal(await make({ active: false }).send(), false);
    assert.equal(await make({ http: async () => { throw new Error("offline"); } }).send(), false);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test("installs from before the question are asked, except those that had turned it off", async () => {
  const { dir, make } = await setup();
  try {
    const file = path.join(dir, "usage.json");
    await fs.writeFile(file, JSON.stringify({ id: "0b1e2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", enabled: true }));
    assert.deepEqual(await make().state(), { available: true, enabled: false, asked: false });
    assert.equal(await make().send(), false);
    await fs.writeFile(file, JSON.stringify({ id: "0b1e2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", enabled: false }));
    assert.deepEqual(await make().state(), { available: true, enabled: false, asked: true });
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
