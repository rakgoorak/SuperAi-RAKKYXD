import fs from 'node:fs';
import path from 'node:path';
import { CredentialStore } from './CredentialStore.js';
export * from './CredentialStore.js';

export * from './BaseProvider.js';
export * from './MockProvider.js';
export * from './OpenAIProvider.js';
export * from './OpenAiCompatibleProvider.js';
export * from './AnthropicProvider.js';
export * from './GeminiProvider.js';
export * from './OllamaProvider.js';
export * from './WebSessionProvider.js';
export * from './BrowserLogin.js';

import { LLMProvider } from './BaseProvider.js';
import { MockProvider } from './MockProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { OpenAiCompatibleProvider } from './OpenAiCompatibleProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { WebSessionProvider } from './WebSessionProvider.js';

export interface ProviderSelectionConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'web_session' | 'mock' | 'deepseek' | 'groq' | 'openrouter' | 'openai_compatible';
  apiKey?: string;
  baseURL?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  webToken?: string;
  webService?: 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'copilot';
}

export function loadStoredAuth(selectedProvider?: string): Record<string, string> {
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
            if (key === 'DEEPSEEK_API_KEY') credentials['deepseek'] = val;
            if (key === 'GROQ_API_KEY') credentials['groq'] = val;
            if (key === 'OPENROUTER_API_KEY') credentials['openrouter'] = val;
          }
        }
      }
    }
  } catch {}

  if (process.env.ANTHROPIC_API_KEY) credentials['anthropic'] = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) credentials['openai'] = process.env.OPENAI_API_KEY;
  if (process.env.GEMINI_API_KEY) credentials['gemini'] = process.env.GEMINI_API_KEY;
  if (process.env.DEEPSEEK_API_KEY) credentials['deepseek'] = process.env.DEEPSEEK_API_KEY;
  if (process.env.GROQ_API_KEY) credentials['groq'] = process.env.GROQ_API_KEY;
  if (process.env.OPENROUTER_API_KEY) credentials['openrouter'] = process.env.OPENROUTER_API_KEY;

  const defaultProviders = ['openai', 'anthropic', 'gemini', 'deepseek', 'groq', 'openrouter', 'openai_compatible'];
  const targets = selectedProvider ? [selectedProvider] : defaultProviders;
  const missing = targets.filter((p) => !credentials[p]);

  if (missing.length > 0) {
    try {
      const store = new CredentialStore();
      for (const provider of missing) {
        const token = store.get('api', provider);
        if (token) credentials[provider] = token;
      }
    } catch {}
  }

  return credentials;
}

export function createProvider(config: ProviderSelectionConfig): LLMProvider {
  const cloudProviders = ['anthropic', 'openai', 'gemini', 'deepseek', 'groq', 'openrouter', 'openai_compatible'];
  const auth = cloudProviders.includes(config.provider) && !config.apiKey ? loadStoredAuth(config.provider) : {};

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
    case 'deepseek':
      return new OpenAiCompatibleProvider({
        providerId: 'deepseek',
        apiKey: config.apiKey || auth['deepseek'],
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });
    case 'groq':
      return new OpenAiCompatibleProvider({
        providerId: 'groq',
        apiKey: config.apiKey || auth['groq'],
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });
    case 'openrouter':
      return new OpenAiCompatibleProvider({
        providerId: 'openrouter',
        apiKey: config.apiKey || auth['openrouter'],
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });
    case 'openai_compatible':
      return new OpenAiCompatibleProvider({
        providerId: 'openai_compatible',
        apiKey: config.apiKey || auth['openai_compatible'] || auth['openai'],
        baseURL: config.baseURL,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
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
        token: config.webToken || new CredentialStore().get('session', config.webService || 'chatgpt'),
      });
    case 'mock':
    default:
      return new MockProvider();
  }
}
