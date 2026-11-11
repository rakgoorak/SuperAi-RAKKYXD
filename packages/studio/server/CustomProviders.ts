import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export interface CustomProvider { id: string; name: string; baseURL: string; models: string[] }
export class CustomProviders {
  private entries: CustomProvider[] = [];
  constructor(private file?: string) { if (file) this.configure(file); }
  configure(file: string) {
    this.file = file;
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.entries = Array.isArray(saved) ? saved.filter(item => /^custom-[a-f0-9]{12}$/.test(item?.id)).map(item => this.validate(item, item.id)) : [];
    } catch { this.entries = []; }
  }
  private validate(value: any, id: string): CustomProvider {
    const name = typeof value?.name === 'string' ? value.name.trim() : '';
    if (!name || name.length > 60) throw new Error('ชื่อผู้ให้บริการต้องมี 1–60 ตัวอักษร');
    let url: URL;
    try { url = new URL(value.baseURL); } catch { throw new Error('Base URL ไม่ถูกต้อง'); }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash)
      throw new Error('ใช้ HTTPS หรือ HTTP บน localhost และไม่ใส่ key ใน URL');
    const models = Array.isArray(value.models) ? [...new Set<string>(value.models.map((m: unknown) => String(m).trim()).filter(Boolean))] : [];
    if (!models.length || models.length > 100 || models.some(model => !/^[\w.:/@+-]{1,200}$/.test(model) || model.startsWith('-')))
      throw new Error('ระบุชื่อโมเดลอย่างน้อยหนึ่งรุ่น (สูงสุด 100 รุ่น)');
    return { id, name, baseURL: url.href.replace(/\/+$/, ''), models };
  }
  private save(entries: CustomProvider[]) {
    if (this.file) {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const temp = this.file + '.tmp';
      fs.writeFileSync(temp, JSON.stringify(entries, null, 2), { mode: 0o600 });
      fs.renameSync(temp, this.file);
    }
    this.entries = entries;
  }
  all(): CustomProvider[] { return structuredClone(this.entries); }
  get(id: string): CustomProvider | undefined { return this.all().find(item => item.id === id); }
  add(value: unknown): CustomProvider {
    const config = this.validate(value, `custom-${randomBytes(6).toString('hex')}`);
    this.save([...this.entries, config]);
    return config;
  }
  remove(id: string) { this.save(this.entries.filter(item => item.id !== id)); }
}
export const customProviders = new CustomProviders();
export const isCustom = (id: string) => /^custom-[a-f0-9]{12}$/.test(id);
