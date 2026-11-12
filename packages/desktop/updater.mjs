// In-app updates from the public releases repository (the source repository is private).
// Flow: check latest release -> download this platform's ZIP -> verify SHA-256 -> extract ->
// after the app quits, a small detached script copies the new files over and relaunches.
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

export const RELEASES_REPO = process.env.SUPERAI_UPDATE_REPO || "rakgoorak/SuperAi-RAKKYXD-releases";
const DOWNLOAD_HOSTS = /^(github\.com|objects\.githubusercontent\.com|release-assets\.githubusercontent\.com|[\w-]+\.githubusercontent\.com)$/;

/** -1, 0 or 1 for dotted numeric versions ("v1.2.0" == "1.2"). Pre-release suffixes sort first. */
export function compareVersions(a, b) {
  const parse = (v) => {
    const [main, pre = ""] = String(v).trim().replace(/^v/i, "").split("-", 2);
    return { parts: main.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < Math.max(x.parts.length, y.parts.length); i++) {
    const d = (x.parts[i] || 0) - (y.parts[i] || 0);
    if (d) return Math.sign(d);
  }
  if (x.pre === y.pre) return 0;
  return !x.pre ? 1 : !y.pre ? -1 : x.pre < y.pre ? -1 : 1;
}

/** The ZIP and checksum assets for this OS/CPU, e.g. "...-windows-x64.zip". */
export function pickAsset(assets, platform = process.platform, arch = process.arch) {
  const os = platform === "win32" ? "windows" : platform === "darwin" ? "macos" : "";
  if (!os) return null;
  const suffix = `-${os}-${arch}.zip`;
  const zip = (assets || []).find((a) => typeof a?.name === "string" && a.name.endsWith(suffix));
  if (!zip) return null;
  const sha = assets.find((a) => a?.name === `${zip.name}.sha256`);
  return { zip, sha: sha || null };
}

/** "hard" when the release notes carry `<!-- superai-update: hard -->`, otherwise "soft". */
export function updateKind(body) {
  return /<!--\s*superai-update:\s*hard\s*-->/i.test(String(body || "")) ? "hard" : "soft";
}
const stripMarkers = (body) => String(body || "").replace(/<!--\s*superai-update:[^>]*-->\s*/gi, "").trim();

export function parseChecksum(text, fileName) {
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^([a-f0-9]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (m && (!fileName || m[2].trim() === fileName)) return m[1].toLowerCase();
  }
  return null;
}

// Windows bsdtar reads ZIPs; a GNU tar earlier on PATH (Git Bash) would treat "C:" as a host.
export const windowsTar = () => path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");

function checkUrl(url) {
  const u = new URL(url);
  if (u.protocol !== "https:" || !DOWNLOAD_HOSTS.test(u.hostname)) throw new Error("ลิงก์ดาวน์โหลดไม่ได้มาจาก GitHub");
  return u.href;
}

/** Folder that holds the running app: the .exe folder on Windows, the .app bundle on macOS. */
export function installTarget(execPath = process.execPath, platform = process.platform) {
  if (platform === "darwin") {
    const marker = execPath.indexOf(".app/Contents/MacOS/");
    return marker > 0 ? execPath.slice(0, marker + 4) : null;
  }
  return path.dirname(execPath);
}

export class Updater {
  constructor({ currentVersion, packaged, storeManaged = process.windowsStore === true, onState, http = (...a) => fetch(...a), tempDir = os.tmpdir() }) {
    this.currentVersion = currentVersion;
    this.packaged = packaged;
    this.storeManaged = storeManaged;
    this.onState = onState || (() => {});
    this.http = http;
    this.tempDir = tempDir;
    this.state = { status: "idle", currentVersion, packaged, storeManaged };
    this.controller = null;
  }
  set(patch) {
    this.state = { ...this.state, ...patch };
    this.onState(this.state);
    return this.state;
  }

  async check() {
    if (this.storeManaged) return this.state;
    if (["downloading", "extracting", "ready", "waiting", "installing"].includes(this.state.status)) return this.state;
    this.set({ status: "checking", error: "" });
    try {
      // The list (not /releases/latest) so a hard update is still enforced after a later soft one.
      const res = await this.http(`https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=30`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "SuperAi-RAKKYXD-updater" },
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 404) return this.set({ status: "none", error: "ยังไม่มี release ให้ดาวน์โหลด", checkedAt: Date.now() });
      if (res.status === 403 || res.status === 429) throw new Error("GitHub จำกัดจำนวนครั้งที่ตรวจ กรุณาลองใหม่ภายหลัง");
      if (!res.ok) throw new Error(`ตรวจอัปเดตไม่สำเร็จ (${res.status})`);
      const data = await res.json();
      const releases = (Array.isArray(data) ? data : [data])
        .filter((r) => r && r.tag_name && !r.draft && !r.prerelease)
        .sort((a, b) => compareVersions(b.tag_name, a.tag_name));
      if (!releases.length) return this.set({ status: "none", error: "ยังไม่มี release ให้ดาวน์โหลด", checkedAt: Date.now() });
      const release = releases[0];
      const latest = String(release.tag_name).replace(/^v/i, "");
      const asset = pickAsset(release.assets);
      const newer = compareVersions(latest, this.currentVersion) > 0;
      // Hard update: some release newer than this one says so in its notes.
      const mandatory = newer && releases.some((r) => compareVersions(r.tag_name, this.currentVersion) > 0 && updateKind(r.body) === "hard");
      return this.set({
        status: newer ? (asset ? "available" : "unsupported") : "latest",
        latestVersion: latest,
        mandatory,
        notes: stripMarkers(release.body).slice(0, 4000),
        releaseUrl: release.html_url,
        asset: asset ? { name: asset.zip.name, size: asset.zip.size, url: asset.zip.browser_download_url, sha: asset.sha?.browser_download_url || "" } : null,
        checkedAt: Date.now(),
        error: newer && !asset ? "release นี้ยังไม่มีไฟล์สำหรับเครื่องนี้" : "",
      });
    } catch (err) {
      // A dropped connection must not hide an update an earlier check already found.
      const known = this.state.asset && compareVersions(this.state.latestVersion || "0", this.currentVersion) > 0;
      return this.set({ status: known ? "available" : "error", error: known ? "" : err.message || String(err) });
    }
  }

  async download() {
    if (this.storeManaged) throw new Error("อัปเดตแอปนี้ผ่าน Microsoft Store เท่านั้น");
    const asset = this.state.asset;
    if (this.state.status !== "available" && this.state.status !== "error") return this.state;
    if (!asset) throw new Error("ตรวจอัปเดตก่อน");
    if (!this.packaged) throw new Error("โหมดพัฒนา (รันจาก source) อัปเดตด้วย git pull และ npm run build แทน");
    if (!asset.sha) throw new Error("release นี้ไม่มีไฟล์ SHA-256 จึงไม่ติดตั้งให้เพื่อความปลอดภัย");
    this.controller = new AbortController();
    const work = path.join(this.tempDir, `superai-update-${this.state.latestVersion}-${Date.now()}`);
    await fsp.mkdir(work, { recursive: true });
    const zipPath = path.join(work, asset.name);
    try {
      this.set({ status: "downloading", progress: 0, error: "" });
      const shaRes = await this.http(checkUrl(asset.sha), { signal: this.controller.signal });
      if (!shaRes.ok) throw new Error(`โหลดไฟล์ตรวจสอบไม่สำเร็จ (${shaRes.status})`);
      const expected = parseChecksum(await shaRes.text(), asset.name);
      if (!expected) throw new Error("ไฟล์ SHA-256 ไม่ถูกต้อง");
      const res = await this.http(checkUrl(asset.url), { signal: this.controller.signal });
      if (!res.ok || !res.body) throw new Error(`ดาวน์โหลดไม่สำเร็จ (${res.status})`);
      const total = Number(res.headers.get("content-length")) || asset.size || 0;
      const hash = createHash("sha256");
      const out = fs.createWriteStream(zipPath);
      let received = 0, lastReport = 0;
      for await (const chunk of res.body) {
        hash.update(chunk);
        received += chunk.length;
        if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
        if (total && Date.now() - lastReport > 250) {
          lastReport = Date.now();
          this.set({ progress: Math.min(99, Math.round((received / total) * 100)) });
        }
      }
      await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
      if (hash.digest("hex") !== expected) throw new Error("ไฟล์ที่ดาวน์โหลดไม่ตรงกับ SHA-256 จึงยกเลิกการติดตั้ง");
      this.set({ status: "extracting", progress: 100 });
      const extracted = path.join(work, "extracted");
      await fsp.mkdir(extracted);
      if (process.platform === "darwin") await promisify(execFile)("ditto", ["-x", "-k", zipPath, extracted]);
      else await promisify(execFile)(windowsTar(), ["-x", "-f", zipPath, "-C", extracted], { windowsHide: true });
      const source = await this.findPayload(extracted);
      await fsp.rm(zipPath, { force: true });
      return this.set({ status: "ready", source, work });
    } catch (err) {
      await fsp.rm(work, { recursive: true, force: true }).catch(() => {});
      const cancelled = this.controller?.signal.aborted;
      return this.set({ status: cancelled ? "available" : "error", error: cancelled ? "" : err.message || String(err), progress: 0 });
    } finally {
      this.controller = null;
    }
  }

  cancel() {
    this.controller?.abort();
  }

  /** Locate the new app inside the extracted ZIP (it is wrapped in one versioned folder). */
  async findPayload(extracted) {
    const top = (await fsp.readdir(extracted, { withFileTypes: true })).filter((e) => e.isDirectory());
    for (const dir of top) {
      const base = path.join(extracted, dir.name);
      if (process.platform === "darwin") {
        const app = (await fsp.readdir(base)).find((n) => n.endsWith(".app"));
        if (app) return path.join(base, app);
      } else if (fs.existsSync(path.join(base, "SuperAi-RAKKYXD.exe"))) return base;
    }
    throw new Error("ไม่พบโปรแกรมในไฟล์อัปเดต");
  }

  /** Start the detached copier; the caller must quit the app right after this returns. */
  async install({ execPath = process.execPath, pid = process.pid } = {}) {
    if (this.storeManaged) throw new Error("อัปเดตแอปนี้ผ่าน Microsoft Store เท่านั้น");
    if (!["ready", "waiting"].includes(this.state.status)) throw new Error("ดาวน์โหลดอัปเดตให้เสร็จก่อน");
    const target = installTarget(execPath);
    if (!target) throw new Error("ไม่พบตำแหน่งที่ติดตั้งโปรแกรม");
    // Fail early (before quitting) when the install folder is read-only, e.g. Program Files.
    const probe = path.join(process.platform === "darwin" ? path.dirname(target) : target, `.superai-write-test-${pid}`);
    try {
      await fsp.writeFile(probe, "");
      await fsp.rm(probe, { force: true });
    } catch {
      throw new Error(`ไม่มีสิทธิ์เขียนโฟลเดอร์ ${path.dirname(target)} ย้ายโปรแกรมไปไว้ในโฟลเดอร์ของคุณ (เช่น Documents) แล้วลองใหม่`);
    }
    const { source, work } = this.state;
    const log = path.join(work, "install.log");
    if (process.platform === "win32") {
      const script = path.join(work, "install.ps1");
      const exe = path.join(target, path.basename(execPath));
      const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
      await fsp.writeFile(script, [
        `$ErrorActionPreference = 'Continue'`,
        `Start-Transcript -Path ${q(log)} | Out-Null`,
        `try { Wait-Process -Id ${pid} -Timeout 60 -ErrorAction SilentlyContinue } catch {}`,
        `Start-Sleep -Milliseconds 800`,
        // resources\\app belongs entirely to SuperAi, so mirror it (drops stale files);
        // everything else is copied over without deleting anything the user put next to the exe.
        `robocopy ${q(path.join(source, "resources", "app"))} ${q(path.join(target, "resources", "app"))} /MIR /R:20 /W:1 /NFL /NDL /NP | Out-Null`,
        `$app = $LASTEXITCODE`,
        `robocopy ${q(source)} ${q(target)} /E /XD ${q(path.join(source, "resources", "app"))} /R:20 /W:1 /NFL /NDL /NP | Out-Null`,
        `$rest = $LASTEXITCODE`,
        `Write-Output "robocopy app=$app rest=$rest"`,
        // Installed with Setup.exe: keep the version in Settings > Apps in step with the files.
        `$key = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SuperAi-RAKKYXD'`,
        `if ($app -lt 8 -and (Test-Path $key) -and ((Get-ItemProperty $key).InstallLocation -eq ${q(target)})) { Set-ItemProperty $key -Name DisplayVersion -Value ${q(this.state.latestVersion)} }`,
        `Start-Process -FilePath ${q(exe)}`,
        `Stop-Transcript | Out-Null`,
        `if ($app -lt 8 -and $rest -lt 8) { Remove-Item -LiteralPath ${q(source)} -Recurse -Force -ErrorAction SilentlyContinue }`,
      ].join("\r\n"), "utf8");
      // A launcher starts the installer and exits at once, so the installer is not in the app's
      // process tree and survives a tree kill (taskkill /T) when the app closes.
      const inner = `Start-Process -WindowStyle Hidden -FilePath powershell.exe -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',${q(`"${script}"`)})`;
      // Wait for the hand-off: quitting while the launcher is still starting would kill it too.
      // Not "detached": a console-less (DETACHED_PROCESS) launcher cannot start the installer.
      const launcher = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", inner], { stdio: "ignore", windowsHide: true });
      const code = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("เริ่มตัวติดตั้งไม่สำเร็จ (หมดเวลา) กรุณาลองใหม่")), 20000);
        launcher.once("error", (e) => { clearTimeout(timer); reject(e); });
        launcher.once("exit", (c) => { clearTimeout(timer); resolve(c); });
      });
      if (code !== 0) throw new Error(`เริ่มตัวติดตั้งไม่สำเร็จ (รหัส ${code})`);
    } else {
      const script = path.join(work, "install.sh");
      const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
      await fsp.writeFile(script, [
        "#!/bin/sh",
        `exec >${q(log)} 2>&1`,
        `i=0; while kill -0 ${pid} 2>/dev/null && [ $i -lt 120 ]; do sleep 0.5; i=$((i+1)); done`,
        `rm -rf ${q(target + ".old")}`,
        `if mv ${q(target)} ${q(target + ".old")} && ditto ${q(source)} ${q(target)}; then rm -rf ${q(target + ".old")}; else rm -rf ${q(target)}; mv ${q(target + ".old")} ${q(target)}; fi`,
        `xattr -cr ${q(target)} 2>/dev/null || true`,
        `open ${q(target)}`,
      ].join("\n"), { mode: 0o755 });
      spawn("/bin/sh", [script], { detached: true, stdio: "ignore" }).unref();
    }
    return this.set({ status: "installing" });
  }
}
