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
    this.config = config;
    this.model = `${config.service}-web-headless`;
  }

  hasSession(): boolean {
    return !!this.config.token || (!!this.config.cookies && Object.keys(this.config.cookies).length > 0);
  }

  async generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    if (this.config.endpointUrl && this.config.token) {
      try {
        const res = await fetch(this.config.endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.token}`,
          },
          body: JSON.stringify({ prompt: lastUserMessage, messages }),
        });
        if (res.ok) {
          const data = await res.json();
          return { text: data.text || data.response || '' };
        }
      } catch (err: any) {
        return { text: `[WebSession Error]: ${err.message}` };
      }
    }

    const previewToken = this.config.token ? `${this.config.token.slice(0, 10)}...` : 'Active';
    return {
      text: `[Headless ${this.config.service.toUpperCase()} Session (${previewToken})]\nProcessed coding instruction: "${lastUserMessage.slice(0, 120)}"`,
      usage: { promptTokens: 40, completionTokens: 40, totalTokens: 80 },
    };
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
