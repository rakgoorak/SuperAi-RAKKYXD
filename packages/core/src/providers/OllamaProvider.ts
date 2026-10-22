import { OpenAIProvider } from './OpenAIProvider.js';

export interface OllamaProviderOptions {
  baseURL?: string;
  model?: string;
}

export class OllamaProvider extends OpenAIProvider {
  override name = 'ollama';
  protected override allowUnauthenticated = true;

  constructor(options: OllamaProviderOptions = {}) {
    super({
      apiKey: '',
      baseURL: options.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      model: options.model || 'qwen2.5-coder:7b',
    });
  }
}
