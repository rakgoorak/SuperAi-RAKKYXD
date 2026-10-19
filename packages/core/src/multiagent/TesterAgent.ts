import { BaseSubagent } from './BaseSubagent.js';
import { LLMProvider } from '../providers/BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';

export class TesterAgent extends BaseSubagent {
  constructor(provider: LLMProvider, tools: ToolDefinition[]) {
    super(
      {
        id: 'tester',
        name: 'Tester',
        role: 'QA Engineer & Test Automation Specialist',
        systemPrompt: `You are the Tester Agent. Your goal is to write tests, run test commands via bash, reproduce bugs, and verify that implementations pass completely.
Guidelines:
- Run existing tests first to establish a baseline.
- If a test fails, analyze the stack trace and stdout/stderr carefully.
- Report exact error messages and failing assertions so the Coder can fix them.
- Ensure all test suites pass before certifying completion.`,
        maxSteps: 15,
      },
      provider,
      tools
    );
  }
}
