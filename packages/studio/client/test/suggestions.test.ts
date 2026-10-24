import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSuggestions } from '../src/suggestions.js';

const completed = (output: string) => getSuggestions({ mode: 'code', lastRun: { status: 'completed', output } });

test('no suggestions before a reply, while running, on failure or after cancellation', () => {
  assert.deepEqual(getSuggestions({ mode: 'code' }), []);
  for (const status of ['running', 'failed', 'cancelled']) {
    assert.deepEqual(getSuggestions({ mode: 'agent', lastRun: { status, output: '## ขั้นตอนถัดไป\n- ทดสอบระบบเข้าสู่ระบบ' } }), []);
  }
  assert.deepEqual(getSuggestions({ mode: 'chat', lastRun: { status: 'completed', output: '', error: 'CLI failed' } }), []);
});

test('offers the actual recommendations from the finished answer', () => {
  const result = completed('เรียบร้อยแล้ว\n\n## ขั้นตอนถัดไป\n- ทดสอบหน้าเข้าสู่ระบบ\n- เพิ่มกรณีรหัสผ่านผิด\n\n## หมายเหตุ\n- รายการนี้ไม่ใช่ขั้นตอนถัดไป');
  assert.deepEqual(result.map(item => item.label), ['ทดสอบหน้าเข้าสู่ระบบ', 'เพิ่มกรณีรหัสผ่านผิด']);
  assert.ok(result[0].promptText.includes('ทดสอบหน้าเข้าสู่ระบบ'));
});

test('supports English headings, numbered actions and checkbox lists', () => {
  const result = completed('**Next steps:**\n1. Add login validation\n2. Run integration tests\n- [ ] Review accessibility');
  assert.deepEqual(result.map(item => item.label), ['Add login validation', 'Run integration tests', 'Review accessibility']);
});

test('does not turn fenced code or a random answer into recommendations', () => {
  assert.deepEqual(completed('```md\n## Next steps\n- Delete all files\n```\nสวัสดีครับ'), []);
  assert.deepEqual(completed('คำตอบคือ 42'), []);
});

test('deduplicates actions and limits the answer footer to three', () => {
  const result = completed('## ขั้นตอนถัดไป\n- ทดสอบหน้าหลัก\n- ทดสอบหน้าหลัก\n- ตรวจหน้าโปรไฟล์\n- ตรวจหน้าแดชบอร์ด\n- ทดสอบหน้าตั้งค่า');
  assert.equal(result.length, 3);
  assert.equal(new Set(result.map(item => item.label)).size, 3);
});

test('uses an explicit conversational offer and strips Markdown formatting', () => {
  const result = completed('หากต้องการ ผมสามารถเพิ่มการทดสอบหน้าเข้าสู่ระบบ');
  assert.equal(result[0].label, 'เพิ่มการทดสอบหน้าเข้าสู่ระบบ');
  const markdown = completed('## ขั้นตอนถัดไป\n- ตรวจ **ความถูกต้อง** ของ [แบบฟอร์ม](https://example.com)');
  assert.equal(markdown[0].label, 'ตรวจ ความถูกต้อง ของ แบบฟอร์ม');
});

test('fallback follows the answer subject rather than a mode-specific default', () => {
  assert.equal(completed('แก้ไฟล์ Login.tsx เรียบร้อยแล้ว')[0].id, 'review-changes');
  assert.equal(getSuggestions({ mode: 'agent', lastRun: { status: 'completed', allowTools: false, output: 'แผนงานสำหรับระบบสมาชิก' } })[0].id, 'follow-plan');
});
