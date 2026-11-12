// End-to-end speak-to-type: a synthesized WAV is fed to Chromium as the microphone,
// on-device Whisper transcribes it into the composer, and nothing is sent.
// Downloads the Whisper Base model (~135 MB) on first run; set
// SUPERAI_VOICE_TEST_DATA to a fixed folder to keep it cached.
import { _electron as electron } from "playwright-core";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";

if (process.platform !== "win32") {
  console.log(JSON.stringify({ skipped: "speak-to-type smoke synthesizes its input with Windows speech" }));
  process.exit(0);
}
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "../../..");

const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "superai-voice-smoke-"));
const data = process.env.SUPERAI_VOICE_TEST_DATA || path.join(scratch, "data");
const project = path.join(scratch, "project");
await fs.mkdir(project, { recursive: true });

// Speech followed by silence so end-of-utterance detection fires before the file loops.
const raw = path.join(scratch, "speech.wav");
execFileSync("powershell.exe", ["-NoProfile", "-Command",
  "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile($env:SUPERAI_WAV); $s.Speak('Please build a landing page for my coffee shop.'); $s.Dispose()"],
  { env: { SUPERAI_LANG: 'th', ...process.env, SUPERAI_WAV: raw }, windowsHide: true });
const wav = path.join(scratch, "mic.wav");
await fs.writeFile(wav, withSilence(await fs.readFile(raw), 3));

const requests = [];
const model = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/tags") return res.end(JSON.stringify({ models: [{ name: "voice-test" }] }));
    requests.push(JSON.parse(body));
    res.end(JSON.stringify({ choices: [{ message: { content: "unexpected" } }] }));
  });
});
await new Promise((r) => model.listen(0, "127.0.0.1", r));

const app = await electron.launch({
  executablePath: require("electron"),
  args: [path.join(root, "packages/desktop"), "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`],
  env: { SUPERAI_LANG: 'th', ...process.env, SUPERAI_DATA_DIR: data, SUPERAI_OLLAMA_URL: `http://127.0.0.1:${model.address().port}` },
  timeout: 60000,
});
const passed = [];
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForSelector(".app-shell");
  await page.evaluate(async (rootPath) => {
    localStorage.setItem("superai-setup-dismissed", "1");
    localStorage.setItem("superai-model", "voice-test");
    localStorage.setItem("superai-voice-settings", JSON.stringify({ model: "base", language: "en" }));
    const r = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Voice", rootPath }) });
    if (!r.ok) throw new Error(await r.text());
  }, project);
  await page.reload();
  await page.waitForSelector(".app-shell");
  await page.getByRole("navigation", { name: "โหมดทำงาน" }).getByRole("button", { name: "Chat", exact: true }).click();
  // Speak-to-type: click, speak, click again; text lands in the composer unsent.
  const composer = page.getByRole("combobox", { name: "คำสั่ง", exact: true });
  await composer.fill("Note:");
  const mic = page.getByRole("button", { name: /กดค้างเพื่ออัดเสียง/ });
  await mic.click();
  const confirm = page.getByRole("dialog", { name: "ดาวน์โหลดโมเดลแปลงเสียง" });
  if (await confirm.isVisible().catch(() => false)) await confirm.getByRole("button", { name: "ดาวน์โหลด" }).click();
  const stop = page.getByRole("button", { name: /กำลังฟัง/ });
  await stop.waitFor({ timeout: 300000 });
  await page.waitForTimeout(5500);
  await stop.click();
  await page.waitForFunction(() => /coffee shop/i.test(document.querySelector('textarea[aria-label="คำสั่ง"]').value), null, { timeout: 120000 });
  assert.match(await composer.inputValue(), /^Note: .*coffee shop/i);
  assert.equal(requests.length, 0, "dictation must not send anything");
  passed.push(`tap to start, tap to stop: ${await composer.inputValue()}`);
  // Press and hold: recording ends when the button is released.
  await composer.fill("");
  await page.getByRole("button", { name: /กดค้างเพื่ออัดเสียง/ }).waitFor();
  const box = await mic.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await stop.waitFor({ timeout: 60000 });
  await page.waitForTimeout(5500);
  await page.mouse.up();
  await page.waitForFunction(() => /coffee shop/i.test(document.querySelector('textarea[aria-label="คำสั่ง"]').value), null, { timeout: 120000 });
  assert.equal(requests.length, 0);
  passed.push(`press and hold: ${await composer.inputValue()}`);
  // Right-click opens microphone and language settings.
  await mic.click({ button: "right" });
  const micMenu = page.getByRole("menu", { name: "ตั้งค่าไมโครโฟน" });
  await micMenu.getByRole("menuitemradio", { name: /English/ }).waitFor();
  await micMenu.getByRole("menuitemradio", { name: /English/ }).click();
  await micMenu.waitFor({ state: "hidden" });
  passed.push("right-click microphone menu");
  await composer.fill("");
  assert.deepEqual(errors, []);
  passed.push("no renderer errors");
  console.log(JSON.stringify({ passed }, null, 1));
} finally {
  await app.close();
  model.close();
  await fs.rm(scratch, { recursive: true, force: true }).catch(() => {});
}

function withSilence(wavBytes, seconds) {
  const fmt = wavBytes.indexOf("fmt ");
  const channels = wavBytes.readUInt16LE(fmt + 10), rate = wavBytes.readUInt32LE(fmt + 12), bits = wavBytes.readUInt16LE(fmt + 22);
  const dataAt = wavBytes.indexOf("data");
  const pcm = wavBytes.subarray(dataAt + 8, dataAt + 8 + wavBytes.readUInt32LE(dataAt + 4));
  const silence = Buffer.alloc(Math.round(seconds * rate) * channels * (bits / 8));
  const lead = Buffer.alloc(Math.round(0.8 * rate) * channels * (bits / 8));
  const body = Buffer.concat([lead, pcm, silence]);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + body.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * channels * (bits / 8), 28); header.writeUInt16LE(channels * (bits / 8), 32); header.writeUInt16LE(bits, 34);
  header.write("data", 36); header.writeUInt32LE(body.length, 40);
  return Buffer.concat([header, body]);
}
