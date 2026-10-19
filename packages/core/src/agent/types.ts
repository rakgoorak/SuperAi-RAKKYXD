import { LLMMessage, ToolCall } from '../providers/BaseProvider.js';
import { ToolResult } from '../tools/BaseTool.js';

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  maxSteps?: number;
}

export type AgentEventType =
  | 'start'
  | 'thought'
  | 'chunk'
  | 'tool_call'
  | 'tool_result'
  | 'step'
  | 'finish'
  | 'error';

export interface AgentEvent {
  type: AgentEventType;
  agentId: string;
  agentName: string;
  step?: number;
  payload: any;
  timestamp: number;
}

export interface AgentRunOptions {
  cwd: string;
  onEvent?: (event: AgentEvent) => void;
  onStream?: (chunk: string) => void;
  abortSignal?: AbortSignal;
}

export interface AgentRunResult {
  success: boolean;
  output: string;
  stepsCount: number;
  history: LLMMessage[];
  error?: string;
}
