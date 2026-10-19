import { BaseSubagent } from './BaseSubagent.js';
import { LLMProvider } from '../providers/BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';

export class ReviewerAgent extends BaseSubagent {
  constructor(provider: LLMProvider, tools: ToolDefinition[]) {
    super(
      {
        id: 'reviewer',
        name: 'Reviewer',
        role: 'Code Quality & Security Auditor',
        systemPrompt: `You are the Reviewer Agent. Your goal is to review code diffs, verify requirements, check for regression risks, security flaws, and edge cases.
Guidelines:
- Inspect changes using git diff and view_file.
- Verify adherence to coding standards, zero unused variables, and proper error handling.
- Approve or request specific revisions with clear instructions.`,
        maxSteps: 10,
      },
      provider,
      tools
    );
  }
}
