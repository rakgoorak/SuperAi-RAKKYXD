import { chromium, BrowserContext } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface BrowserLoginResult {
  success: boolean;
  provider: string;
  token?: string;
  details?: string;
  error?: string;
}

const PROVIDER_TARGETS: Record<
  string,
  { name: string; url: string; cookieNames: string[]; domain: string }
> = {
  chatgpt: {
    name: 'ChatGPT (OpenAI)',
    url: 'https://chatgpt.com/auth/login',
    cookieNames: ['__Secure-next-auth.session-token', 'session-token', '_puid'],
    domain: 'chatgpt.com',
  },
  claude: {
    name: 'Claude (Anthropic)',
    url: 'https://claude.ai/login',
    cookieNames: ['sessionKey', 'intercom-session-'],
    domain: 'claude.ai',
  },
  gemini: {
    name: 'Google Gemini',
    url: 'https://gemini.google.com',
    cookieNames: ['__Secure-1PSID', 'SID', '__Secure-3PSID'],
    domain: 'google.com',
  },
  deepseek: {
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    cookieNames: ['userToken', 'token'],
    domain: 'deepseek.com',
  },
};

export class BrowserLoginManager {
  private configDir: string;
  private authFile: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.opencode-multi');
    this.authFile = path.join(this.configDir, 'auth.json');
  }

  async saveToken(provider: string, token: string): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    let existing: Record<string, string> = {};
    try {
      existing = JSON.parse(await fs.readFile(this.authFile, 'utf-8'));
    } catch {}

    existing[provider] = token;
    await fs.writeFile(this.authFile, JSON.stringify(existing, null, 2), 'utf-8');
  }

  async login(
    providerKey: 'chatgpt' | 'claude' | 'gemini' | 'deepseek',
    onStatus?: (msg: string) => void
  ): Promise<BrowserLoginResult> {
    const target = PROVIDER_TARGETS[providerKey] || PROVIDER_TARGETS.chatgpt;
    onStatus?.(`Preparing browser login for ${target.name}...`);

    try {
      const cdpBrowser = await chromium.connectOverCDP('http://localhost:9222', { timeout: 1500 });
      onStatus?.(`Connected to running Chrome on :9222. Scanning open tabs for active session...`);
      const contexts = cdpBrowser.contexts();
      for (const ctx of contexts) {
        const cookies = await ctx.cookies();
        for (const cookieName of target.cookieNames) {
          const match = cookies.find((c) => c.name.includes(cookieName) || c.domain.includes(target.domain));
          if (match && match.value && match.value.length > 10) {
            await this.saveToken(providerKey, match.value);
            return {
              success: true,
              provider: providerKey,
              token: match.value,
              details: `Extracted active session from open Chrome tab (${match.name})`,
            };
          }
        }
      }
    } catch {
      // CDP not running, proceed to launching dedicated browser window
    }

    onStatus?.(`Opening browser window to ${target.url}... Please log in on the opened window.`);
    const userDataDir = path.join(this.configDir, `browser-profile-${providerKey}`);
    await fs.mkdir(userDataDir, { recursive: true });

    let context: BrowserContext | null = null;
    try {
      try {
        context = await chromium.launchPersistentContext(userDataDir, {
          headless: false,
          channel: process.platform === 'win32' ? 'chrome' : undefined,
          viewport: { width: 1280, height: 800 },
        });
      } catch {
        try {
          context = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            channel: process.platform === 'win32' ? 'msedge' : undefined,
            viewport: { width: 1280, height: 800 },
          });
        } catch {
          context = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            viewport: { width: 1280, height: 800 },
          });
        }
      }

      const page = context.pages()[0] || (await context.newPage());
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

      const maxWaitMs = 120_000;
      const startTime = Date.now();
      let extractedToken: string | null = null;

      while (Date.now() - startTime < maxWaitMs) {
        if (page.isClosed()) {
          break;
        }

        const cookies = await context.cookies();
        for (const cookieName of target.cookieNames) {
          const found = cookies.find((c) => c.name.toLowerCase().includes(cookieName.toLowerCase()));
          if (found && found.value && found.value.length > 15) {
            extractedToken = found.value;
            break;
          }
        }

        if (!extractedToken && !page.isClosed()) {
          try {
            const lsToken = await page.evaluate(() => {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i) || '';
                if (key.includes('token') || key.includes('session') || key.includes('auth')) {
                  const val = localStorage.getItem(key);
                  if (val && val.length > 20) return val;
                }
              }
              return null;
            });
            if (lsToken) extractedToken = lsToken;
          } catch {}
        }

        if (extractedToken) {
          break;
        }

        await new Promise((r) => setTimeout(r, 1500));
      }

      if (extractedToken) {
        await this.saveToken(providerKey, extractedToken);
        onStatus?.(`Login successful! Session token captured and stored.`);
        await context.close().catch(() => {});
        return {
          success: true,
          provider: providerKey,
          token: extractedToken,
          details: `Captured session credentials from ${target.name}`,
        };
      } else {
        await context.close().catch(() => {});
        return {
          success: false,
          provider: providerKey,
          error: `Login timed out or window was closed before completing login.`,
        };
      }
    } catch (err: any) {
      if (context) await context.close().catch(() => {});
      return {
        success: false,
        provider: providerKey,
        error: `Browser login error: ${err.message}`,
      };
    }
  }
}
