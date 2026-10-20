import { LLMProvider } from '../providers/BaseProvider.js';
import { ToolDefinition, ToolResult } from '../tools/BaseTool.js';
import { ContextManager } from './ContextManager.js';
import { AgentConfig, AgentEvent, AgentRunOptions, AgentRunResult } from './types.js';

export class AgentLoop {
  private config: AgentConfig;
  private provider: LLMProvider;
  private tools: ToolDefinition[];
  private contextManager: ContextManager;
  private isRunning = false;

  constructor(config: AgentConfig, provider: LLMProvider, tools: ToolDefinition[]) {
    this.config = config;
    this.provider = provider;
    this.tools = tools;
    this.contextManager = new ContextManager(config.systemPrompt);
  }

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  get role(): string {
    return this.config.role;
  }

  stop(): void {
    this.isRunning = false;
  }

  async run(taskPrompt: string, options: AgentRunOptions): Promise<AgentRunResult> {
    this.isRunning = true;
    this.contextManager.reset();
    this.contextManager.addUserMessage(taskPrompt);

    const maxSteps = this.config.maxSteps || 25;
    let stepCount = 0;
    let finalOutput = '';

    this.emitEvent(options.onEvent, 'start', { task: taskPrompt });

    while (this.isRunning && !options.abortSignal?.aborted && stepCount < maxSteps) {
      stepCount++;
      this.emitEvent(options.onEvent, 'step', { step: stepCount, maxSteps });

      const messages = this.contextManager.getMessages();

      let response;
      try {
        response = await this.provider.stream(
          messages,
          (chunk) => {
            if (options.onStream) options.onStream(chunk);
            this.emitEvent(options.onEvent, 'chunk', { chunk });
          },
          this.tools
        );
      } catch (err: any) {
        this.emitEvent(options.onEvent, 'error', { error: err.message });
        return {
          success: false,
          output: finalOutput,
          stepsCount: stepCount,
          history: this.contextManager.getMessages(),
          error: err.message,
        };
      }

      this.contextManager.addAssistantMessage(response.text, response.toolCalls);

      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalOutput = response.text;
        break;
      }

      for (const tc of response.toolCalls) {
        if (!this.isRunning || options.abortSignal?.aborted) break;

        this.emitEvent(options.onEvent, 'tool_call', {
          toolCallId: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        });

        const tool = this.tools.find((t) => t.name === tc.name);
        let result: ToolResult;

        if (!tool) {
          result = {
            success: false,
            output: '',
            error: `Tool "${tc.name}" not found in agent registry.`,
          };
        } else {
          try {
            result = await tool.execute(tc.arguments, {
              cwd: options.cwd,
              onStream: options.onStream,
              signal: options.abortSignal,
            });
          } catch (err: any) {
            result = {
              success: false,
              output: '',
              error: `Execution error in "${tc.name}": ${err.message}`,
            };
          }
        }

        const toolOutput = result.success
          ? result.output
          : `[Tool Error]: ${result.error || 'Unknown error'}\n${result.output}`;

        this.contextManager.addToolResult(tc.id, toolOutput);

        this.emitEvent(options.onEvent, 'tool_result', {
          toolCallId: tc.id,
          name: tc.name,
          success: result.success,
          output: result.output,
          error: result.error,
        });
      }
    }

    this.isRunning = false;
    this.emitEvent(options.onEvent, 'finish', {
      output: finalOutput,
      stepsCount: stepCount,
    });

    return {
      success: true,
      output: finalOutput,
      stepsCount: stepCount,
      history: this.contextManager.getMessages(),
    };
  }

  private emitEvent(
    listener: ((event: AgentEvent) => void) | undefined,
    type: AgentEvent['type'],
    payload: any
  ): void {
    if (listener) {
      listener({
        type,
        agentId: this.config.id,
        agentName: this.config.name,
        payload,
        timestamp: Date.now(),
      });
    }
  }
}
