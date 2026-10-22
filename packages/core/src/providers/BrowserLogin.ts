import { chromium, BrowserContext, Browser } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CredentialStore, sessionService } from './CredentialStore.js';

export interface BrowserLoginResult {
  success: boolean;
  provider: string;
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
    cookieNames: ['__Secure-next-auth.session-token', 'session-token'],
    domain: 'chatgpt.com',
  },
  claude: {
    name: 'Claude (Anthropic)',
    url: 'https://claude.ai/login',
    cookieNames: ['sessionKey'],
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
  constructor(private store = new CredentialStore(), configDir = path.join(os.homedir(), '.opencode-multi')) {
    this.configDir = configDir;
  }

  async saveToken(provider: string, token: string): Promise<void> {
    this.store.saveSession(provider, token);
  }

  async logout(provider: string): Promise<{ success: boolean }> {
    sessionService(provider);
    this.store.forgetSession(provider);
    // Older releases persisted Chromium's own cookie/localStorage copy here.
    await fs.rm(path.join(this.configDir, `browser-profile-${provider}`), { recursive: true, force: true });
    return { success: true };
  }

  async login(
    providerKey: 'chatgpt' | 'claude' | 'gemini' | 'deepseek',
    onStatus?: (msg: string) => void
  ): Promise<BrowserLoginResult> {
    const target = PROVIDER_TARGETS[sessionService(providerKey)];
    if (!target) throw new Error('Unsupported browser login service');
    onStatus?.(`Preparing browser login for ${target.name}...`);

    try {
      const cdpBrowser = await chromium.connectOverCDP('http://localhost:9222', { timeout: 1500 });
      onStatus?.(`Connected to running Chrome on :9222. Scanning open tabs for active session...`);
      const contexts = cdpBrowser.contexts();
      for (const ctx of contexts) {
        const cookies = await ctx.cookies();
        for (const cookieName of target.cookieNames) {
          const match = cookies.find((c) => matchesSessionCookie(c, cookieName, target.domain));
          if (match && match.value && match.value.length > 10) {
            await this.saveToken(providerKey, match.value);
            return {
              success: true,
              provider: providerKey,
              details: `Extracted active session from open Chrome tab (${match.name})`,
            };
          }
        }
      }
    } catch {
      // CDP not running, proceed to launching dedicated browser window
    }

    onStatus?.(`Opening browser window to ${target.url}... Please log in on the opened window.`);
    // A nonpersistent context avoids keeping another cookie/localStorage credential copy.
    let context: BrowserContext | null = null;
    let browser: Browser | null = null;
    try {
      try {
        browser = await chromium.launch({
          headless: false,
          channel: process.platform === 'win32' ? 'chrome' : undefined,
        });
      } catch {
        try {
          browser = await chromium.launch({
            headless: false,
            channel: process.platform === 'win32' ? 'msedge' : undefined,
          });
        } catch {
          browser = await chromium.launch({
            headless: false,
          });
        }
      }

      context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
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
          const found = cookies.find((c) => matchesSessionCookie(c, cookieName, target.domain));
          if (found && found.value && found.value.length > 15) {
            extractedToken = found.value;
            break;
          }
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
        error: 'Browser login failed; verify browser access and OS credential storage.',
      };
    } finally {
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }
}

export function matchesSessionCookie(
  cookie: { name: string; domain: string; secure: boolean; expires: number },
  name: string,
  domain: string,
): boolean {
  const host = cookie.domain.replace(/^\./, '').toLowerCase();
  return cookie.name === name && host === domain && cookie.secure &&
    (cookie.expires === -1 || cookie.expires > Date.now() / 1000);
}
