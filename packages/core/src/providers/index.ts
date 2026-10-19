import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export * from './BaseProvider.js';
export * from './MockProvider.js';
export * from './OpenAIProvider.js';
export * from './AnthropicProvider.js';
export * from './GeminiProvider.js';
export * from './OllamaProvider.js';
export * from './WebSessionProvider.js';
export * from './BrowserLogin.js';

import { LLMProvider } from './BaseProvider.js';
import { MockProvider } from './MockProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { WebSessionProvider } from './WebSessionProvider.js';

export interface ProviderSelectionConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'web_session' | 'mock';
  apiKey?: string;
  baseURL?: string;
  model?: string;
  webToken?: string;
  webService?: 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'copilot';
}

export function loadStoredAuth(): Record<string, string> {
  const credentials: Record<string, string> = {};

  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eq = trimmed.indexOf('=');
          if (eq > 0) {
            const key = trimmed.slice(0, eq).trim();
            const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
            if (key === 'ANTHROPIC_API_KEY') credentials['anthropic'] = val;
            if (key === 'OPENAI_API_KEY') credentials['openai'] = val;
            if (key === 'GEMINI_API_KEY') credentials['gemini'] = val;
            if (key === 'CHATGPT_SESSION_TOKEN') credentials['chatgpt'] = val;
            if (key === 'CLAUDE_SESSION_TOKEN') credentials['claude'] = val;
          }
        }
      }
    }
  } catch {}

  try {
    const authPath = path.join(os.homedir(), '.opencode-multi', 'auth.json');
    if (fs.existsSync(authPath)) {
      const raw = fs.readFileSync(authPath, 'utf-8');
      const parsed = JSON.parse(raw);
      Object.assign(credentials, parsed);
    }
  } catch {}

  if (process.env.ANTHROPIC_API_KEY) credentials['anthropic'] = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) credentials['openai'] = process.env.OPENAI_API_KEY;
  if (process.env.GEMINI_API_KEY) credentials['gemini'] = process.env.GEMINI_API_KEY;

  return credentials;
}

export function createProvider(config: ProviderSelectionConfig): LLMProvider {
  const auth = loadStoredAuth();

  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider({
        apiKey: config.apiKey || auth['anthropic'],
        model: config.model,
      });
    case 'openai':
      return new OpenAIProvider({
        apiKey: config.apiKey || auth['openai'],
        baseURL: config.baseURL,
        model: config.model,
      });
    case 'gemini':
      return new GeminiProvider({
        apiKey: config.apiKey || auth['gemini'],
        model: config.model,
      });
    case 'ollama':
      return new OllamaProvider({ baseURL: config.baseURL, model: config.model });
    case 'web_session':
      return new WebSessionProvider({
        service: config.webService || 'chatgpt',
        token: config.webToken || auth[config.webService || 'chatgpt'] || auth['chatgpt'],
      });
    case 'mock':
    default:
      return new MockProvider();
  }
}
