import { BaseProvider, LLMMessage, LLMResponse, ToolCall } from './BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';

export interface OpenAIProviderOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export class OpenAIProvider extends BaseProvider {
  name = 'openai';
  model: string;
  private apiKey: string;
  private baseURL: string;

  constructor(options: OpenAIProviderOptions = {}) {
    super();
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseURL = options.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.model = options.model || 'gpt-4o';
  }

  async generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    if (!this.apiKey && !this.baseURL.includes('localhost') && !this.baseURL.includes('127.0.0.1')) {
      return {
        text: `[OpenAIProvider Mock]: apiKey not set for ${this.model}. Please configure OPENAI_API_KEY.`,
      };
    }

    const formattedTools = this.formatToolsForOpenAI(tools);
    const body: Record<string, any> = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        tool_call_id: m.toolCallId,
        tool_calls: m.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      })),
    };
    if (formattedTools && formattedTools.length > 0) {
      body.tools = formattedTools;
    }

    try {
      const res = await fetch(`${this.baseURL.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      const toolCalls: ToolCall[] = [];
      if (message?.tool_calls) {
        for (const tc of message.tool_calls) {
          try {
            toolCalls.push({
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments || '{}'),
            });
          } catch {
            toolCalls.push({
              id: tc.id,
              name: tc.function.name,
              arguments: {},
            });
          }
        }
      }

      return {
        text: message?.content || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (err: any) {
      return {
        text: `Error calling OpenAI API: ${err.message}`,
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
