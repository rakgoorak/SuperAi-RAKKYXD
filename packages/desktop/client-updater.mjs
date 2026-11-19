// Dynamic Client Assets (OTA Web Bundle Updater).
// Syncs web bundle (dist/) in the background without modifying desktop binaries or restarting the app.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RELEASES_REPO, windowsTar, parseChecksum } from "./updater.mjs";
import { tr } from "./i18n.mjs";

const DOWNLOAD_HOSTS = /^(github\.com|objects\.githubusercontent\.com|release-assets\.githubusercontent\.com|[\w-]+\.githubusercontent\.com)$/;

function checkUrl(url) {
  const u = new URL(url);
  if (u.protocol !== "https:" || !DOWNLOAD_HOSTS.test(u.hostname)) throw new Error(tr("ลิงก์ดาวน์โหลดไม่ได้มาจาก GitHub"));
  return u.href;
}

export class ClientBundleUpdater {
  constructor({
    userDataDir,
    builtInDist = "",
    preferBuiltIn = false,
    repo = RELEASES_REPO,
    onState,
    http = (...a) => fetch(...a),
    tempDir = os.tmpdir(),
  }) {
    this.userDataDir = userDataDir;
    this.bundleDir = path.join(userDataDir, "client-bundle");
    this.builtInDist = builtInDist;
    this.preferBuiltIn = preferBuiltIn === true;
    this.repo = repo;
    this.onState = onState || (() => {});
    this.http = http;
    this.tempDir = tempDir;
    this.infoFile = path.join(this.bundleDir, "bundle-info.json");
    this.state = {
      status: "idle",
      activeSource: this.resolveInitialSource(),
      error: "",
    };
  }

  resolveInitialSource() {
    if (this.preferBuiltIn) return "builtin";
    try {
      const dynamicIndex = path.join(this.bundleDir, "index.html");
      if (fs.existsSync(dynamicIndex)) {
        const builtInIndex = this.builtInDist ? path.join(this.builtInDist, "index.html") : "";
        if (builtInIndex && fs.existsSync(builtInIndex) && fs.statSync(builtInIndex).mtimeMs > fs.statSync(dynamicIndex).mtimeMs) {
          return "builtin";
        }
        return "dynamic";
      }
    } catch {}
    return "builtin";
  }

  getActiveDist() {
    try {
      if (this.state.activeSource === "dynamic" && fs.existsSync(path.join(this.bundleDir, "index.html"))) {
        return this.bundleDir;
      }
    } catch {}
    return this.builtInDist;
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.onState(this.state);
    return this.state;
  }

  async readLocalInfo() {
    try {
      return JSON.parse(await fsp.readFile(this.infoFile, "utf8"));
    } catch {
      return null;
    }
  }

  /** Locate index.html inside extracted directory (can be at root or inside a dist/ folder). */
  async findDistRoot(extracted) {
    if (fs.existsSync(path.join(extracted, "index.html"))) return extracted;
    const subDist = path.join(extracted, "dist");
    if (fs.existsSync(path.join(subDist, "index.html"))) return subDist;
    const entries = await fsp.readdir(extracted, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidate = path.join(extracted, entry.name);
        if (fs.existsSync(path.join(candidate, "index.html"))) return candidate;
        const nestedDist = path.join(candidate, "dist");
        if (fs.existsSync(path.join(nestedDist, "index.html"))) return nestedDist;
      }
    }
    throw new Error(tr("ไม่พบ index.html ในแพ็กเกจ UI"));
  }

  /** Checks for superai-client-dist.zip in GitHub releases */
  async check() {
    if (["downloading", "extracting"].includes(this.state.status)) return this.state;
    this.set({ status: "checking", error: "" });
    try {
      const res = await this.http(`https://api.github.com/repos/${this.repo}/releases?per_page=10`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "SuperAi-RAKKYXD-client-updater" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404) return this.set({ status: "latest", message: tr("ยังไม่มีแพ็กเกจ UI ใหม่อัปเดต"), checkedAt: Date.now() });
      if (res.status === 403 || res.status === 429) throw new Error(tr("GitHub จำกัดจำนวนครั้งที่ตรวจ กรุณาลองใหม่ภายหลัง"));
      if (!res.ok) throw new Error(tr`ตรวจอัปเดตหน้าตา UI ไม่สำเร็จ (${res.status})`);

      const releases = await res.json();
      const list = Array.isArray(releases) ? releases : [releases];

      let candidate = null;
      for (const r of list) {
        if (!r || !r.assets) continue;
        const zip = r.assets.find(
          (a) => typeof a?.name === "string" && (/^superai-client-dist.*\.zip$/i.test(a.name) || /^client-bundle.*\.zip$/i.test(a.name))
        );
        if (zip) {
          const sha = r.assets.find((a) => typeof a?.name === "string" && a.name === `${zip.name}.sha256`);
          candidate = {
            releaseTag: r.tag_name,
            zip: { name: zip.name, size: zip.size, url: zip.browser_download_url, id: zip.id, updated_at: zip.updated_at },
            sha: sha ? { name: sha.name, url: sha.browser_download_url } : null,
            publishedAt: r.published_at || r.created_at,
          };
          break;
        }
      }

      if (!candidate) {
        return this.set({ status: "latest", candidate: null, checkedAt: Date.now() });
      }

      const localInfo = await this.readLocalInfo();
      const isNewer =
        !localInfo ||
        localInfo.assetId !== candidate.zip.id ||
        localInfo.assetUpdatedAt !== candidate.zip.updated_at ||
        localInfo.releaseTag !== candidate.releaseTag;

      return this.set({
        status: isNewer ? "available" : "latest",
        candidate: isNewer ? candidate : null,
        checkedAt: Date.now(),
      });
    } catch (err) {
      return this.set({ status: "error", error: err.message || String(err), checkedAt: Date.now() });
    }
  }

  /** Downloads, verifies, and installs the client bundle into bundleDir. */
  async sync() {
    const candidate = this.state.candidate;
    if (!candidate) return this.state;
    this.set({ status: "downloading", error: "", progress: 0 });
    const work = path.join(this.tempDir, `superai-client-sync-${Date.now()}`);
    await fsp.mkdir(work, { recursive: true });
    const zipPath = path.join(work, candidate.zip.name);
    try {
      // 1. Download SHA if present
      let expectedSha = null;
      if (candidate.sha?.url) {
        const shaRes = await this.http(checkUrl(candidate.sha.url));
        if (shaRes.ok) expectedSha = parseChecksum(await shaRes.text(), candidate.zip.name);
      }

      // 2. Download zip
      const res = await this.http(checkUrl(candidate.zip.url));
      if (!res.ok || !res.body) throw new Error(tr`ดาวน์โหลดไฟล์ UI ไม่สำเร็จ (${res.status})`);
      const total = Number(res.headers.get("content-length")) || candidate.zip.size || 0;
      const hash = createHash("sha256");
      const out = fs.createWriteStream(zipPath);
      let received = 0;
      for await (const chunk of res.body) {
        hash.update(chunk);
        received += chunk.length;
        if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
        if (total) this.set({ progress: Math.min(99, Math.round((received / total) * 100)) });
      }
      await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));

      if (expectedSha && hash.digest("hex").toLowerCase() !== expectedSha.toLowerCase()) {
        throw new Error(tr("ไฟล์ UI ที่ดาวน์โหลดไม่ตรงกับ SHA-256 จึงยกเลิกการติดตั้ง"));
      }

      // 3. Extract to staging
      this.set({ status: "extracting", progress: 100 });
      const extracted = path.join(work, "extracted");
      await fsp.mkdir(extracted, { recursive: true });
      if (process.platform === "darwin") {
        await promisify(execFile)("ditto", ["-x", "-k", zipPath, extracted]);
      } else {
        await promisify(execFile)(windowsTar(), ["-x", "-f", zipPath, "-C", extracted], { windowsHide: true });
      }

      const distRoot = await this.findDistRoot(extracted);

      // 4. Install into bundleDir
      await fsp.mkdir(this.bundleDir, { recursive: true });
      await fsp.cp(distRoot, this.bundleDir, { recursive: true, force: true });

      const info = {
        releaseTag: candidate.releaseTag,
        assetId: candidate.zip.id,
        assetUpdatedAt: candidate.zip.updated_at,
        installedAt: Date.now(),
        sha256: hash.digest("hex"),
      };
      await fsp.writeFile(this.infoFile, JSON.stringify(info, null, 2), "utf8");

      await fsp.rm(work, { recursive: true, force: true }).catch(() => {});
      return this.set({
        status: "ready",
        activeSource: "dynamic",
        bundleInfo: info,
        candidate: null,
        error: "",
      });
    } catch (err) {
      await fsp.rm(work, { recursive: true, force: true }).catch(() => {});
      return this.set({ status: "error", error: err.message || String(err), progress: 0 });
    }
  }

  /** Apply a local zip or directory (for testing / manual dropping without GitHub network). */
  async applyLocalBundle(sourcePath) {
    const stat = await fsp.stat(sourcePath);
    await fsp.mkdir(this.bundleDir, { recursive: true });
    if (stat.isDirectory()) {
      if (!fs.existsSync(path.join(sourcePath, "index.html"))) throw new Error(tr("ไม่พบ index.html ในแพ็กเกจ UI"));
      await fsp.cp(sourcePath, this.bundleDir, { recursive: true, force: true });
    } else {
      const work = path.join(this.tempDir, `superai-client-local-${Date.now()}`);
      await fsp.mkdir(work, { recursive: true });
      if (process.platform === "darwin") {
        await promisify(execFile)("ditto", ["-x", "-k", sourcePath, work]);
      } else {
        await promisify(execFile)(windowsTar(), ["-x", "-f", sourcePath, "-C", work], { windowsHide: true });
      }
      const distRoot = await this.findDistRoot(work);
      await fsp.cp(distRoot, this.bundleDir, { recursive: true, force: true });
      await fsp.rm(work, { recursive: true, force: true }).catch(() => {});
    }
    const info = {
      releaseTag: "local",
      installedAt: Date.now(),
    };
    await fsp.writeFile(this.infoFile, JSON.stringify(info, null, 2), "utf8");
    return this.set({
      status: "ready",
      activeSource: "dynamic",
      bundleInfo: info,
      error: "",
    });
  }

  /** Reverts to built-in bundled client assets. */
  async resetToBuiltIn() {
    try {
      await fsp.rm(this.bundleDir, { recursive: true, force: true }).catch(() => {});
      return this.set({
        status: "idle",
        activeSource: "builtin",
        bundleInfo: null,
        candidate: null,
        error: "",
      });
    } catch (err) {
      return this.set({ status: "error", error: err.message || String(err) });
    }
  }
}
