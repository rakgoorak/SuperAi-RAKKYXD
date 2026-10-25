import fs from 'node:fs';
import path from 'node:path';

export interface ProjectRulesResult {
  rules: string;
  files: string[];
}

const RULE_FILES = [
  '.superairules',
  '.cursorrules',
  'CLAUDE.md',
  '.antigravityrules',
  'AGENTS.md',
];

const MAX_TOTAL_CHARS = 12000;

/**
 * Searches for standard project rule / instruction files in the workspace directory.
 * Supported files: .superairules, .cursorrules, CLAUDE.md, .antigravityrules, AGENTS.md.
 */
export function getProjectRules(cwd: string): ProjectRulesResult {
  if (!cwd) return { rules: '', files: [] };
  const foundFiles: string[] = [];
  const rulesParts: string[] = [];
  let totalLength = 0;

  for (const fileName of RULE_FILES) {
    const filePath = path.join(cwd, fileName);
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        if (content) {
          foundFiles.push(fileName);
          const truncated = content.slice(0, MAX_TOTAL_CHARS - totalLength);
          rulesParts.push(`--- ${fileName} ---\n${truncated}`);
          totalLength += truncated.length;
          if (totalLength >= MAX_TOTAL_CHARS) break;
        }
      }
    } catch {
      // Ignore unreadable files
    }
  }

  return {
    rules: rulesParts.join('\n\n'),
    files: foundFiles,
  };
}

/** Formats extracted project rules into a system instruction block for AI prompts. */
export function formatRulesForPrompt(rules: string): string {
  if (!rules || !rules.trim()) return '';
  return `\n\n[Project Instructions & Rules]\n${rules.trim()}\n`;
}
