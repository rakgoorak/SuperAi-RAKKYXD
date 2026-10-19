import { AgentLoop } from '../agent/AgentLoop.js';
import { AgentConfig, AgentRunOptions, AgentRunResult } from '../agent/types.js';
import { LLMProvider } from '../providers/BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';

export abstract class BaseSubagent {
  protected loop: AgentLoop;
  public config: AgentConfig;

  constructor(config: AgentConfig, provider: LLMProvider, tools: ToolDefinition[]) {
    this.config = config;
    this.loop = new AgentLoop(config, provider, tools);
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

  async executeTask(taskPrompt: string, options: AgentRunOptions): Promise<AgentRunResult> {
    return this.loop.run(taskPrompt, options);
  }
}
