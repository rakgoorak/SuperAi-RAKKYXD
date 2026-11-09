import { LLMMessage, ToolCall } from '../providers/BaseProvider.js';

export class ContextManager {
  private systemPrompt: string;
  private maxTokens: number;
  private messages: LLMMessage[] = [];

  constructor(systemPrompt: string, maxTokens: number = 8000) {
    this.systemPrompt = systemPrompt;
    this.maxTokens = maxTokens;
    this.reset();
  }

  reset(): void {
    this.messages = [{ role: 'system', content: this.systemPrompt }];
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content });
    this.pruneIfNeeded();
  }

  addAssistantMessage(content: string, toolCalls?: ToolCall[]): void {
    this.messages.push({ role: 'assistant', content, toolCalls });
    this.pruneIfNeeded();
  }

  addToolResult(toolCallId: string, output: string): void {
    const trimmed = output.length > 12000
      ? output.slice(0, 6000) + '\n\n[... Truncated tool output to preserve token budget ...]\n\n' + output.slice(-6000)
      : output;
    this.messages.push({
      role: 'tool',
      toolCallId,
      content: trimmed,
    });
    this.pruneIfNeeded();
  }

  getMessages(): LLMMessage[] {
    return [...this.messages];
  }

  private pruneIfNeeded(): void {
    let totalChars = this.messages.reduce((sum, m) => sum + m.content.length, 0);
    const charLimit = this.maxTokens * 4;

    while (totalChars > charLimit && this.messages.length > 4) {
      const pruneIndex = 2;
      if (pruneIndex < this.messages.length - 2) {
        const removed = this.messages.splice(pruneIndex, 1)[0];
        totalChars -= removed.content.length;
      } else {
        break;
      }
    }
  }
}
