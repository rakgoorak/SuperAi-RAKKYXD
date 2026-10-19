import { BaseProvider, LLMMessage, LLMResponse } from './BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
}

export class GeminiProvider extends BaseProvider {
  name = 'gemini';
  model: string;
  private apiKey: string;

  constructor(options: GeminiProviderOptions = {}) {
    super();
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.model = options.model || 'gemini-2.0-flash';
  }

  async generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    if (!this.apiKey) {
      return {
        text: `[GeminiProvider Mock]: apiKey not set for ${this.model}. Please configure GEMINI_API_KEY.`,
      };
    }

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { text };
    } catch (err: any) {
      return {
        text: `Error calling Gemini API: ${err.message}`,
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
