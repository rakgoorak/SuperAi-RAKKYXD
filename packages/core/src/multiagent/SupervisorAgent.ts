import { AgentLoop } from '../agent/AgentLoop.js';
import { AgentRunOptions } from '../agent/types.js';
import { LLMProvider } from '../providers/BaseProvider.js';
import { ToolDefinition } from '../tools/BaseTool.js';
import { BaseSubagent } from './BaseSubagent.js';
import { CoderAgent } from './CoderAgent.js';
import { TesterAgent } from './TesterAgent.js';
import { ReviewerAgent } from './ReviewerAgent.js';

export type TeamRole = 'coder' | 'tester' | 'reviewer';
export interface SupervisorTeamOptions { providers?: Partial<Record<TeamRole, LLMProvider>>; enabledRoles?: TeamRole[]; }

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

  private enabledRoles: TeamRole[];

  constructor(provider: LLMProvider, tools: ToolDefinition[], team: SupervisorTeamOptions = {}) {
    this.provider = provider;
    this.tools = tools;
    this.enabledRoles = team.enabledRoles || ["coder", "tester", "reviewer"];
    if (!this.enabledRoles.length || this.enabledRoles.some(role => !["coder", "tester", "reviewer"].includes(role))) throw new Error("เลือกบทบาทลูกทีมอย่างน้อยหนึ่งคน");

    this.registerSubagent(new CoderAgent(team.providers?.coder || provider, tools));
    this.registerSubagent(new TesterAgent(team.providers?.tester || provider, tools));
    this.registerSubagent(new ReviewerAgent(team.providers?.reviewer || provider, tools.filter(tool => ['view_file','grep_search','glob_search'].includes(tool.name))));
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
Only assign tasks to these enabled roles: ${this.enabledRoles.join(", ")}. Use only those roles. Execute tasks sequentially, preserving dependencies.

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
      throw new Error(`หัวหน้าทีมวางแผนไม่สำเร็จ: ${err.message}`);
    }

    const tasks = this.parsePlan(planRaw, goal);
    this.emitEvent(options.onEvent, 'plan_created', { tasks });

    let accumulatedContext = `User Goal: "${goal}"\n`;

    for (const task of tasks) {
      if (options.abortSignal?.aborted) break;
      task.status = 'running';
      this.emitEvent(options.onEvent, 'subagent_start', { task });

      const agent = this.subagents.get(task.assignedAgent)!;
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
        task.result = [subResult.output, !subResult.success && subResult.error ? `ข้อผิดพลาด: ${subResult.error}` : ''].filter(Boolean).join('\n');
        accumulatedContext += `\n[Output from ${agent.name} on ${task.title} (${task.status})]:\n${task.result}\n`;

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

    if (options.abortSignal?.aborted) return { success: false, goal, tasks, finalSummary: 'ยกเลิกงานแล้ว' };
    this.emitEvent(options.onEvent, 'supervisor_synthesis', { tasks });
    const synthPrompt = `You are the Lead Supervisor. All subagents have finished their assignments for goal: "${goal}".
Task outputs:
${tasks.map((t) => `- [${t.assignedAgent.toUpperCase()}] ${t.title}: ${t.status} (${t.result || 'ไม่มีผลลัพธ์'})`).join('\n')}

ตอบเป็นภาษาไทย สรุปเฉพาะงานและผลทดสอบที่เกิดขึ้นจริง ระบุงานที่ล้มเหลวหรือยังไม่ได้ทำ ห้ามอ้างว่าทุกอย่างสำเร็จหากมี task ไม่สำเร็จ.`;

    let finalSummary = '';
    try {
      const synthRes = await this.provider.generate([{ role: 'user', content: synthPrompt }]);
      finalSummary = synthRes.text;
    } catch (error: any) {
      throw new Error(`หัวหน้าทีมสรุปผลไม่สำเร็จ: ${error.message}`);
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
      if (!Array.isArray(parsed) || !parsed.length || parsed.length > 8) throw new Error('plan length');
      return parsed.map((item: any, idx: number) => {
        if (!item || !this.enabledRoles.includes(item.assignedAgent) || typeof item.instructions !== 'string' || !item.instructions.trim()) throw new Error('unknown role/instructions');
        return { id: `task_${idx + 1}`, title: String(item.title || `งาน ${idx + 1}`).slice(0,200), assignedAgent: item.assignedAgent, instructions: item.instructions.slice(0,10000), status: 'pending' as const };
      });
    } catch { throw new Error(`แผนของหัวหน้าทีมไม่ถูกต้อง ต้องเป็น JSON และมอบหมายให้ลูกทีมที่เลือกเท่านั้น (${this.enabledRoles.join(', ')}) สำหรับงาน: ${goal.slice(0,100)}`); }
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
