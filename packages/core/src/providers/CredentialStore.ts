import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

export interface CredentialEncryption {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend?(): string;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export const SESSION_SERVICES = ['chatgpt', 'claude', 'gemini', 'deepseek', 'copilot'] as const;
export type SessionService = typeof SESSION_SERVICES[number];
export function sessionService(value: string): SessionService {
  if (!(SESSION_SERVICES as readonly string[]).includes(value)) throw new Error('Unsupported session service');
  return value as SessionService;
}

export const API_SERVICES = ['openrouter', 'deepseek', 'groq'] as const;
export function apiService(value: string): string {
  if (!(API_SERVICES as readonly string[]).includes(value)) throw new Error('Unsupported API service');
  return value;
}

function systemEncryption(): CredentialEncryption {
  try {
    const { safeStorage } = createRequire(import.meta.url)('electron');
    if (safeStorage) return safeStorage;
  } catch {}
  throw new Error('OS credential encryption is unavailable; use the desktop app after it is ready');
}

/** Electron safeStorage keeps the encryption key in the OS store, never beside this file.
 * Non-Electron callers fail closed. Tests may inject an isolated encryption adapter. */
export class CredentialStore {
  constructor(
    // Follows the app's data folder: Windows encrypts with a key kept in that folder, so a test or
    // second copy of the app with its own data folder must not write the user's file.
    private directory = process.env.SUPERAI_DATA_DIR || path.join(os.homedir(), '.opencode-multi'),
    private encryption?: CredentialEncryption,
  ) {}

  private cipher(): CredentialEncryption {
    const cipher = this.encryption || systemEncryption();
    if (!cipher.isEncryptionAvailable() ||
        (cipher.getSelectedStorageBackend && ['basic_text', 'unknown'].includes(cipher.getSelectedStorageBackend()))) {
      throw new Error('OS credential encryption is unavailable');
    }
    return cipher;
  }

  private read(): Record<string, string> {
    const file = path.join(this.directory, 'credentials.enc');
    if (!fs.existsSync(file)) return {};
    try {
      const data: unknown = JSON.parse(this.cipher().decryptString(fs.readFileSync(file)));
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.values(data).some(v => typeof v !== 'string')) throw new Error();
      return Object.assign(Object.create(null), data);
    } catch { throw new Error('Unable to read encrypted credentials'); }
  }

  private write(data: Record<string, string>): void {
    const cipher = this.cipher();
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const file = path.join(this.directory, 'credentials.enc');
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      const plain = JSON.stringify(data);
      const encrypted = cipher.encryptString(plain);
      fs.writeFileSync(temporary, encrypted, { flag: 'wx', mode: 0o600 });
      if (cipher.decryptString(fs.readFileSync(temporary)) !== plain) throw new Error();
      fs.renameSync(temporary, file);
      if (cipher.decryptString(fs.readFileSync(file)) !== plain) throw new Error();
    } catch { throw new Error('Unable to save encrypted credentials; legacy data retained'); }
    finally { fs.rmSync(temporary, { force: true }); }
  }

  migrateLegacy(): void {
    const legacy = path.join(this.directory, 'auth.json');
    if (!fs.existsSync(legacy)) return;
    // Never use legacy values until encrypted storage has been verified.
    const data = this.read();
    let old: Record<string, string>;
    try {
      old = JSON.parse(fs.readFileSync(legacy, 'utf8'));
      if (!old || typeof old !== 'object' || Array.isArray(old) || Object.values(old).some(v => typeof v !== 'string')) throw new Error();
      for (const [key, value] of Object.entries(old)) {
        // The historical Gemini slot was written by BrowserLogin, so it cannot be an API key.
        const destination = (SESSION_SERVICES as readonly string[]).includes(key) ? `session:${key}`
          : ['openai', 'anthropic'].includes(key) ? `api:${key}` : null;
        if (!destination) throw new Error();
        if (Object.hasOwn(data, destination) && data[destination] !== value) throw new Error();
        data[destination] = value;
      }
    } catch { throw new Error('Unable to migrate legacy credentials; source retained'); }
    this.write(data);
    try {
      for (const key of Object.keys(old)) {
        if ((SESSION_SERVICES as readonly string[]).includes(key)) {
          fs.rmSync(path.join(this.directory, `browser-profile-${key}`), { recursive: true, force: true });
        }
      }
      fs.unlinkSync(legacy);
    } catch { throw new Error('Encrypted migration verified; legacy cleanup incomplete'); }
  }

  /**
   * Saving must not stay blocked by a file this app can never decrypt (written with another app
   * data folder's key, or damaged). It is kept beside the store as `credentials.enc.unreadable-*`
   * and a new store starts; nothing in it could be used anyway.
   */
  private readOrReset(): Record<string, string> {
    try { return this.read(); }
    catch (error) {
      this.cipher(); // encryption itself unavailable: fail closed, keep the file
      const file = path.join(this.directory, 'credentials.enc');
      if (!fs.existsSync(file)) throw error;
      fs.renameSync(file, `${file}.unreadable-${Date.now()}`);
      return {};
    }
  }

  get(kind: 'api' | 'session', provider: string): string | undefined {
    if (kind === 'session') sessionService(provider);
    this.migrateLegacy();
    return this.read()[`${kind}:${provider}`];
  }

  /** API keys the user pasted in Settings (OpenRouter, DeepSeek, Groq). */
  saveApi(provider: string, key: string): void {
    apiService(provider);
    if (!key || key.length > 500 || /\s/.test(key)) throw new Error('Invalid API key');
    this.migrateLegacy();
    this.write({ ...this.readOrReset(), [`api:${provider}`]: key });
  }

  forgetApi(provider: string): void {
    apiService(provider);
    this.migrateLegacy();
    const data = this.read();
    delete data[`api:${provider}`];
    this.write(data);
  }

  saveSession(provider: string, token: string): void {
    sessionService(provider);
    if (!token || /[\r\n]/.test(token)) throw new Error('Invalid session credential');
    this.migrateLegacy();
    this.write({ ...this.read(), [`session:${provider}`]: token });
  }

  forgetSession(provider: string): void {
    sessionService(provider);
    // Deletion must also remove the legacy copy, otherwise it would be reimported.
    this.migrateLegacy();
    const data = this.read();
    delete data[`session:${provider}`];
    this.write(data);
  }
}
