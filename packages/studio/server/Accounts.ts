import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { tr } from './i18n.js';

export const ACCOUNT_CAPABILITIES = [
  { provider: 'claude-code', supported: true, note: tr("แยกล็อกอิน การตั้งค่า และประวัติต่อบัญชี (บัญชี claude.ai)") },
  { provider: 'codex', supported: true, note: tr("แยก CODEX_HOME และข้อมูลล็อกอินต่อบัญชี") },
  { provider: 'opencode', supported: true, note: tr("แยกพื้นที่ข้อมูลและการตั้งค่าของ OpenCode ต่อโปรไฟล์") },
  { provider: 'antigravity', supported: false, note: tr("agy ใช้ล็อกอินร่วมผ่าน OS keyring ยังยืนยันวิธีแยกบัญชีพร้อมกันไม่ได้") },
] as const;
export interface AccountProfile { id: string; provider: string; name: string; createdAt: number; isDefault?: boolean; system?: boolean }
interface Saved { profiles: AccountProfile[]; defaults: Record<string, string> }

/** Metadata only. Credentials remain owned by each CLI, outside project directories. */
export class AccountRegistry {
  constructor(private root = path.join(process.env.SUPERAI_DATA_DIR || path.join(os.homedir(), '.opencode-multi'), 'accounts')) {}
  private read(): Saved {
    const file = path.join(this.root, 'profiles.json');
    if (!fs.existsSync(file)) return { profiles: [], defaults: {} };
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data.profiles) || !data.defaults || typeof data.defaults !== 'object' || Array.isArray(data.defaults)
      || data.profiles.some((p: AccountProfile) => !p || !/^[a-f0-9-]{36}$/.test(p.id) || !this.supported(p.provider) || typeof p.name !== 'string'))
      throw new Error(tr("อ่านรายการบัญชีไม่ได้ ไฟล์เดิมยังถูกเก็บไว้"));
    return data;
  }
  private write(data: Saved) {
    fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
    const file = path.join(this.root, 'profiles.json'), temp = `${file}.${randomUUID()}.tmp`;
    try { fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600, flag: 'wx' }); fs.renameSync(temp, file); }
    finally { fs.rmSync(temp, { force: true }); }
  }
  supported(provider: string) { return ACCOUNT_CAPABILITIES.some(c => c.provider === provider && c.supported); }
  /**
   * The account used when none is chosen. Once the user has added accounts, the computer's own CLI
   * login is no longer offered: the chosen default, else the first account added.
   */
  private defaultId(provider: string, data = this.read()): string {
    const own = data.profiles.filter(p => p.provider === provider).sort((a, b) => a.createdAt - b.createdAt);
    const chosen = data.defaults[provider];
    if (chosen && own.some(p => p.id === chosen)) return chosen;
    return own[0]?.id || 'system';
  }
  list(provider: string): AccountProfile[] {
    const data = this.read();
    const own = data.profiles.filter(p => p.provider === provider).sort((a, b) => a.createdAt - b.createdAt);
    const fallback = this.defaultId(provider, data);
    // The computer's own login is listed only while there is no account of the user's own.
    return (own.length ? own : [{ id: 'system', provider, name: tr("บัญชีหลักของเครื่อง"), createdAt: 0, system: true }])
      .map(p => ({ ...p, isDefault: p.id === fallback }));
  }
  resolve(provider: string, id?: unknown): string {
    if (id !== undefined && (typeof id !== 'string' || !id)) throw new Error(tr("บัญชีไม่ถูกต้อง"));
    const selected = id === undefined ? this.defaultId(provider) : id;
    if (selected === 'system') return selected;
    if (!this.supported(provider) || !this.read().profiles.some(p => p.provider === provider && p.id === selected))
      throw new Error(tr("ไม่พบบัญชีของผู้ให้บริการนี้ กรุณาเลือกบัญชีใหม่"));
    return selected;
  }
  create(provider: string, name: string): AccountProfile {
    if (!this.supported(provider)) throw new Error(tr("ผู้ให้บริการนี้ยังไม่รองรับการแยกบัญชี"));
    name = typeof name === 'string' ? name.trim() : '';
    if (!name || name.length > 60 || /[\x00-\x1f]/.test(name)) throw new Error(tr("ชื่อบัญชีต้องมี 1–60 ตัวอักษร"));
    const data = this.read();
    const profile = { id: randomUUID(), provider, name, createdAt: Date.now() };
    data.profiles.push(profile);
    // Create a private directory; never copy the current user's credentials or settings.
    const dir = path.join(this.root, profile.id);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (provider === 'codex') fs.writeFileSync(path.join(dir, 'config.toml'), 'cli_auth_credentials_store = "file"\n', { flag: 'wx', mode: 0o600 });
    this.write(data);
    return profile;
  }
  rename(provider: string, id: string, name: string) {
    this.resolve(provider, id);
    if (id === 'system' || typeof name !== 'string' || !name.trim() || name.trim().length > 60 || /[\x00-\x1f]/.test(name)) throw new Error(tr("ชื่อบัญชีไม่ถูกต้อง"));
    const data = this.read(); data.profiles.find(p => p.id === id)!.name = name.trim(); this.write(data);
  }
  setDefault(provider: string, id: string) {
    this.resolve(provider, id);
    const data = this.read(); data.defaults[provider] = id; this.write(data);
  }
  remove(provider: string, id: string) {
    this.resolve(provider, id);
    if (id === 'system') throw new Error(tr("นำบัญชีเดิมของเครื่องออกไม่ได้"));
    const data = this.read(); data.profiles = data.profiles.filter(p => p.id !== id);
    if (data.defaults[provider] === id) delete data.defaults[provider];
    this.write(data); // Retain CLI data and history; no recursive deletion or implicit logout.
  }
  directory(provider: string, id = 'system'): string | undefined {
    this.resolve(provider, id);
    return id === 'system' ? undefined : path.join(this.root, id);
  }
  environment(provider: string, id = 'system', base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const dir = this.directory(provider, id), env = { ...base };
    if (!dir) return env;
    // Selected logins must not silently use a credential or alternate backend inherited from the app.
    const blocked = /^(?:ANTHROPIC_|CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_API_KEY_HELPER_FD|CLAUDE_CODE_USE_|OPENAI_API_KEY|OPENAI_BASE_URL|CODEX_API_KEY|CODEX_AUTH_|GEMINI_API_KEY|GOOGLE_API_KEY|GROQ_API_KEY|DEEPSEEK_API_KEY|OPENROUTER_API_KEY|OPENCODE_CONFIG|OPENCODE_DB|OPENCODE_SERVER|OPENCODE_ATTACH|AWS_|GOOGLE_APPLICATION_CREDENTIALS|GOOGLE_CLOUD_|GCLOUD_|CLOUDSDK_|AZURE_|CLOUDFLARE_|GITHUB_TOKEN|GH_TOKEN|HF_TOKEN)|(?:_API_KEY|_AUTH_TOKEN|_ACCESS_TOKEN)$/i;
    for (const key of Object.keys(env)) if (blocked.test(key)) delete env[key];
    if (provider === 'claude-code') env.CLAUDE_CONFIG_DIR = dir;
    if (provider === 'codex') env.CODEX_HOME = dir;
    if (provider === 'opencode') {
      for (const key of ['DATA', 'CONFIG', 'CACHE', 'STATE']) env[`XDG_${key}_HOME`] = path.join(dir, key.toLowerCase());
      env.OPENCODE_CONFIG_DIR = path.join(dir, 'config', 'opencode');
      // SDKs also fall back to shared credential files when environment keys are absent.
      env.AWS_SHARED_CREDENTIALS_FILE = path.join(dir, 'aws', 'credentials');
      env.AWS_CONFIG_FILE = path.join(dir, 'aws', 'config');
      env.AWS_EC2_METADATA_DISABLED = 'true';
      env.CLOUDSDK_CONFIG = path.join(dir, 'gcloud');
      env.GOOGLE_APPLICATION_CREDENTIALS = path.join(dir, 'gcloud', 'application_default_credentials.json');
    }
    return env;
  }
}
export const accounts = new AccountRegistry();
