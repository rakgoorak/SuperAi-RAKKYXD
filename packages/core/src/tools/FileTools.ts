import fs from 'node:fs/promises';
import path from 'node:path';
import { BaseTool, ExecutionContext, ToolResult } from './BaseTool.js';

export class ViewFileTool extends BaseTool {
  name = 'view_file';
  description = 'Read the contents of a file with optional line range slicing (1-indexed).';
  parameters = {
    type: 'object' as const,
    properties: {
      filePath: { type: 'string', description: 'Absolute or relative path to the file.' },
      startLine: { type: 'number', description: 'Optional 1-indexed start line.' },
      endLine: { type: 'number', description: 'Optional 1-indexed end line.' },
    },
    required: ['filePath'],
  };

  async execute(
    args: { filePath: string; startLine?: number; endLine?: number },
    context: ExecutionContext
  ): Promise<ToolResult> {
    const fullPath = path.isAbsolute(args.filePath)
      ? args.filePath
      : path.join(context.cwd, args.filePath);

    try {
      const raw = await fs.readFile(fullPath, 'utf-8');
      const lines = raw.split('\n');
      const MAX_VIEW_LINES = 500;
      const start = Math.max(1, args.startLine ?? 1);
      const requestedEnd = args.endLine ?? lines.length;
      const end = Math.min(lines.length, requestedEnd, start + MAX_VIEW_LINES - 1);
      const truncated = requestedEnd > end || (start + MAX_VIEW_LINES - 1 < lines.length && args.endLine === undefined);

      let sliced = lines
        .slice(start - 1, end)
        .map((line, idx) => `${start + idx}: ${line}`)
        .join('\n');

      if (truncated) {
        sliced += `\n[... Showing lines ${start}-${end} of ${lines.length}. Specify startLine=${end + 1} to inspect more lines ...]`;
      }

      return {
        success: true,
        output: sliced,
        metadata: { totalLines: lines.length, startLine: start, endLine: end, truncated },
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: `Failed to read file "${args.filePath}": ${err.message}`,
      };
    }
  }
}

export class WriteFileTool extends BaseTool {
  name = 'write_file';
  description = 'Create or overwrite a file with the given content. Creates parent directories automatically.';
  parameters = {
    type: 'object' as const,
    properties: {
      filePath: { type: 'string', description: 'Path to target file.' },
      content: { type: 'string', description: 'Content to write.' },
    },
    required: ['filePath', 'content'],
  };

  async execute(
    args: { filePath: string; content: string },
    context: ExecutionContext
  ): Promise<ToolResult> {
    const fullPath = path.isAbsolute(args.filePath)
      ? args.filePath
      : path.join(context.cwd, args.filePath);

    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, args.content, 'utf-8');
      return {
        success: true,
        output: `Successfully wrote ${Buffer.byteLength(args.content, 'utf-8')} bytes to ${args.filePath}`,
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: `Failed to write file "${args.filePath}": ${err.message}`,
      };
    }
  }
}

export class ReplaceFileContentTool extends BaseTool {
  name = 'replace_file_content';
  description = 'Replace an exact contiguous block of text in an existing file.';
  parameters = {
    type: 'object' as const,
    properties: {
      filePath: { type: 'string', description: 'Path to target file.' },
      targetContent: { type: 'string', description: 'Exact string to be replaced.' },
      replacementContent: { type: 'string', description: 'New string to insert.' },
      allowMultiple: { type: 'boolean', description: 'Allow replacing multiple occurrences.' },
    },
    required: ['filePath', 'targetContent', 'replacementContent'],
  };

  async execute(
    args: { filePath: string; targetContent: string; replacementContent: string; allowMultiple?: boolean },
    context: ExecutionContext
  ): Promise<ToolResult> {
    const fullPath = path.isAbsolute(args.filePath)
      ? args.filePath
      : path.join(context.cwd, args.filePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const occurrences = content.split(args.targetContent).length - 1;

      if (occurrences === 0) {
        return {
          success: false,
          output: '',
          error: `Target content not found in "${args.filePath}". Ensure exact whitespace and linebreaks match.`,
        };
      }

      if (occurrences > 1 && !args.allowMultiple) {
        return {
          success: false,
          output: '',
          error: `Target content occurs ${occurrences} times in "${args.filePath}". Specify a larger unique block or set allowMultiple=true.`,
        };
      }

      const updated = args.allowMultiple
        ? content.split(args.targetContent).join(args.replacementContent)
        : content.replace(args.targetContent, args.replacementContent);

      await fs.writeFile(fullPath, updated, 'utf-8');
      return {
        success: true,
        output: `Successfully replaced ${occurrences} occurrence(s) in ${args.filePath}.`,
      };
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: `Failed to edit "${args.filePath}": ${err.message}`,
      };
    }
  }
}

export class GlobSearchTool extends BaseTool {
  name = 'glob_search';
  description = 'Find files matching a glob pattern relative to the current workspace.';
  parameters = {
    type: 'object' as const,
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g. "**/*.ts", "src/**/*.json").' },
    },
    required: ['pattern'],
  };

  async execute(args: { pattern: string }, context: ExecutionContext): Promise<ToolResult> {
    const baseDir = context.cwd;
    const matches: string[] = [];

    async function walk(dir: string, rel: string) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
        const entryFull = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walk(entryFull, entryRel);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (args.pattern.endsWith(ext) || args.pattern.includes('*')) {
            matches.push(entryRel);
          }
        }
      }
    }

    await walk(baseDir, '');
    return {
      success: true,
      output: matches.length > 0 ? matches.join('\n') : 'No matching files found.',
      metadata: { count: matches.length, files: matches },
    };
  }
}

export class GrepSearchTool extends BaseTool {
  name = 'grep_search';
  description = 'Search for text or regex across files in the workspace.';
  parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Text or regex pattern to search for.' },
      extension: { type: 'string', description: 'Optional file extension filter (e.g. ".ts", ".js").' },
    },
    required: ['query'],
  };

  async execute(
    args: { query: string; extension?: string },
    context: ExecutionContext
  ): Promise<ToolResult> {
    const baseDir = context.cwd;
    const results: string[] = [];
    const regex = new RegExp(args.query, 'i');

    async function walk(dir: string, rel: string) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
        const entryFull = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walk(entryFull, entryRel);
        } else if (entry.isFile()) {
          if (args.extension && !entry.name.endsWith(args.extension)) continue;
          try {
            const content = await fs.readFile(entryFull, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (regex.test(line)) {
                results.push(`${entryRel}:${idx + 1}: ${line.trim()}`);
              }
            });
          } catch {}
        }
      }
    }

    await walk(baseDir, '');
    return {
      success: true,
      output: results.length > 0 ? results.slice(0, 100).join('\n') : `No matches found for "${args.query}".`,
      metadata: { totalMatches: results.length },
    };
  }
}
