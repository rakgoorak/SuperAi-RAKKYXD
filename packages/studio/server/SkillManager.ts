import fs from "node:fs";
import path from "node:path";
import { CliProvider } from "./CliProvider.js";
import { LocalProvider, extractJson } from "./AgentRunManager.js";
import { Seat, validateSeat } from "./Providers.js";

/**
 * Agent Skills (folders with a SKILL.md) from fixed official sources and skills.sh.
 * Installed into the project so Claude Code (.claude/skills) and Codex/OpenCode (.agents/skills)
 * pick them up and invoke them by themselves.
 */
export const SKILL_SOURCES = [
  { id: "anthropic", label: "Anthropic", repo: "anthropics/skills", branch: "main", prefix: "skills/" },
  { id: "openai", label: "OpenAI", repo: "openai/skills", branch: "main", prefix: "skills/.curated/" },
  { id: "vercel", label: "Vercel / skills.sh", repo: "vercel-labs/agent-skills", branch: "main", prefix: "skills/" },
  { id: "vercel-tools", label: "Vercel Tools", repo: "vercel-labs/skills", branch: "main", prefix: "skills/" },
  { id: "cloudflare", label: "Cloudflare Security", repo: "cloudflare/security-audit-skill", branch: "main", prefix: "skills/" },
  { id: "supabase", label: "Supabase", repo: "supabase/agent-skills", branch: "main", prefix: "skills/" },
] as const;
export const SKILL_TARGETS = [".claude/skills", ".agents/skills"];
const MARKER = ".superai-skill.json";
const MAX_FILES = 80;
const MAX_BYTES = 8 * 1024 * 1024;
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export interface SkillInfo {
  source: string;
  sourceLabel: string;
  name: string;
  description: string;
  files: string[];
  url: string;
  repo?: string;
  branch?: string;
  prefix?: string;
  installs?: number;
  reason?: string;
}

export interface SkillInstallOptions {
  repo?: string;
  branch?: string;
  prefix?: string;
  files?: string[];
}

type Fetch = typeof fetch;

function frontMatter(text: string) {
  const block = /^---\s*\n([\s\S]*?)\n---/.exec(text.replace(/\r\n/g, "\n"))?.[1] || "";
  const field = (key: string) => {
    const m = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(block);
    if (!m) return "";
    const value = m[1].trim();
    // YAML block scalars (">" / "|"): the text is on the following indented lines.
    if (/^[>|][-+]?$/.test(value)) {
      const rest = block.slice(m.index + m[0].length).split("\n").slice(1);
      const lines: string[] = [];
      for (const line of rest) {
        if (line.trim() && !/^\s/.test(line)) break;
        lines.push(line.trim());
      }
      return lines.join(" ").trim();
    }
    return value.replace(/^["']|["']$/g, "");
  };
  return { name: field("name"), description: field("description") };
}

export class SkillManager {
  private cache: { at: number; skills: SkillInfo[] } | null = null;
  private searchCache = new Map<string, SkillInfo>();

  constructor(private http: Fetch = (...args) => fetch(...args)) {}

  private async json(url: string) {
    const res = await this.http(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "SuperAi-RAKKYXD" }, signal: AbortSignal.timeout(20000) });
    if (res.status === 403 || res.status === 429) throw new Error("GitHub จำกัดจำนวนครั้งที่ขอข้อมูล กรุณารอสักครู่แล้วลองใหม่");
    if (!res.ok) throw new Error(`โหลดรายการ skill ไม่สำเร็จ (${res.status})`);
    return res.json();
  }

  private raw(repo: string, branch: string, file: string) {
    return `https://raw.githubusercontent.com/${repo}/${branch}/${file.split("/").map(encodeURIComponent).join("/")}`;
  }

  async catalog(force = false): Promise<SkillInfo[]> {
    if (!force && this.cache && Date.now() - this.cache.at < 3600_000) return this.cache.skills;
    const skills: SkillInfo[] = [];
    const errors: string[] = [];
    for (const source of SKILL_SOURCES) {
      try {
        const tree = await this.json(`https://api.github.com/repos/${source.repo}/git/trees/${source.branch}?recursive=1`);
        const files: string[] = (tree.tree || []).filter((n: any) => n.type === "blob").map((n: any) => n.path);
        const names = files
          .filter((f) => f.startsWith(source.prefix) && f.slice(source.prefix.length).split("/").length === 2 && f.endsWith("/SKILL.md"))
          .map((f) => f.slice(source.prefix.length).split("/")[0])
          .filter((n) => NAME.test(n));
        const found = await Promise.all(
          names.map(async (name) => {
            const dir = `${source.prefix}${name}/`;
            let description = "";
            try {
              const res = await this.http(this.raw(source.repo, source.branch, `${dir}SKILL.md`), { signal: AbortSignal.timeout(20000) });
              if (res.ok) description = frontMatter(await res.text()).description;
            } catch {}
            return {
              source: source.id,
              sourceLabel: source.label,
              name,
              description: description.slice(0, 600),
              files: files.filter((f) => f.startsWith(dir)).map((f) => f.slice(dir.length)),
              url: `https://github.com/${source.repo}/tree/${source.branch}/${dir}`,
              repo: source.repo,
              branch: source.branch,
              prefix: dir,
            };
          }),
        );
        skills.push(...found);
      } catch (err: any) {
        errors.push(`${source.label}: ${err.message}`);
      }
    }
    if (!skills.length) throw new Error(errors.join(" · ") || "ไม่พบ skill จากแหล่งทางการ ตรวจอินเทอร์เน็ตแล้วลองใหม่");
    this.cache = { at: Date.now(), skills };
    return skills;
  }

  /** Search the skills.sh public registry for community and ecosystem skills. */
  async search(query: string): Promise<SkillInfo[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    try {
      const res = await this.http(`https://skills.sh/api/search?q=${encodeURIComponent(q)}&limit=20`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`skills.sh HTTP ${res.status}`);
      const data: any = await res.json();
      if (!Array.isArray(data?.skills)) throw new Error('Invalid skills.sh response');
      const list = Array.isArray(data?.skills) ? data.skills : [];
      const results: SkillInfo[] = [];
      for (const item of list) {
        if (!item || !item.source || (!item.name && !item.skillId)) continue;
        const name = String(item.name || item.skillId || "").trim();
        const repo = String(item.source).trim();
        if (!NAME.test(name) || !/^[\w.-]+\/[\w.-]+$/.test(repo)) continue;
        const skill: SkillInfo = {
          source: "skills.sh",
          sourceLabel: `skills.sh (${repo})`,
          name,
          description: "",
          files: ["SKILL.md"],
          url: `https://github.com/${repo}`,
          repo,
          branch: "main",
          prefix: `skills/${name}/`,
          installs: typeof item.installs === "number" ? item.installs : undefined,
        };
        this.searchCache.set(`skills.sh:${name}`, skill);
        results.push(skill);
      }
      // Populate descriptions for top 8 in parallel
      await Promise.allSettled(
        results.slice(0, 8).map(async (skill) => {
          try {
            const paths = [`skills/${skill.name}/SKILL.md`, `${skill.name}/SKILL.md`, "SKILL.md"];
            for (const p of paths) {
              const res = await this.http(this.raw(skill.repo!, skill.branch || "main", p), {
                signal: AbortSignal.timeout(5000),
              });
              if (res.ok) {
                const fm = frontMatter(await res.text());
                if (fm.description) {
                  skill.description = fm.description.slice(0, 600);
                  skill.prefix = p.slice(0, p.lastIndexOf("/") + 1);
                  break;
                }
              }
            }
          } catch {}
        }),
      );
      return results;
    } catch {
      throw new Error("ค้นหาบน skills.sh ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
    }
  }

  installed(root: string) {
    const result: { name: string; source: string; managed: boolean; targets: string[] }[] = [];
    for (const target of SKILL_TARGETS) {
      const dir = path.join(root, target);
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || !fs.existsSync(path.join(dir, entry.name, "SKILL.md"))) continue;
        let source = "", managed = false;
        try {
          source = JSON.parse(fs.readFileSync(path.join(dir, entry.name, MARKER), "utf8")).source || "";
          managed = true;
        } catch {}
        const existing = result.find((r) => r.name === entry.name);
        if (existing) existing.targets.push(target);
        else result.push({ name: entry.name, source, managed, targets: [target] });
      }
    }
    return result;
  }

  async install(root: string, sourceId: string, name: string, options?: SkillInstallOptions) {
    if (!NAME.test(name)) throw new Error("ชื่อ skill ไม่ถูกต้อง");
    if (this.installed(root).some((s) => s.name === name)) throw new Error(`มี skill ชื่อ ${name} ในโปรเจกต์แล้ว`);

    const source = SKILL_SOURCES.find((s) => s.id === sourceId);
    let repo = "", branch = "main", prefix = `skills/${name}/`;
    let fileList: string[] = [];

    if (source) {
      const skill = (await this.catalog()).find((s) => s.source === sourceId && s.name === name);
      if (!skill) throw new Error("ไม่พบ skill นี้ในแหล่งทางการ");
      repo = source.repo;
      branch = source.branch;
      prefix = `${source.prefix}${name}/`;
      fileList = skill.files;
    } else if (options?.repo) {
      repo = options.repo;
      branch = options.branch || "main";
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("repository ไม่ถูกต้อง");
      try {
        let treeData: any;
        try {
          treeData = await this.json(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`);
        } catch {
          if (branch === "main") {
            branch = "master";
            treeData = await this.json(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`);
          } else throw new Error("ไม่พบ branch ใน repository");
        }
        const blobs: string[] = (treeData.tree || []).filter((n: any) => n.type === "blob").map((n: any) => n.path);
        let dir = options.prefix || "";
        if (!dir || !blobs.some((b) => b.startsWith(dir) && b.endsWith("SKILL.md"))) {
          const skillMd = blobs.find((b) => b.endsWith(`/${name}/SKILL.md`) || b === `${name}/SKILL.md` || (b.endsWith("/SKILL.md") && b.includes(name)));
          if (skillMd) {
            dir = skillMd.slice(0, skillMd.lastIndexOf("/") + 1);
          } else {
            dir = `skills/${name}/`;
          }
        }
        prefix = dir;
        fileList = blobs.filter((b) => b.startsWith(dir)).map((b) => b.slice(dir.length));
      } catch {
        fileList = options.files && options.files.length ? options.files : ["SKILL.md"];
      }
    } else {
      throw new Error("ไม่พบ skill นี้ในแหล่งที่รองรับ");
    }

    if (!fileList.length) fileList = ["SKILL.md"];
    if (fileList.length > MAX_FILES) throw new Error("skill นี้มีไฟล์มากเกินไป ติดตั้งเองจากหน้า GitHub แทน");

    const contents: { file: string; data: Buffer }[] = [];
    let total = 0;
    for (const file of fileList) {
      const parts = file.split("/");
      if (parts.some((p) => !p || p === "." || p === ".." || /[\0:\\]/.test(p))) throw new Error("พบชื่อไฟล์ที่ไม่ปลอดภัยใน skill");
      const res = await this.http(this.raw(repo, branch, `${prefix}${file}`), { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`ดาวน์โหลด ${file} ไม่สำเร็จ (${res.status})`);
      const data = Buffer.from(await res.arrayBuffer());
      total += data.length;
      if (total > MAX_BYTES) throw new Error("skill นี้มีขนาดใหญ่เกินไป");
      contents.push({ file, data });
    }

    const marker = JSON.stringify({ source: sourceId, repo, name, installedAt: new Date().toISOString() }, null, 2);
    for (const target of SKILL_TARGETS) {
      const finalDir = path.join(root, target, name);
      const temp = `${finalDir}.superai-tmp`;
      fs.rmSync(temp, { recursive: true, force: true });
      for (const { file, data } of contents) {
        const out = path.join(temp, ...file.split("/"));
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, data);
      }
      fs.writeFileSync(path.join(temp, MARKER), marker);
      fs.renameSync(temp, finalDir);
    }
    return { name, targets: SKILL_TARGETS };
  }

  /** Remove only skills SuperAi installed (they carry a marker file); never touch the user's own. */
  uninstall(root: string, name: string) {
    if (!NAME.test(name)) throw new Error("ชื่อ skill ไม่ถูกต้อง");
    let removed = 0;
    for (const target of SKILL_TARGETS) {
      const dir = path.join(root, target, name);
      if (!fs.existsSync(path.join(dir, MARKER))) continue;
      fs.rmSync(dir, { recursive: true, force: true });
      removed++;
    }
    if (!removed) throw new Error("ลบได้เฉพาะ skill ที่ติดตั้งผ่าน SuperAi");
    return { removed };
  }

  private projectSummary(root: string) {
    const lines: string[] = [];
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true }).filter((e) => !e.name.startsWith(".") && e.name !== "node_modules").slice(0, 60);
      lines.push(`ไฟล์/โฟลเดอร์บนสุด: ${entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join(", ")}`);
    } catch {}
    for (const file of ["package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml", "README.md"]) {
      try {
        const text = fs.readFileSync(path.join(root, file), "utf8");
        if (file === "package.json") {
          const pkg = JSON.parse(text);
          lines.push(`package.json dependencies: ${Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).slice(0, 60).join(", ")}`);
        } else lines.push(`${file}:\n${text.slice(0, 1500)}`);
      } catch {}
    }
    return lines.join("\n\n") || "โปรเจกต์ว่าง";
  }

  /** Ask the chosen AI which official skills fit this project. Nothing is installed here. */
  async recommend(root: string, seatInput: unknown, goal: string, signal: AbortSignal) {
    const seat: Seat = validateSeat(seatInput, "ผู้แนะนำ skill");
    const catalog = await this.catalog();
    const installed = this.installed(root).map((s) => s.name);
    const options = catalog.filter((s) => !installed.includes(s.name));
    const prompt = `ช่วยเลือก Agent Skills ที่จำเป็นต่อการทำงานในโปรเจกต์นี้ เลือกเฉพาะที่มีประโยชน์จริง 0-5 รายการ
${goal ? `งานที่ผู้ใช้จะทำ: ${goal.slice(0, 2000)}\n` : ""}
ข้อมูลโปรเจกต์:
${this.projectSummary(root)}

skill ที่มีให้เลือก (source/name: คำอธิบาย):
${options.map((s) => `${s.source}/${s.name}: ${s.description}`).join("\n")}

ตอบเป็น JSON อย่างเดียว: [{"source":"anthropic","name":"ชื่อ","reason":"เหตุผลภาษาไทยสั้นๆ"}]`;
    const provider = seat.provider.startsWith("cli:")
      ? new CliProvider(seat.provider, root, signal, false, seat.model, false, [], seat.effort, undefined, undefined, seat.accountId || 'system')
      : new LocalProvider(seat.provider, signal);
    const reply = await provider.generate([{ role: "user", content: prompt }]);
    let picks: any;
    try {
      picks = extractJson(reply.text);
    } catch {
      throw new Error("AI ตอบรายการ skill ในรูปแบบที่อ่านไม่ได้ ลองใหม่อีกครั้ง");
    }
    return (Array.isArray(picks) ? picks : [])
      .map((p: any) => {
        const skill = options.find((s) => s.source === p?.source && s.name === p?.name) || options.find((s) => s.name === p?.name);
        return skill && { ...skill, reason: String(p.reason || "").slice(0, 400) };
      })
      .filter(Boolean)
      .slice(0, 5);
  }
}
