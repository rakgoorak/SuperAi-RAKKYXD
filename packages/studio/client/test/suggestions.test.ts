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

test('does not invent actions from change reports or plans in any mode', () => {
  for (const mode of ['code', 'agent', 'chat'] as const) {
    for (const allowTools of [true, false]) {
      for (const output of ['แก้ไฟล์ Login.tsx เรียบร้อยแล้ว', 'แผนงานสำหรับระบบสมาชิก', 'Files changed: Login.tsx. Build passed.', 'ตรวจการแก้โค้ดแล้ว พบปัญหา 3 ข้อ']) {
        assert.deepEqual(getSuggestions({ mode, lastRun: { status: 'completed', allowTools, output } }), []);
      }
    }
  }
});

test('extracts up to three explicit options in Thai and English', () => {
  for (const heading of ['ตัวเลือก', '**ทางเลือกที่แนะนำ:**', '## Options', 'Suggested actions:']) {
    const result = completed(`${heading}\n1. แก้ปัญหาพรีวิวไฟล์\n2. เพิ่มการทดสอบระบบ\n3. ปรับหน้าจอแชต\n4. เขียนเอกสารประกอบ`);
    assert.deepEqual(result.map(item => item.label), ['แก้ปัญหาพรีวิวไฟล์', 'เพิ่มการทดสอบระบบ', 'ปรับหน้าจอแชต']);
  }
});

test('shows only the offered number of choices', () => {
  assert.equal(completed('## ตัวเลือก\n- ทดสอบหน้าเข้าสู่ระบบ').length, 1);
  assert.equal(completed('## ตัวเลือก\n- ทดสอบหน้าเข้าสู่ระบบ\n- เพิ่มกรณีรหัสผ่านผิด').length, 2);
});

test('keeps three conversational offers instead of discarding the first', () => {
  const result = completed('ผมสามารถเพิ่มการทดสอบระบบ\nผมสามารถตรวจการเข้าถึงหน้าเว็บ\nผมสามารถเขียนเอกสารประกอบ');
  assert.deepEqual(result.map(item => item.label), ['เพิ่มการทดสอบระบบ', 'ตรวจการเข้าถึงหน้าเว็บ', 'เขียนเอกสารประกอบ']);
});

test('stops options before another bold section and ignores ordinary lists', () => {
  assert.deepEqual(completed('## ผลทดสอบ\n- Build ผ่าน\n- พบปัญหาพรีวิวไฟล์'), []);
  const result = completed('**ตัวเลือก**\n- เพิ่มการทดสอบระบบ\n\n**ผลทดสอบ**\n- Build ผ่าน');
  assert.deepEqual(result.map(item => item.label), ['เพิ่มการทดสอบระบบ']);
});
