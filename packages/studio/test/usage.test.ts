import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClaudeUsage, parseCodexRateLimits, parseAntigravityUsage, parseOpenCodeStats, UsageManager } from '../server/UsageManager.js';

test('Claude /usage text becomes 5-hour and weekly remaining percentages', () => {
  const text = `You are currently using your subscription to power your Claude Code usage

Current session: 53% used · resets Oct 21, 5:59pm (Asia/Bangkok)
Current week (all models): 64% used · resets Oct 24, 8:59am (Asia/Bangkok)
Current week (Opus): 10% used · resets Oct 24, 8:59am (Asia/Bangkok)

Last 24h · 319 requests · 6 sessions`;
  const w = parseClaudeUsage(text);
  assert.deepEqual(w.map(x => [x.label, x.remainingPercent]), [['5 ชั่วโมง', 47], ['รายสัปดาห์ (ทุกรุ่น)', 36], ['รายสัปดาห์ (Opus)', 90]]);
  assert.equal(w[0].resetsText, 'Oct 21, 5:59pm (Asia/Bangkok)');
  assert.deepEqual(parseClaudeUsage('Please log in'), []);
});

test('Codex rate limits come from the newest token_count event and honour resets', () => {
  const future = Math.floor(Date.now() / 1000) + 3600, past = Math.floor(Date.now() / 1000) - 60;
  const event = (p: number, s: number, ps: number) => JSON.stringify({ timestamp: '2026-10-21T06:00:00Z', type: 'event_msg', payload: { type: 'token_count', rate_limits: {
    limit_id: 'codex', primary: { used_percent: p, window_minutes: 300, resets_at: ps }, secondary: { used_percent: s, window_minutes: 10080, resets_at: future } } } });
  const r = parseCodexRateLimits(['{"type":"other"}', event(5, 5, future), event(16, 18, future)])!;
  assert.deepEqual(r.windows.map(x => [x.label, x.remainingPercent]), [['5 ชั่วโมง', 84], ['รายสัปดาห์', 82]]);
  assert.equal(r.at, Date.parse('2026-10-21T06:00:00Z'));
  const reset = parseCodexRateLimits([event(90, 18, past)])!;
  assert.equal(reset.windows[0].remainingPercent, 100);
  assert.equal(reset.windows[0].note, 'รีเซ็ตแล้ว');
  assert.equal(parseCodexRateLimits(['{"type":"x"}']), null);
});

test('Codex rate limits detect usage_limit_exceeded error events and extract reset time', () => {
  const errorEvent = JSON.stringify({
    timestamp: '2026-10-25T15:30:37.676Z',
    type: 'event_msg',
    payload: {
      type: 'task_complete',
      error: {
        message: "Error running remote compact task: You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/settings/usage to purchase more credits or try again at Oct 26th, 2026 12:02 AM.",
        codex_error_info: 'usage_limit_exceeded'
      }
    }
  });
  const r = parseCodexRateLimits([errorEvent])!;
  assert.equal(r.windows[0].remainingPercent, 0);
  assert.equal(r.windows[0].note, 'โควตาเต็ม รอรอบรีเซ็ต');
  assert.equal(r.windows[0].resetsAt, new Date('Oct 26, 2026 12:02 AM').toISOString());
  assert.equal(r.at, Date.parse('2026-10-25T15:30:37.676Z'));
});

test('Antigravity /usage rows keep model groups and mark disabled windows', () => {
  const text = [
    'Gemini Models\tWeekly Limit Remaining\t74%\t2026-10-24T01:07:54Z',
    'Gemini Models\tFive Hour Limit Remaining\t99%\t2026-10-21T08:01:33Z',
    'Claude and GPT models\tWeekly Limit Remaining\t0%\t2026-10-24T18:06:27Z',
    'Claude and GPT models\tFive Hour Limit Remaining\tdisabled\t',
  ].join('\n');
  const w = parseAntigravityUsage(text);
  assert.deepEqual(w.map(x => [x.group, x.label, x.remainingPercent]), [
    ['Gemini Models', 'รายสัปดาห์', 74], ['Gemini Models', '5 ชั่วโมง', 99], ['Claude and GPT models', 'รายสัปดาห์', 0], ['Claude and GPT models', '5 ชั่วโมง', null]]);
  assert.equal(w[3].note, 'ไม่ได้เปิดใช้');
  assert.equal(w[0].resetsAt, '2026-10-24T01:07:54.000Z');
});

test('OpenCode stats table rows are read as usage details', () => {
  const text = '│Sessions                                             23 │\n│Total Cost                                        $0.00 │\n│Input                                              1.3M │\n│Output                                           109.5K │';
  assert.deepEqual(parseOpenCodeStats(text).map(d => d.value), ['23', '$0.00', '1.3M', '109.5K']);
});

test('usage results are cached, de-duplicated and report missing CLIs and failures', async () => {
  let calls = 0;
  const manager = new UsageManager({
    'claude-code': async () => { calls++; await new Promise(r => setTimeout(r, 20)); return { status: 'ok', windows: [], source: 't' }; },
    codex: async () => { throw new Error('spawn ETIMEDOUT'); },
    antigravity: async () => ({ status: 'ok', windows: [], source: 't' }),
    opencode: async () => ({ status: 'unsupported', windows: [], source: 't' }),
    freebuff: async () => ({ status: 'unsupported', windows: [], source: 't' }),
  } as any, (id) => id !== 'antigravity');
  await Promise.all([manager.get('claude-code'), manager.get('claude-code')]);
  await manager.get('claude-code');
  assert.equal(calls, 1);
  await manager.get('claude-code', true);
  assert.equal(calls, 2);
  assert.match((await manager.get('codex')).note!, /ช้าเกินไป/);
  assert.equal((await manager.get('antigravity')).status, 'not-installed');
});
