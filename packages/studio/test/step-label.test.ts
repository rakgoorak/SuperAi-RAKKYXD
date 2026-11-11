import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepLabel } from '../client/src/stepLabel.js';

test('the running step shows the first line that says what it does', () => {
  assert.equal(stepLabel("@'\nconst fs=require('node:fs');\n'@ | node -"), "const fs=require('node:fs');");
  assert.equal(stepLabel("cat > a.txt <<'EOF'\nhello\nEOF"), "cat > a.txt <<'EOF'", 'a command with its heredoc is kept');
  assert.equal(stepLabel("<<'EOF'\nhello"), 'hello');
  assert.equal(stepLabel('npm test'), 'npm test');
  assert.equal(stepLabel("@'"), "@'", 'nothing better: keep what there is');
  assert.equal(stepLabel(''), '');
  assert.equal(stepLabel('x'.repeat(300)).length, 120);
});
