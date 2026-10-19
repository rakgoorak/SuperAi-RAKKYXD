export * from './BaseTool.js';
export * from './BashTool.js';
export * from './FileTools.js';
export * from './GitTool.js';

import { BashTool } from './BashTool.js';
import {
  ViewFileTool,
  WriteFileTool,
  ReplaceFileContentTool,
  GlobSearchTool,
  GrepSearchTool,
} from './FileTools.js';
import { GitTool } from './GitTool.js';
import { ToolDefinition } from './BaseTool.js';

export function createDefaultTools(): ToolDefinition[] {
  return [
    new BashTool(),
    new ViewFileTool(),
    new WriteFileTool(),
    new ReplaceFileContentTool(),
    new GlobSearchTool(),
    new GrepSearchTool(),
    new GitTool(),
  ];
}
