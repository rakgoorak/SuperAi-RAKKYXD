import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { normalizeThaiTech } from "./thai_normalizer.mjs";
const directory = path.dirname(fileURLToPath(import.meta.url));
export function validateAudio(value) {
  if (
    !(value instanceof Uint8Array) ||
    value.byteLength < 100 ||
    value.byteLength > 25 * 1024 * 1024
  )
    throw new Error("เสียงต้องมีขนาด 100 ไบต์ ถึง 25 MB");
  return Buffer.from(value);
}
export class VoiceService {
  child = null;
  daemon = null;
  daemonModel = null;
  daemonStarting = null;

  constructor(onProgress = () => {}, { spawnProcess = spawn, startupTimeout = 120000 } = {}) {
    this.spawnProcess = spawnProcess;
    this.startupTimeout = startupTimeout;
    this.cancelVersion = 0;
    this.onProgress = onProgress;
    this.python = process.env.SUPERAI_PYTHON || (process.platform === "win32" ? "python" : "python3");
    this.cache = path.join(os.homedir(), ".opencode-multi", "whisper-models");
    this.venvPython = path.join(this.cache, "runtime", "bin", "python");
    if (process.platform !== "win32" && !process.env.SUPERAI_PYTHON && existsSync(this.venvPython)) this.python = this.venvPython;
  }

  async ensureDaemon(model = "base") {
    if (this.daemon && this.daemonModel === model) return this.daemon;
    if (this.daemonStarting) return this.daemonStarting;

    const startVersion = this.cancelVersion;
    this.daemonStarting = (async () => {
      if (this.daemon) {
        try {
          this.daemon.stdin?.write(JSON.stringify({ action: "exit" }) + "\n");
          this.daemon.kill();
        } catch {}
        this.daemon = null;
      }

      await fs.mkdir(this.cache, { recursive: true });
      if (startVersion !== this.cancelVersion) throw new Error("ยกเลิกการประมวลผลแล้ว");

      return new Promise((resolve, reject) => {
        const child = this.spawnProcess(
          this.python,
          [
            path.join(directory, "whisper_worker.py"),
            "--model",
            model,
            "--cache",
            this.cache,
            "--daemon",
          ],
          {
            windowsHide: true,
            env: { ...process.env, PYTHONIOENCODING: "utf-8" },
          },
        );

        this.startingChild = child;
        let ready = false, settled = false, stderr = "";
        const fail = error => {
          if (settled) return;
          settled = true; clearTimeout(timer);
          if (this.startingChild === child) this.startingChild = null;
          try { child.kill(); } catch {}
          reject(error);
        };
        const timer = setTimeout(() => fail(new Error("เริ่มระบบเสียงไม่สำเร็จภายในเวลาที่กำหนด ตรวจ Python และดาวน์โหลดโมเดลในตั้งค่าระบบเสียง")), this.startupTimeout);
        let buffer = "";

        const onData = (data) => {
          buffer += data.toString("utf-8");
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.error) { fail(new Error(String(msg.error))); return; }
              if (msg.ready) {
                settled = true; clearTimeout(timer); this.startingChild = null;
                ready = true;
                this.daemon = child;
                this.daemonModel = model;
                child.stdout.removeListener("data", onData);
                resolve(child);
                return;
              }
            } catch {}
          }
        };

        child.stdout.on("data", onData);
        child.stderr.on("data", (b) => {
          stderr = (stderr + b.toString()).slice(-1500);
          this.onProgress(b.toString());
        });
        child.on("error", (e) => {
          if (!ready) fail(e);
        });
        child.on("close", () => {
          if (!ready) fail(new Error(stderr || "ระบบเสียงปิดก่อนพร้อมใช้งาน กรุณาติดตั้งระบบเสียงและดาวน์โหลดโมเดล"));
          if (this.daemon === child) {
            this.daemon = null;
            this.daemonModel = null;
          }
        });
      });
    })().finally(() => {
      this.daemonStarting = null;
    });

    return this.daemonStarting;
  }

  run(command, args, timeout = 600000) {
    if (this.child) throw new Error("กำลังประมวลผลเสียง กรุณารอหรือยกเลิกก่อน");
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });
      this.child = child;
      let stdout = "",
        stderr = "";
      const timer = setTimeout(() => {
        child.kill();
      }, timeout);
      child.stdout.on("data", (b) => {
        stdout += b.toString();
      });
      child.stderr.on("data", (b) => {
        stderr = (stderr + b.toString()).slice(-3000);
        this.onProgress(stderr);
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        this.child = null;
        reject(new Error(`เปิด Python ไม่ได้: ${e.message}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        this.child = null;
        if (code !== 0)
          return reject(
            new Error((stdout || stderr || "ยกเลิกการประมวลผล").slice(-1500)),
          );
        resolve(stdout.trim());
      });
    });
  }
  async status() {
    try {
      await this.run(
        this.python,
        ["-c", 'import faster_whisper; print("ready")'],
        20000,
      );
      const snapshots = await fs.readdir(path.join(this.cache, "models--Systran--faster-whisper-base", "snapshots")).catch(() => []);
      return { ready: true, modelReady: snapshots.length > 0 };
    } catch {
      return {
        ready: false,
        error: "ต้องติดตั้ง Python 3.10+ และตัวถอดเสียงก่อน กดติดตั้งระบบเสียง",
      };
    }
  }
  async setup() {
    if (process.platform !== "win32" && !process.env.SUPERAI_PYTHON) {
      if (!existsSync(this.venvPython)) await this.run(this.python, ["-m", "venv", path.dirname(path.dirname(this.venvPython))]);
      this.python = this.venvPython;
    }
    await this.run(this.python, [
      "-m",
      "pip",
      "install",
      ...(process.platform === "win32" ? ["--user"] : []),
      "-r",
      path.join(directory, "requirements.txt"),
    ]);
    return { ready: true };
  }
  async prepare(model) {
    if (!["tiny", "base", "small", "medium"].includes(model))
      throw new Error("ไม่รู้จักโมเดลเสียง");
    await fs.mkdir(this.cache, { recursive: true });
    const result = await this.run(
      this.python,
      [
        path.join(directory, "whisper_worker.py"),
        "--model",
        model,
        "--cache",
        this.cache,
        "--prepare",
      ],
      1200000,
    );
    return JSON.parse(result.split(/\r?\n/).at(-1));
  }
  async transcribe({
    audio,
    model = "base",
    language = "th",
    groqKey,
    techMode = true,
  }) {
    const cancelVersion = this.cancelVersion;
    const bytes = validateAudio(audio);
    if (
      !["tiny", "base", "small", "medium"].includes(model) ||
      !["th", "en", "auto"].includes(language)
    )
      throw new Error("การตั้งค่าเสียงไม่ถูกต้อง");

    const apiKey = (groqKey || process.env.GROQ_API_KEY || "").trim();

    // Groq Ultra Mode: Cloud Whisper-Large-V3-Turbo (150-250ms, State-of-the-Art Accuracy)
    if (apiKey) {
      try {
        const formData = new FormData();
        formData.append(
          "file",
          new Blob([bytes], { type: "audio/webm" }),
          "audio.webm",
        );
        formData.append("model", "whisper-large-v3-turbo");
        if (language !== "auto") formData.append("language", language);
        formData.append("response_format", "json");
        formData.append(
          "prompt",
          "คำสั่งเขียนโปรแกรมภาษาไทยและอังกฤษ: React, Next.js, TypeScript, JavaScript, Python, npm, git, Docker, API, UI, HTML, CSS, component, function, test, build, dev",
        );

        const res = await fetch(
          "https://api.groq.com/openai/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
          },
        );

        if (res.ok) {
          const data = await res.json();
          let text = (data.text || "").trim();
          if (techMode && (language === "th" || language === "auto")) {
            text = normalizeThaiTech(text);
          }
          return { text, language, engine: "groq" };
        } else {
          console.warn(
            "Groq Whisper API returned non-200:",
            res.status,
            await res.text().catch(() => ""),
          );
        }
      } catch (err) {
        console.warn("Groq Whisper API network error, falling back to local:", err);
      }
    }

    // Local Mode: Persistent Faster-Whisper Daemon with initial prompt
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "superai-voice-"));
    const file = path.join(temp, "audio.webm");
    try {
      await fs.writeFile(file, bytes);

      // Fast path: use persistent daemon
      try {
        const daemon = await this.ensureDaemon(model);
        const result = await new Promise((resolve, reject) => {
          let buffer = "";
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("หมดเวลาประมวลผลเสียง"));
          }, 30000);

          const onData = (d) => {
            buffer += d.toString("utf-8");
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop();
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const res = JSON.parse(line);
                cleanup();
                if (res.error) reject(new Error(res.error));
                else resolve(res);
                return;
              } catch {}
            }
          };

          const cleanup = () => {
            clearTimeout(timeout);
            daemon.stdout.removeListener("data", onData);
          };

          daemon.stdout.on("data", onData);
          daemon.stdin.write(
            JSON.stringify({
              action: "transcribe",
              audio: file,
              language,
              prompt:
                "คำสั่งเขียนโปรแกรมภาษาไทยและอังกฤษ: React, Next.js, TypeScript, JavaScript, Python, npm, git, Docker, API, UI, HTML, CSS, component, function, test, build, dev",
            }) + "\n",
          );
        });

        let text = (result.text || "").trim();
        if (techMode && (language === "th" || language === "auto")) {
          text = normalizeThaiTech(text);
        }
        return { text, language: result.language, engine: "local" };
      } catch (daemonErr) {
        if (cancelVersion !== this.cancelVersion) throw new Error("ยกเลิกการประมวลผลแล้ว");
        // Fallback: one-shot execution
        const output = await this.run(this.python, [
          path.join(directory, "whisper_worker.py"),
          "--model",
          model,
          "--language",
          language,
          "--cache",
          this.cache,
          "--audio",
          file,
        ]);
        const result = JSON.parse(output.split(/\r?\n/).at(-1));
        if (result.error) throw new Error(result.error);
        let text = (result.text || "").trim();
        if (techMode && (language === "th" || language === "auto")) {
          text = normalizeThaiTech(text);
        }
        return { text, language: result.language, engine: "local" };
      }
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  }
  cancel() {
    this.cancelVersion++;
    try { this.startingChild?.kill(); } catch {}
    this.child?.kill();
    if (this.daemon) {
      try {
        this.daemon.stdin?.write(JSON.stringify({ action: "exit" }) + "\n");
        this.daemon.kill();
      } catch {}
      this.daemon = null;
      this.daemonModel = null;
    }
  }
}
