import { BaseProvider, LLMMessage, LLMResponse, ToolCall } from './BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';

export interface MockResponseItem {
  text: string;
  toolCalls?: ToolCall[];
}

export class MockProvider extends BaseProvider {
  name = 'mock';
  model = 'mock-agent-v1';
  private responses: MockResponseItem[] = [];
  private callCount = 0;

  constructor(options: { customResponses?: MockResponseItem[] } = {}) {
    super();
    this.responses = options.customResponses || [
      { text: 'Mock response from agent.' },
    ];
  }

  setResponses(responses: MockResponseItem[]): void {
    this.responses = responses;
    this.callCount = 0;
  }

  async generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const item = this.responses[this.callCount % this.responses.length];
    this.callCount++;

    return {
      text: item.text,
      toolCalls: item.toolCalls,
      usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
    };
  }

  async stream(
    messages: LLMMessage[],
    onChunk: (chunk: string) => void,
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    const item = this.responses[this.callCount % this.responses.length];
    this.callCount++;

    const words = item.text.split(' ');
    for (let i = 0; i < words.length; i++) {
      const part = (i === 0 ? '' : ' ') + words[i];
      onChunk(part);
      await new Promise((r) => setTimeout(r, 5));
    }

    return {
      text: item.text,
      toolCalls: item.toolCalls,
      usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
    };
  }
}
