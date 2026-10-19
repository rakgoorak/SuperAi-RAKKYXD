import { AgentLoop } from '../agent/AgentLoop.js';
import { AgentRunOptions } from '../agent/types.js';
import { LLMProvider } from '../providers/BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';
import { BaseSubagent } from './BaseSubagent.js';
import { CoderAgent } from './CoderAgent.js';
import { TesterAgent } from './TesterAgent.js';
import { ReviewerAgent } from './ReviewerAgent.js';

export interface SubTaskItem {
  id: string;
  title: string;
  assignedAgent: 'coder' | 'tester' | 'reviewer';
  instructions: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

export interface MultiAgentEvent {
  type:
    | 'supervisor_start'
    | 'plan_created'
    | 'subagent_start'
    | 'subagent_chunk'
    | 'subagent_finish'
    | 'subagent_error'
    | 'supervisor_synthesis'
    | 'complete';
  payload: any;
  timestamp: number;
}

export interface MultiAgentResult {
  success: boolean;
  goal: string;
  tasks: SubTaskItem[];
  finalSummary: string;
}

export class SupervisorAgent {
  private provider: LLMProvider;
  private tools: ToolDefinition[];
  private subagents: Map<string, BaseSubagent> = new Map();

  constructor(provider: LLMProvider, tools: ToolDefinition[]) {
    this.provider = provider;
    this.tools = tools;

    this.registerSubagent(new CoderAgent(provider, tools));
    this.registerSubagent(new TesterAgent(provider, tools));
    this.registerSubagent(new ReviewerAgent(provider, tools));
  }

  registerSubagent(subagent: BaseSubagent): void {
    this.subagents.set(subagent.id, subagent);
  }

  getSubagent(id: string): BaseSubagent | undefined {
    return this.subagents.get(id);
  }

  async planAndExecute(
    goal: string,
    options: {
      cwd: string;
      onEvent?: (event: MultiAgentEvent) => void;
      onStream?: (chunk: string) => void;
      abortSignal?: AbortSignal;
    }
  ): Promise<MultiAgentResult> {
    this.emitEvent(options.onEvent, 'supervisor_start', { goal });

    const planPrompt = `You are the Lead Supervisor & Architect of an AI multi-agent software engineering team.
The user wants to achieve: "${goal}".
Decompose this goal into a strict JSON list of 2 to 4 actionable tasks for your specialized subagents:
- "coder": implementation, file edits, scaffolding
- "tester": writing unit tests, running bash test commands, verifying fixes
- "reviewer": auditing code diffs, verifying constraints

Format as a valid JSON array only:
[
  { "id": "task_1", "title": "...", "assignedAgent": "coder", "instructions": "..." },
  { "id": "task_2", "title": "...", "assignedAgent": "tester", "instructions": "..." }
]`;

    let planRaw = '';
    try {
      const planRes = await this.provider.generate([{ role: 'user', content: planPrompt }]);
      planRaw = planRes.text;
    } catch (err: any) {
      planRaw = '';
    }

    const tasks = this.parsePlan(planRaw, goal);
    this.emitEvent(options.onEvent, 'plan_created', { tasks });

    let accumulatedContext = `User Goal: "${goal}"\n`;

    for (const task of tasks) {
      task.status = 'running';
      this.emitEvent(options.onEvent, 'subagent_start', { task });

      const agent = this.subagents.get(task.assignedAgent) || this.subagents.get('coder')!;
      const subtaskPrompt = `Context:\n${accumulatedContext}\nYour Assignment (${task.title}):\n${task.instructions}`;

      try {
        const subResult = await agent.executeTask(subtaskPrompt, {
          cwd: options.cwd,
          abortSignal: options.abortSignal,
          onStream: (chunk) => {
            if (options.onStream) options.onStream(chunk);
            this.emitEvent(options.onEvent, 'subagent_chunk', {
              agentId: agent.id,
              taskId: task.id,
              chunk,
            });
          },
        });

        task.status = subResult.success ? 'completed' : 'failed';
        task.result = subResult.output;
        accumulatedContext += `\n[Output from ${agent.name} on ${task.title}]:\n${subResult.output.slice(0, 1000)}\n`;

        this.emitEvent(options.onEvent, 'subagent_finish', {
          task,
          output: subResult.output,
        });
      } catch (err: any) {
        task.status = 'failed';
        task.result = err.message;
        this.emitEvent(options.onEvent, 'subagent_error', {
          task,
          error: err.message,
        });
      }
    }

    this.emitEvent(options.onEvent, 'supervisor_synthesis', { tasks });
    const synthPrompt = `You are the Lead Supervisor. All subagents have finished their assignments for goal: "${goal}".
Task outputs:
${tasks.map((t) => `- [${t.assignedAgent.toUpperCase()}] ${t.title}: ${t.status} (${t.result?.slice(0, 200)}...)`).join('\n')}

Provide a concise, professional summary of the changes made, tests verified, and final status.`;

    let finalSummary = '';
    try {
      const synthRes = await this.provider.generate([{ role: 'user', content: synthPrompt }]);
      finalSummary = synthRes.text;
    } catch {
      finalSummary = `Multi-agent tasks completed. ${tasks.filter((t) => t.status === 'completed').length}/${tasks.length} tasks succeeded.`;
    }

    const allSuccessful = tasks.every((t) => t.status === 'completed');
    this.emitEvent(options.onEvent, 'complete', {
      success: allSuccessful,
      finalSummary,
    });

    return {
      success: allSuccessful,
      goal,
      tasks,
      finalSummary,
    };
  }

  private parsePlan(raw: string, goal: string): SubTaskItem[] {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any, idx: number) => ({
          id: item.id || `task_${idx + 1}`,
          title: item.title || `Task ${idx + 1}`,
          assignedAgent: item.assignedAgent || (idx === 0 ? 'coder' : 'tester'),
          instructions: item.instructions || item.title || '',
          status: 'pending' as const,
        }));
      }
    } catch {}

    return [
      {
        id: 'task_1',
        title: 'Implement Core Solution',
        assignedAgent: 'coder',
        instructions: `Implement solution for "${goal}".`,
        status: 'pending',
      },
      {
        id: 'task_2',
        title: 'Run Tests and Verification',
        assignedAgent: 'tester',
        instructions: `Verify that the code builds and tests pass cleanly.`,
        status: 'pending',
      },
    ];
  }

  private emitEvent(
    listener: ((event: MultiAgentEvent) => void) | undefined,
    type: MultiAgentEvent['type'],
    payload: any
  ): void {
    if (listener) {
      listener({
        type,
        payload,
        timestamp: Date.now(),
      });
    }
  }
}
