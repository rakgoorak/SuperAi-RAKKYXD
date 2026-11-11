import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { cliEnv, findExecutable } from './CliCatalog.js';
import { Seat, validateSeat } from './Providers.js';
import { CliProvider } from './CliProvider.js';
import { LocalProvider } from './AgentRunManager.js';
import { createProvider, LLMMessage } from '@superai-rakkyxd/core';

const execAsync = promisify(execFile);

export interface ReviewIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  file: string;
  line?: number;
  title: string;
  description: string;
  suggestedFix?: string;
}

export interface CrossReviewResult {
  reviewer: Seat;
  authorProvider: string;
  verdict: 'approved' | 'changes_requested' | 'needs_discussion';
  score: number;
  summary: string;
  issues: ReviewIssue[];
  reviewedAt: number;
  diffStats: {
    filesChanged: number;
    diffSnippet: string;
  };
}

export const REVIEWER_SYSTEM_PROMPT = `You are a Principal Security & Software Architecture Reviewer.
Your task is to conduct an independent, adversarial code review of recent code changes created by another AI provider.
You must be thorough, objective, and constructive.

Analyze the diff for:
1. Critical Blockers: Syntax errors, unhandled exceptions, null dereferences, security vulnerabilities (injection, auth bypass, CSRF, path traversal), data corruption, breaking changes.
2. Warnings: Logic bugs, race conditions, memory leaks, missing validation, unexpected edge cases, unhandled errors.
3. Suggestions: Code clarity, algorithmic optimizations, idiomatic patterns, architectural hygiene.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "summary": "Concise 1-2 sentence overall evaluation of the changes",
  "verdict": "approved" | "changes_requested" | "needs_discussion",
  "score": <0 to 100 integer representing code quality and safety>,
  "issues": [
    {
      "severity": "critical" | "warning" | "suggestion",
      "file": "path/to/file",
      "line": <line number integer or null>,
      "title": "Short title of the finding",
      "description": "Clear explanation of the problem and why it matters",
      "suggestedFix": "Concrete code snippet or recommended replacement"
    }
  ]
}

If the code is clean, safe, and of high quality, verdict should be "approved", score >= 85, and issues can be empty or only have minor suggestions.
Do not output markdown code blocks around the JSON if possible, just the JSON string.`;

export class CrossReviewManager {
  /**
   * Retrieves the current git diff of working changes in the workspace.
   */
  async getWorkingDiff(cwd: string, targetFile?: string): Promise<{ diff: string; filesChanged: number }> {
    const gitBin = findExecutable('git') || 'git';
    try {
      const args = targetFile
        ? ['diff', '--no-ext-diff', '--no-textconv', 'HEAD', '--', targetFile]
        : ['diff', '--no-ext-diff', '--no-textconv', 'HEAD'];

      const { stdout } = await execAsync(gitBin, args, {
        cwd,
        env: { ...process.env, ...cliEnv() },
        timeout: 10000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      });

      let diff = stdout.trim();
      // If HEAD diff is empty, also check untracked / cached
      if (!diff) {
        const cached = await execAsync(gitBin, ['diff', '--cached'], { cwd, timeout: 5000, windowsHide: true }).catch(() => ({ stdout: '' }));
        diff = cached.stdout.trim();
      }

      const files = [...new Set(diff.match(/^diff --git a\/(.+?) b\//gm) || [])];
      return {
        diff,
        filesChanged: files.length || (diff ? 1 : 0),
      };
    } catch {
      return { diff: '', filesChanged: 0 };
    }
  }

  /**
   * Automatically select an independent reviewer from a different provider family.
   */
  selectReviewer(authorProvider: string, preferredReviewer?: Seat): Seat {
    if (preferredReviewer) return preferredReviewer;

    const normAuthor = authorProvider.replace(/^cli:/, '').toLowerCase();

    // Mapping of best alternative reviewers
    if (normAuthor === 'claude-code') {
      return { name: 'Codex Reviewer', provider: 'cli:codex', model: '', effort: 'medium' };
    }
    if (normAuthor === 'codex') {
      return { name: 'Claude Reviewer', provider: 'cli:claude-code', model: '', effort: 'medium' };
    }
    if (normAuthor === 'antigravity') {
      return { name: 'Claude Reviewer', provider: 'cli:claude-code', model: '', effort: 'medium' };
    }
    if (normAuthor === 'opencode') {
      return { name: 'Claude Reviewer', provider: 'cli:claude-code', model: '', effort: 'medium' };
    }

    // Default to Claude Code or Codex
    return { name: 'Independent Reviewer', provider: 'cli:codex', model: '', effort: '' };
  }

  /**
   * Parse reviewer LLM output into structured CrossReviewResult.
   */
  parseReview(rawOutput: string, reviewer: Seat, authorProvider: string, filesChanged: number, diffSnippet: string): CrossReviewResult {
    let text = rawOutput.trim();
    // Strip markdown code fences if present
    text = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

    try {
      // Find JSON object boundaries
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonStr = text.slice(start, end + 1);
        const parsed = JSON.parse(jsonStr);

        const verdict = ['approved', 'changes_requested', 'needs_discussion'].includes(parsed.verdict)
          ? parsed.verdict
          : (parsed.score >= 80 ? 'approved' : 'changes_requested');

        const score = Number.isInteger(parsed.score) ? Math.min(100, Math.max(0, parsed.score)) : 80;

        const issues: ReviewIssue[] = Array.isArray(parsed.issues)
          ? parsed.issues.map((iss: any) => ({
              severity: ['critical', 'warning', 'suggestion'].includes(iss.severity) ? iss.severity : 'warning',
              file: String(iss.file || ''),
              line: Number.isInteger(iss.line) ? iss.line : undefined,
              title: String(iss.title || 'Review Item'),
              description: String(iss.description || ''),
              suggestedFix: iss.suggestedFix ? String(iss.suggestedFix) : undefined,
            }))
          : [];

        return {
          reviewer,
          authorProvider,
          verdict,
          score,
          summary: String(parsed.summary || 'Code review completed.'),
          issues,
          reviewedAt: Date.now(),
          diffStats: {
            filesChanged,
            diffSnippet: diffSnippet.slice(0, 4000),
          },
        };
      }
    } catch {}

    // Fallback parser if output is plain text
    return {
      reviewer,
      authorProvider,
      verdict: text.toLowerCase().includes('reject') || text.toLowerCase().includes('error') ? 'changes_requested' : 'approved',
      score: 75,
      summary: text.slice(0, 300),
      issues: [
        {
          severity: 'warning',
          file: '',
          title: 'Reviewer Comments',
          description: text.slice(0, 2000),
        },
      ],
      reviewedAt: Date.now(),
      diffStats: {
        filesChanged,
        diffSnippet: diffSnippet.slice(0, 4000),
      },
    };
  }

  /**
   * Run an adversarial code review on the workspace changes.
   */
  async executeReview(options: {
    cwd: string;
    authorProvider: string;
    reviewer?: Seat;
    customDiff?: string;
    targetFile?: string;
  }): Promise<CrossReviewResult> {
    const reviewer = validateSeat(this.selectReviewer(options.authorProvider, options.reviewer));
    const { diff, filesChanged } = options.customDiff !== undefined
      ? { diff: options.customDiff, filesChanged: 1 }
      : await this.getWorkingDiff(options.cwd, options.targetFile);

    if (!diff.trim()) {
      return {
        reviewer,
        authorProvider: options.authorProvider,
        verdict: 'approved',
        score: 100,
        summary: 'ไม่พบการเปลี่ยนแปลงของไฟล์ในโปรเจกต์ (ไม่มี Diff ให้ตรวจสอบ)',
        issues: [],
        reviewedAt: Date.now(),
        diffStats: { filesChanged: 0, diffSnippet: '' },
      };
    }

    const reviewPrompt = `Please review these git diff changes authored by ${options.authorProvider}:\n\n` +
      `\`\`\`diff\n${diff.slice(0, 28000)}\n\`\`\`\n\n` +
      `Provide your strict assessment in JSON format as specified.`;

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 90000);

    try {
      let rawResponse = '';
      if (reviewer.provider.startsWith('cli:')) {
        const cliId = reviewer.provider.slice(4);
        const cliProvider = new CliProvider(cliId, options.cwd, ac.signal, false, reviewer.model, false, [], reviewer.effort || '', undefined, undefined, reviewer.accountId || 'system');
        const result = await cliProvider.generate([
          { role: 'system', content: REVIEWER_SYSTEM_PROMPT },
          { role: 'user', content: reviewPrompt },
        ]);
        rawResponse = result.text;
      } else if (reviewer.provider.startsWith('ollama:') || !reviewer.provider.includes(':')) {
        const model = reviewer.provider.replace(/^ollama:/, '');
        const local = new LocalProvider(model || 'qwen2.5-coder', ac.signal);
        const result = await local.generate([
          { role: 'system', content: REVIEWER_SYSTEM_PROMPT },
          { role: 'user', content: reviewPrompt },
        ]);
        rawResponse = result.text;
      } else {
        const provider = createProvider({
          provider: reviewer.provider as any,
          model: reviewer.model,
        });
        const result = await provider.generate([
          { role: 'system', content: REVIEWER_SYSTEM_PROMPT },
          { role: 'user', content: reviewPrompt },
        ]);
        rawResponse = result.text;
      }

      return this.parseReview(rawResponse, reviewer, options.authorProvider, filesChanged, diff);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Formats review issues into an actionable prompt for the author agent to apply fixes.
   */
  formatApplyPrompt(review: CrossReviewResult): string {
    const criticals = review.issues.filter(i => i.severity === 'critical');
    const warnings = review.issues.filter(i => i.severity === 'warning');
    const suggestions = review.issues.filter(i => i.severity === 'suggestion');

    let prompt = `[AI Cross-Review จาก ${review.reviewer.name}]\n` +
      `ผลการตรวจทานโค้ด (คะแนนความปลอดภัย: ${review.score}/100, สถานะ: ${review.verdict})\n` +
      `สรุป: ${review.summary}\n\n` +
      `กรุณาแก้ไขปัญหาตามผลการตรวจทานดังนี้:\n`;

    const allIssues = [...criticals, ...warnings, ...suggestions];
    allIssues.forEach((issue, idx) => {
      prompt += `\n${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.title}`;
      if (issue.file) prompt += ` (ไฟล์: ${issue.file}${issue.line ? `:${issue.line}` : ''})`;
      prompt += `\n   รายละเอียด: ${issue.description}`;
      if (issue.suggestedFix) {
        prompt += `\n   แนวทางแก้ไขที่แนะนำ:\n\`\`\`\n${issue.suggestedFix}\n\`\`\``;
      }
    });

    prompt += `\n\nโปรดแก้ไขไฟล์โค้ดตามคำแนะนำข้างต้นให้เรียบร้อยและรันการทดสอบเพื่อให้แน่ใจว่าไม่มีข้อผิดพลาด`;
    return prompt;
  }
}
