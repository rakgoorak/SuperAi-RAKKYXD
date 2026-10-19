import { ToolDefinition } from '../tools/BaseTool.js';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface LLMResponse {
  text: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  name: string;
  model: string;
  generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
  stream(
    messages: LLMMessage[],
    onChunk: (chunk: string) => void,
    tools?: ToolDefinition[]
  ): Promise<LLMResponse>;
}

export abstract class BaseProvider implements LLMProvider {
  abstract name: string;
  abstract model: string;

  abstract generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
  abstract stream(
    messages: LLMMessage[],
    onChunk: (chunk: string) => void,
    tools?: ToolDefinition[]
  ): Promise<LLMResponse>;

  protected formatToolsForOpenAI(tools?: ToolDefinition[]) {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }
}
