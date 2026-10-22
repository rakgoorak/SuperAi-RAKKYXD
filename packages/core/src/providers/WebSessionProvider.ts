import { credentialEndpoint, redactCredential } from './CredentialTransport.js';
import { sessionService } from './CredentialStore.js';
import { BaseProvider, LLMMessage, LLMResponse } from './BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';

export interface WebSessionConfig {
  service: 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'copilot';
  token?: string;
  cookies?: Record<string, string>;
  endpointUrl?: string;
}

export class WebSessionProvider extends BaseProvider {
  name = 'web_session';
  model: string;
  private config: WebSessionConfig;

  constructor(config: WebSessionConfig) {
    super();
    sessionService(config.service);
    this.config = { ...config, cookies: config.cookies ? { ...config.cookies } : undefined };
    this.model = `${config.service}-web-headless`;
  }

  hasSession(): boolean {
    return !!this.config.token || (!!this.config.cookies && Object.keys(this.config.cookies).length > 0);
  }

  async generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    if (this.config.endpointUrl && this.config.token) {
      try {
        const origins: Record<string, string[]> = {
          chatgpt: ['https://chatgpt.com'], claude: ['https://claude.ai'],
          gemini: ['https://gemini.google.com'], deepseek: ['https://chat.deepseek.com'],
          copilot: ['https://copilot.microsoft.com'],
        };
        const endpoint = credentialEndpoint(this.config.endpointUrl, origins[this.config.service]);
        const res = await fetch(endpoint, {
          method: 'POST',
          redirect: 'error',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.token}`,
          },
          body: JSON.stringify({ prompt: lastUserMessage, messages }),
        });
        if (res.ok) {
          const data = redactCredential(await res.json(), this.config.token);
          return { text: data.text || data.response || '' };
        }
        return { text: '[WebSession Error]: request failed.' };
      } catch (err: any) {
        return { text: '[WebSession Error]: request failed or destination is not approved.' };
      }
    }

    return { text: `[${this.config.service.toUpperCase()} session] No supported endpoint is configured.` };
  }

  async stream(
    messages: LLMMessage[],
    onChunk: (chunk: string) => void,
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    const res = await this.generate(messages, tools);
    onChunk(res.text);
    return res;
  }
}
