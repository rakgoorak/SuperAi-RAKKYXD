import { credentialEndpoint, redactCredential } from './CredentialTransport.js';
import { BaseProvider, LLMMessage, LLMResponse, ToolCall } from './BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';

export interface OpenAiCompatibleProviderOptions {
  providerId?: 'deepseek' | 'groq' | 'openrouter' | 'openai' | string;
  apiKey?: string;
  baseURL?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export const APPROVED_OPENAI_COMPATIBLE_ORIGINS = [
  'https://api.openai.com',
  'https://api.deepseek.com',
  'https://api.groq.com',
  'https://openrouter.ai',
] as const;

function getDefaultBaseURL(providerId?: string): string {
  switch (providerId?.toLowerCase()) {
    case 'deepseek':
      return 'https://api.deepseek.com/v1';
    case 'groq':
      return 'https://api.groq.com/openai/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'openai':
    default:
      return 'https://api.openai.com/v1';
  }
}

function getDefaultModel(providerId?: string): string {
  switch (providerId?.toLowerCase()) {
    case 'deepseek':
      return 'deepseek-chat';
    case 'groq':
      return 'llama-3.3-70b-versatile';
    case 'openrouter':
      return 'deepseek/deepseek-r1';
    case 'openai':
    default:
      return 'gpt-4o';
  }
}

function resolveApiKey(options: OpenAiCompatibleProviderOptions): string {
  if (options.apiKey !== undefined) return options.apiKey;
  const id = options.providerId?.toLowerCase();
  switch (id) {
    case 'deepseek':
      return process.env.DEEPSEEK_API_KEY || '';
    case 'groq':
      return process.env.GROQ_API_KEY || '';
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY || '';
    case 'openai':
      return process.env.OPENAI_API_KEY || '';
    default:
      return process.env.OPENAI_API_KEY || '';
  }
}

function getEnvKeyName(providerId?: string): string {
  switch (providerId?.toLowerCase()) {
    case 'deepseek':
      return 'DEEPSEEK_API_KEY';
    case 'groq':
      return 'GROQ_API_KEY';
    case 'openrouter':
      return 'OPENROUTER_API_KEY';
    case 'openai':
    default:
      return 'OPENAI_API_KEY';
  }
}

async function* readSseLines(response: Response): AsyncGenerator<string, void, unknown> {
  if (!response.body) {
    const text = await response.text();
    for (const line of text.split('\n')) {
      yield line;
    }
    return;
  }

  const decoder = new TextDecoder('utf-8');

  if (typeof (response.body as any)[Symbol.asyncIterator] === 'function') {
    let buffer = '';
    for await (const chunk of response.body as any) {
      buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        yield line;
      }
    }
    buffer += decoder.decode();
    if (buffer) {
      for (const line of buffer.split('\n')) {
        yield line;
      }
    }
    return;
  }

  if (typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += typeof value === 'string' ? value : decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          yield line;
        }
      }
      buffer += decoder.decode();
      if (buffer) {
        for (const line of buffer.split('\n')) {
          yield line;
        }
      }
    } finally {
      reader.releaseLock?.();
    }
    return;
  }

  const text = await response.text();
  for (const line of text.split('\n')) {
    yield line;
  }
}

export class OpenAiCompatibleProvider extends BaseProvider {
  public readonly name: string;
  public readonly providerId: string;
  public model: string;
  public baseURL: string;
  protected apiKey: string;
  public temperature?: number;
  public maxTokens?: number;
  protected allowUnauthenticated = false;

  constructor(options: OpenAiCompatibleProviderOptions = {}) {
    super();
    this.providerId = options.providerId || 'openai_compatible';
    this.name = this.providerId;
    this.baseURL = options.baseURL || getDefaultBaseURL(options.providerId);
    this.model = options.model || getDefaultModel(options.providerId);
    this.apiKey = resolveApiKey(options);
    this.temperature = options.temperature;
    this.maxTokens = options.maxTokens;
  }

  private isLocal(): boolean {
    return this.baseURL.includes('localhost') || this.baseURL.includes('127.0.0.1');
  }

  private getRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
    if (this.name === 'openrouter' || this.baseURL.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://superai.app';
      headers['X-Title'] = 'SuperAi';
    }
    return headers;
  }

  async generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    if (!this.apiKey && !this.allowUnauthenticated && !this.isLocal()) {
      return {
        text: `[${this.name}]: apiKey not set for ${this.model}. Please configure ${getEnvKeyName(this.providerId)}.`,
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
    if (this.temperature !== undefined) body.temperature = this.temperature;
    if (this.maxTokens !== undefined) body.max_tokens = this.maxTokens;
    if (formattedTools && formattedTools.length > 0) {
      body.tools = formattedTools;
    }

    try {
      const endpoint = `${this.baseURL.replace(/\/+$/, '')}/chat/completions`;
      if (this.apiKey && !this.isLocal()) {
        credentialEndpoint(endpoint, APPROVED_OPENAI_COMPATIBLE_ORIGINS);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: this.getRequestHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`${this.name} API error (${res.status}): request failed`);
      }

      const data = redactCredential(await res.json(), this.apiKey);
      const choice = data.choices?.[0];
      const message = choice?.message;

      const toolCalls: ToolCall[] = [];
      if (message?.tool_calls) {
        for (const tc of message.tool_calls) {
          try {
            toolCalls.push({
              id: tc.id,
              name: tc.function.name,
              arguments: redactCredential(JSON.parse(tc.function.arguments || '{}'), this.apiKey),
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
        text: `Error calling ${this.name} API; check credentials and the approved endpoint.`,
      };
    }
  }

  async stream(
    messages: LLMMessage[],
    onChunk: (chunk: string) => void,
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    if (!this.apiKey && !this.allowUnauthenticated && !this.isLocal()) {
      const res: LLMResponse = {
        text: `[${this.name}]: apiKey not set for ${this.model}. Please configure ${getEnvKeyName(this.providerId)}.`,
      };
      onChunk(res.text);
      return res;
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
      stream: true,
      stream_options: { include_usage: true },
    };
    if (this.temperature !== undefined) body.temperature = this.temperature;
    if (this.maxTokens !== undefined) body.max_tokens = this.maxTokens;
    if (formattedTools && formattedTools.length > 0) {
      body.tools = formattedTools;
    }

    try {
      const endpoint = `${this.baseURL.replace(/\/+$/, '')}/chat/completions`;
      if (this.apiKey && !this.isLocal()) {
        credentialEndpoint(endpoint, APPROVED_OPENAI_COMPATIBLE_ORIGINS);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: this.getRequestHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`${this.name} API error (${res.status}): request failed`);
      }

      let fullText = '';
      const toolCallsMap: Record<number, { id: string; name: string; arguments: string }> = {};
      let usage: LLMResponse['usage'];

      for await (const line of readSseLines(res)) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') break;

        try {
          const json = JSON.parse(payload);
          const choice = json.choices?.[0];
          const delta = choice?.delta;
          const content = delta?.content ?? delta?.reasoning_content;

          if (typeof content === 'string' && content.length > 0) {
            const clean = redactCredential(content, this.apiKey);
            fullText += clean;
            onChunk(clean);
          }

          if (Array.isArray(delta?.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallsMap[idx]) {
                toolCallsMap[idx] = {
                  id: tc.id || '',
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                };
              } else {
                if (tc.id) toolCallsMap[idx].id += tc.id;
                if (tc.function?.name) toolCallsMap[idx].name += tc.function.name;
                if (tc.function?.arguments) toolCallsMap[idx].arguments += tc.function.arguments;
              }
            }
          }

          if (json.usage) {
            usage = {
              promptTokens: json.usage.prompt_tokens,
              completionTokens: json.usage.completion_tokens,
              totalTokens: json.usage.total_tokens,
            };
          }
        } catch {
          // ignore malformed SSE lines
        }
      }

      const toolCalls: ToolCall[] = [];
      for (const tc of Object.values(toolCallsMap)) {
        let args = {};
        try {
          args = redactCredential(JSON.parse(tc.arguments || '{}'), this.apiKey);
        } catch {
          args = {};
        }
        toolCalls.push({
          id: tc.id,
          name: tc.name,
          arguments: args,
        });
      }

      return {
        text: fullText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage,
      };
    } catch (err: any) {
      return {
        text: `Error calling ${this.name} API; check credentials and the approved endpoint.`,
      };
    }
  }
}
