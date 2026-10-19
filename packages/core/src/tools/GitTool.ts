import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseTool, ExecutionContext, ToolResult } from './BaseTool.js';

const execAsync = promisify(exec);

export interface GitArgs {
  action: 'status' | 'diff' | 'commit' | 'branch' | 'create_worktree' | 'remove_worktree';
  message?: string;
  path?: string;
  branchName?: string;
}

export class GitTool extends BaseTool {
  name = 'git';
  description = 'Perform git operations including status, diff, commit, and isolated worktrees for subagents.';
  parameters = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'diff', 'commit', 'branch', 'create_worktree', 'remove_worktree'],
        description: 'Git operation to perform.',
      },
      message: { type: 'string', description: 'Commit message for "commit" action.' },
      path: { type: 'string', description: 'Worktree path for "create_worktree" or "remove_worktree".' },
      branchName: { type: 'string', description: 'Branch name for worktree or branch creation.' },
    },
    required: ['action'],
  };

  async execute(args: GitArgs, context: ExecutionContext): Promise<ToolResult> {
    const cwd = context.cwd || process.cwd();

    try {
      switch (args.action) {
        case 'status': {
          const { stdout } = await execAsync('git status --short', { cwd });
          return {
            success: true,
            output: stdout.trim() || 'Working tree clean (no changes).',
          };
        }

        case 'diff': {
          const { stdout } = await execAsync('git diff', { cwd });
          return {
            success: true,
            output: stdout.trim() || 'No unstaged diffs.',
          };
        }

        case 'commit': {
          if (!args.message) {
            return { success: false, output: '', error: 'Commit message required.' };
          }
          await execAsync('git add -A', { cwd });
          const { stdout } = await execAsync(`git commit -m "${args.message.replace(/"/g, '\\"')}"`, { cwd });
          return { success: true, output: stdout.trim() };
        }

        case 'branch': {
          const { stdout } = await execAsync('git branch --show-current', { cwd });
          return { success: true, output: `Current branch: ${stdout.trim()}` };
        }

        case 'create_worktree': {
          if (!args.path || !args.branchName) {
            return { success: false, output: '', error: 'path and branchName required for create_worktree.' };
          }
          const { stdout } = await execAsync(
            `git worktree add -b ${args.branchName} "${args.path}"`,
            { cwd }
          );
          return { success: true, output: stdout.trim() || `Worktree created at ${args.path}` };
        }

        case 'remove_worktree': {
          if (!args.path) {
            return { success: false, output: '', error: 'path required for remove_worktree.' };
          }
          const { stdout } = await execAsync(`git worktree remove --force "${args.path}"`, { cwd });
          return { success: true, output: stdout.trim() || `Worktree removed from ${args.path}` };
        }

        default:
          return { success: false, output: '', error: `Unsupported git action: ${(args as any).action}` };
      }
    } catch (err: any) {
      return {
        success: false,
        output: '',
        error: `Git error: ${err.message}`,
      };
    }
  }
}
