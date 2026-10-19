export interface ExecutionContext {
  cwd: string;
  onStream?: (chunk: string) => void;
  env?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute(args: any, context: ExecutionContext): Promise<ToolResult>;
}

export abstract class BaseTool implements ToolDefinition {
  abstract name: string;
  abstract description: string;
  abstract parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };

  abstract execute(args: any, context: ExecutionContext): Promise<ToolResult>;
}
