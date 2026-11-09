import test from 'node:test';
import assert from 'node:assert/strict';
import { CrossReviewManager } from '../server/CrossReviewManager.js';
import { Seat } from '../server/Providers.js';

test('CrossReviewManager: selectReviewer picks an independent provider family', () => {
  const manager = new CrossReviewManager();

  const forClaude = manager.selectReviewer('claude-code');
  assert.equal(forClaude.provider, 'cli:codex');

  const forCodex = manager.selectReviewer('codex');
  assert.equal(forCodex.provider, 'cli:claude-code');

  const forAntigravity = manager.selectReviewer('antigravity');
  assert.equal(forAntigravity.provider, 'cli:claude-code');

  const custom: Seat = { name: 'DeepSeek', provider: 'deepseek', model: 'deepseek-reasoner', effort: '' };
  const customPicked = manager.selectReviewer('claude-code', custom);
  assert.equal(customPicked.provider, 'deepseek');
});

test('CrossReviewManager: parseReview handles structured JSON and fallback formatting', () => {
  const manager = new CrossReviewManager();
  const reviewer: Seat = { name: 'Codex Reviewer', provider: 'cli:codex', model: '', effort: '' };

  // 1. Markdown code block with JSON
  const mockJson = `
Here is my review:
\`\`\`json
{
  "summary": "Found an unhandled exception in token authentication",
  "verdict": "changes_requested",
  "score": 65,
  "issues": [
    {
      "severity": "critical",
      "file": "src/auth.ts",
      "line": 42,
      "title": "Missing null check on bearer header",
      "description": "If authorization header is missing, split(' ')[1] throws TypeError",
      "suggestedFix": "const token = req.headers.authorization?.split(' ')[1];"
    }
  ]
}
\`\`\`
  `;

  const review = manager.parseReview(mockJson, reviewer, 'claude-code', 1, 'mock diff');
  assert.equal(review.verdict, 'changes_requested');
  assert.equal(review.score, 65);
  assert.equal(review.issues.length, 1);
  assert.equal(review.issues[0].severity, 'critical');
  assert.equal(review.issues[0].file, 'src/auth.ts');
  assert.equal(review.issues[0].line, 42);

  // 2. formatApplyPrompt formats issues clearly for author agent
  const applyPrompt = manager.formatApplyPrompt(review);
  assert.match(applyPrompt, /AI Cross-Review จาก Codex Reviewer/);
  assert.match(applyPrompt, /CRITICAL/);
  assert.match(applyPrompt, /Missing null check/);
  assert.match(applyPrompt, /const token = req\.headers\.authorization/);
});
