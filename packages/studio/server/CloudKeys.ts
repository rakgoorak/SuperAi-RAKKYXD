import { CredentialStore, OpenAiCompatibleProvider } from "@superai-rakkyxd/core";
import { customProviders, isCustom } from './CustomProviders.js';
import { tr } from './i18n.js';

/** API providers the user connects with their own key. Addresses are fixed: a key only ever goes to its provider. */
export const CLOUD_PROVIDERS: Record<string, { name: string; base: string; env: string; keyPage: string; check: string }> = {
  openrouter: { name: "OpenRouter", base: "https://openrouter.ai/api/v1", env: "OPENROUTER_API_KEY", keyPage: "https://openrouter.ai/keys", check: "/key" },
  deepseek: { name: "DeepSeek", base: "https://api.deepseek.com", env: "DEEPSEEK_API_KEY", keyPage: "https://platform.deepseek.com/api_keys", check: "/models" },
  groq: { name: "Groq", base: "https://api.groq.com/openai/v1", env: "GROQ_API_KEY", keyPage: "https://console.groq.com/keys", check: "/models" },
};
export const CLOUD_IDS = Object.keys(CLOUD_PROVIDERS);
export const isCloud = (id: string) => Object.hasOwn(CLOUD_PROVIDERS, id) || isCustom(id);

export interface CloudKeyStatus { id: string; name: string; hasKey: boolean; source: "settings" | "env" | null; keyPage: string; hint?: string; custom?: boolean; baseURL?: string; models?: string[] }
interface KeyStore { get(kind: "api", provider: string): string | undefined; saveApi(provider: string, key: string): void; forgetApi(provider: string): void }
type Http = (url: string, init?: RequestInit) => Promise<Response>;

const money = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? `$${n.toFixed(2)}` : "");

export class CloudKeys {
  private modelCache = new Map<string, { at: number; models: string[] }>();
  constructor(private store: () => KeyStore = () => new CredentialStore(), private http: Http = (url, init) => fetch(url, init)) {}

  private provider(id: string) {
    if (isCustom(id)) {
      const config = customProviders.get(id);
      if (!config) throw new Error(tr("ไม่พบ Custom Provider นี้"));
      return { name: config.name, base: config.baseURL, env: '', keyPage: '', check: '/models' };
    }
    if (!isCloud(id)) throw new Error(tr("ไม่รู้จักผู้ให้บริการ API นี้"));
    return CLOUD_PROVIDERS[id];
  }
  private stored(id: string): string {
    try { return this.store().get("api", id) || ""; } catch { return ""; }
  }
  /** The key in use: one saved in Settings wins over an environment variable. */
  key(id: string): string {
    return this.stored(id) || process.env[this.provider(id).env] || "";
  }
  status(id: string): CloudKeyStatus {
    const p = this.provider(id);
    const saved = this.stored(id);
    const key = saved || process.env[p.env] || "";
    // Enough to recognise which key is saved, never enough to use it.
    const custom = customProviders.get(id);
    return { id, name: p.name, hasKey: !!key, source: saved ? "settings" : key ? "env" : null, keyPage: p.keyPage, hint: key ? `…${key.slice(-4)}` : undefined,
      ...(custom ? { custom: true, baseURL: custom.baseURL, models: custom.models } : {}) };
  }
  all(): CloudKeyStatus[] { return [...CLOUD_IDS, ...customProviders.all().map(item => item.id)].map((id) => this.status(id)); }

  create(id: string, model?: string, signal?: AbortSignal) {
    const p = this.provider(id), key = this.key(id);
    if (!key) throw new Error(tr("ยังไม่ได้เชื่อมต่อ API Key ของผู้ให้บริการนี้"));
    const custom = customProviders.get(id);
    if (!model && custom) model = custom.models[0];
    return new OpenAiCompatibleProvider({ providerId: id, apiKey: key, baseURL: p.base, model, signal, throwErrors: true,
      ...(custom ? { approvedOrigins: [new URL(custom.baseURL).origin] } : {}) });
  }

  async addCustom(value: any): Promise<CloudKeyStatus> {
    const key = typeof value?.key === 'string' ? value.key.trim() : '';
    if (!key || key.length > 500 || /\s/.test(key)) throw new Error(tr("API Key ไม่ถูกต้อง"));
    const config = customProviders.add(value);
    try { this.store().saveApi(config.id, key); }
    catch { customProviders.remove(config.id); throw new Error(tr("บันทึก key แบบเข้ารหัสไม่สำเร็จ")); }
    return this.status(config.id);
  }
  removeCustom(id: string) {
    if (!isCustom(id) || !customProviders.get(id)) throw new Error(tr("ไม่พบ Custom Provider นี้"));
    this.remove(id); customProviders.remove(id);
  }

  private async request(id: string, route: string, key: string): Promise<any> {
    const p = this.provider(id);
    let response: Response;
    try {
      // Never follow a redirect with the key attached.
      response = await this.http(p.base + route, { headers: { Authorization: `Bearer ${key}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
    } catch {
      throw new Error(tr`เชื่อมต่อ ${p.name} ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่`);
    }
    if (response.status === 401 || response.status === 403) throw new Error(tr`${p.name} ไม่ยอมรับ API Key นี้ ตรวจว่าคัดลอกครบและ key ยังไม่ถูกยกเลิก`);
    if (!response.ok) throw new Error(tr`${p.name} ตอบกลับผิดปกติ (HTTP ${response.status}) ลองใหม่ภายหลัง`);
    return response.json().catch(() => ({}));
  }

  /** Checks the key with the provider before it is saved, so a typo is caught here and not in a chat. */
  async save(id: string, key: string): Promise<CloudKeyStatus> {
    const value = String(key || "").trim();
    if (!value || value.length > 500 || /\s/.test(value)) throw new Error(tr("API Key ไม่ถูกต้อง"));
    if (!isCustom(id)) await this.request(id, this.provider(id).check, value);
    try { this.store().saveApi(id, value); }
    catch (error: any) {
      const reason = String(error?.message || error);
      throw new Error(/unavailable/i.test(reason)
        ? tr("บันทึก API Key ไม่ได้ ระบบเข้ารหัสของเครื่องยังไม่พร้อม (ใช้ได้เฉพาะในแอปเดสก์ท็อป)")
        : tr`บันทึก API Key ไม่ได้: ${reason}`);
    }
    this.modelCache.delete(id);
    return this.status(id);
  }
  remove(id: string): CloudKeyStatus {
    this.provider(id);
    try { this.store().forgetApi(id); } catch { throw new Error(tr("ลบ API Key ไม่สำเร็จ")); }
    this.modelCache.delete(id);
    return this.status(id);
  }
  async test(id: string): Promise<void> {
    const key = this.key(id);
    if (!key) throw new Error(tr("ยังไม่ได้ใส่ API Key"));
    await this.request(id, this.provider(id).check, key);
  }

  /** Model ids the provider offers right now (cached for five minutes). */
  async models(id: string): Promise<string[]> {
    const custom = customProviders.get(id);
    if (custom) return custom.models;
    const key = this.key(id);
    if (!key) return [];
    const cached = this.modelCache.get(id);
    if (cached && Date.now() - cached.at < 300_000) return cached.models;
    const data = await this.request(id, "/models", key);
    const models = (Array.isArray(data?.data) ? data.data : [])
      .map((m: any) => m?.id).filter((m: unknown): m is string => typeof m === "string" && /^[\w.:/@+-]{1,200}$/.test(m)).sort();
    this.modelCache.set(id, { at: Date.now(), models });
    return models;
  }

  /** Credit figures for the Usage panel; null when the provider has no way to ask. */
  async balance(id: string): Promise<{ label: string; value: string }[] | null> {
    const key = this.key(id);
    if (!key) return null;
    if (id === "openrouter") {
      const out: { label: string; value: string }[] = [];
      const credits = (await this.request(id, "/credits", key).catch(() => null))?.data;
      if (credits && typeof credits.total_credits === "number" && typeof credits.total_usage === "number") {
        out.push({ label: tr("เครดิตคงเหลือ"), value: money(credits.total_credits - credits.total_usage) });
        out.push({ label: tr("เติมไว้ทั้งหมด"), value: money(credits.total_credits) });
      }
      const info = (await this.request(id, "/key", key))?.data;
      if (typeof info?.usage === "number") out.push({ label: tr("key นี้ใช้ไปแล้ว"), value: money(info.usage) });
      if (typeof info?.limit_remaining === "number") out.push({ label: tr("วงเงินของ key เหลือ"), value: money(info.limit_remaining) });
      return out;
    }
    if (id === "deepseek") {
      const data = await this.request(id, "/user/balance", key);
      return (Array.isArray(data?.balance_infos) ? data.balance_infos : [])
        .filter((b: any) => b && b.total_balance !== undefined)
        .map((b: any) => ({ label: tr`ยอดคงเหลือ (${String(b.currency || "").slice(0, 8)})`, value: String(b.total_balance).slice(0, 20) }));
    }
    return null;
  }
}
export const cloudKeys = new CloudKeys();
