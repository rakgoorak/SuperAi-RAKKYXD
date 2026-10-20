// End-to-end voice mode: a synthesized WAV is fed to Chromium as the microphone,
// on-device Whisper transcribes it, a local fake model answers, and the reply is
// spoken through Windows speech. Downloads the Whisper Base model (~135 MB) on
// first run; set SUPERAI_VOICE_TEST_DATA to a fixed folder to keep it cached.
import { _electron as electron } from "playwright-core";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";

if (process.platform !== "win32") {
  console.log(JSON.stringify({ skipped: "voice smoke synthesizes its input with Windows speech" }));
  process.exit(0);
}
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "../../..");
const { SpeechService } = await import(pathToFileURL(path.join(root, "packages/studio/dist/SpeechService.js")).href);

const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "superai-voice-smoke-"));
const data = process.env.SUPERAI_VOICE_TEST_DATA || path.join(scratch, "data");
const project = path.join(scratch, "project");
await fs.mkdir(project, { recursive: true });

// Speech followed by silence so end-of-utterance detection fires before the file loops.
const spoken = await new SpeechService().synthesize("Please build a landing page for my coffee shop.", "en-US");
const wav = path.join(scratch, "mic.wav");
await fs.writeFile(wav, withSilence(spoken, 3));

const requests = [];
const model = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/tags") return res.end(JSON.stringify({ models: [{ name: "voice-test" }] }));
    requests.push(JSON.parse(body));
    res.end(JSON.stringify({ choices: [{ message: { content: "Sure. Your coffee shop landing page is ready." } }] }));
  });
});
await new Promise((r) => model.listen(0, "127.0.0.1", r));

const app = await electron.launch({
  executablePath: require("electron"),
  args: [path.join(root, "packages/desktop"), "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`],
  env: { ...process.env, SUPERAI_DATA_DIR: data, SUPERAI_OLLAMA_URL: `http://127.0.0.1:${model.address().port}` },
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
  await page.getByRole("button", { name: "สนทนา", exact: true }).click();
  await page.getByRole("button", { name: "โหมดเสียง", exact: true }).first().click();
  const voice = page.getByRole("dialog", { name: "โหมดเสียง" });
  await voice.waitFor();
  const download = voice.getByRole("button", { name: "ดาวน์โหลดและเริ่มคุย" });
  if (await download.isVisible().catch(() => false)) { await download.click(); passed.push("asks before downloading the speech model"); }
  await voice.locator(".voice-reply").waitFor({ timeout: 300000 });
  const heard = await voice.locator(".voice-you").textContent();
  assert.match(heard, /coffee shop/i);
  passed.push(`transcribed microphone: ${heard}`);
  assert.equal(requests.length >= 1, true);
  const messages = requests[0].messages;
  assert.match(messages.find((m) => m.role === "system").content, /อ่านออกเสียง/);
  assert.match(messages.at(-1).content, /coffee shop/i);
  passed.push("sent transcript to the chat model with the spoken-reply style");
  assert.match(await voice.locator(".voice-reply").textContent(), /landing page is ready/);
  await voice.getByText(/กำลังพูด/).waitFor({ timeout: 30000 });
  passed.push("spoke the reply");
  await voice.getByText("พูดได้เลย ฟังอยู่").waitFor({ timeout: 60000 });
  passed.push("returned to listening for the next turn");
  await voice.getByRole("button", { name: "ปิดไมค์" }).click();
  await voice.getByText(/ปิดไมค์อยู่/).waitFor();
  await page.keyboard.press("Escape");
  await voice.waitFor({ state: "hidden" });
  passed.push("mute and close");
  const runs = await page.evaluate(() => fetch(`/api/workspaces`).then((r) => r.json()).then((w) => fetch(`/api/conversations/${w[0].id}`)).then((r) => r.json()));
  assert.equal(runs[0].voice, true);
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
