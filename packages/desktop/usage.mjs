// Anonymous usage ping: lets the download page show how many people are using the app.
// Sends a random per-install id, the app version and the OS. Nothing else: no account,
// no project or conversation data. Off until the person agrees (asked once on first launch, and
// changeable in Settings); the id is created only then and deleted when they say no.
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Set after deploying services/usage-counter (empty = nothing is ever sent).
export const USAGE_ENDPOINT = process.env.SUPERAI_USAGE_URL || "https://superai-usage.rakgorak.workers.dev";
const INTERVAL_MS = 10 * 60_000;

export class UsagePing {
  constructor({ dir, version, platform = process.platform, endpoint = USAGE_ENDPOINT, active = true, http = (...a) => fetch(...a) }) {
    this.file = path.join(dir, "usage.json");
    this.version = version;
    this.platform = platform;
    this.endpoint = endpoint.replace(/\/+$/, "");
    this.active = active && /^https:\/\//.test(this.endpoint);
    this.http = http;
    this.data = null;
    this.timer = null;
  }

  async load() {
    if (this.data) return this.data;
    let saved = {};
    try { saved = JSON.parse(await fs.readFile(this.file, "utf8")); } catch {}
    const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(saved?.id || "");
    // "yes" / "no" once answered. Files from before the question only say enabled: an explicit
    // false was a choice; anything else was never asked, so it is asked now.
    const choice = saved?.choice === "yes" || saved?.choice === "no" ? saved.choice : saved?.enabled === false ? "no" : null;
    this.data = { id: valid && choice !== "no" ? saved.id : null, choice };
    return this.data;
  }
  async save() {
    try { await fs.writeFile(this.file, JSON.stringify(this.data), { mode: 0o600 }); } catch {}
  }

  /** What the window shows: whether pings can be sent at all, the choice, and whether to ask. */
  async state() {
    const data = await this.load();
    return { available: this.active, enabled: data.choice === "yes", asked: data.choice !== null };
  }
  async setEnabled(enabled) {
    await this.load();
    this.data.choice = enabled ? "yes" : "no";
    this.data.id = enabled ? this.data.id || randomUUID() : null;
    await this.save();
    if (enabled) void this.send();
    return this.state();
  }

  async send() {
    const data = await this.load();
    if (!this.active || data.choice !== "yes" || !data.id) return false;
    try {
      const res = await this.http(`${this.endpoint}/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.id, os: this.platform, version: this.version }),
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
    } catch {
      return false; // offline: try again on the next tick
    }
  }

  start(delay = 15000) {
    if (!this.active || this.timer) return;
    setTimeout(() => void this.send(), delay).unref?.();
    this.timer = setInterval(() => void this.send(), INTERVAL_MS);
    this.timer.unref?.();
  }
}
