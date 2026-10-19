import { BaseSubagent } from './BaseSubagent.js';
import { LLMProvider } from '../providers/BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';

export class CoderAgent extends BaseSubagent {
  constructor(provider: LLMProvider, tools: ToolDefinition[]) {
    super(
      {
        id: 'coder',
        name: 'Coder',
        role: 'Senior Software Developer (Coder) & Implementation Specialist',
        systemPrompt: `You are the Coder Agent. Your goal is to implement software features and fixes by directly inspecting, creating, and modifying files in the workspace.
Guidelines:
- Inspect relevant files first using view_file, grep_search, or glob_search.
- Apply targeted, precise edits using replace_file_content or write_file.
- Verify syntax and run build commands if needed using bash.
- Always report clear progress and explain changes concisely.`,
        maxSteps: 20,
      },
      provider,
      tools
    );
  }
}
