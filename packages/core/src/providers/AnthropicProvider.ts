import { credentialEndpoint, redactCredential } from './CredentialTransport.js';
import { BaseProvider, LLMMessage, LLMResponse } from './BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';

export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string;
}

export class AnthropicProvider extends BaseProvider {
  name = 'anthropic';
  model: string;
  private apiKey: string;

  constructor(options: AnthropicProviderOptions = {}) {
    super();
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = options.model || 'claude-3-7-sonnet-20250219';
  }

  async generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    if (!this.apiKey) {
      return {
        text: `[AnthropicProvider Mock]: apiKey not set for ${this.model}. Please configure ANTHROPIC_API_KEY.`,
      };
    }

    const systemMsg = messages.find((m) => m.role === 'system')?.content;
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    try {
      const res = await fetch(credentialEndpoint('https://api.anthropic.com/v1/messages', ['https://api.anthropic.com']), {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          system: systemMsg,
          messages: conversation,
        }),
      });

      if (!res.ok) {
        throw new Error(`Anthropic API error (${res.status}): request failed`);
      }

      const data = redactCredential(await res.json(), this.apiKey);
      const text = data.content?.map((c: any) => c.text || '').join('') || '';

      return {
        text,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        } : undefined,
      };
    } catch (err: any) {
      return {
        text: 'Error calling Anthropic API; check credentials and the approved endpoint.',
      };
    }
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
