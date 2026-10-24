import test from 'node:test';
import assert from 'node:assert/strict';
import { orderUsageWindows, usageResetLabel, type UsageWindow } from '../src/usageDisplay';

test('provider windows use the same order without changing the raw data or model scopes', () => {
  const windows: UsageWindow[] = [
    { label: 'รายสัปดาห์ (ทุกรุ่น)', group: 'Gemini Models', remainingPercent: 81 },
    { label: '5 ชั่วโมง', group: 'Gemini Models', remainingPercent: null, note: 'ไม่ได้เปิดใช้' },
    { label: 'รายสัปดาห์ (Opus)', group: 'Gemini Models', remainingPercent: 20 },
  ];
  assert.deepEqual(orderUsageWindows(windows).map(w => w.label), ['5 ชั่วโมง', 'รายสัปดาห์ (ทุกรุ่น)', 'รายสัปดาห์ (Opus)']);
  assert.equal(windows[0].label, 'รายสัปดาห์ (ทุกรุ่น)');
  assert.equal(orderUsageWindows(windows)[0].remainingPercent, null);
  assert.equal(orderUsageWindows(windows)[0].group, 'Gemini Models');
});

test('Claude text and ISO reset times produce identical date/time presentation', () => {
  const common = { label: '5 ชั่วโมง', remainingPercent: 98 };
  const now = Date.parse('2026-10-24T17:00:00Z');
  const iso = usageResetLabel({ ...common, resetsAt: '2026-10-24T21:00:00Z' }, now, 'Asia/Bangkok');
  const claude = usageResetLabel({ ...common, resetsText: 'Oct 25, 4am (Asia/Bangkok)' }, now, 'Asia/Bangkok');
  assert.equal(iso, 'รีเซ็ต: 25 ต.ค. 04:00 (Asia/Bangkok)');
  assert.equal(claude, iso);
  assert.equal(usageResetLabel({ ...common, resetsText: 'Oct 25, 12:30pm (America/New_York)' }, now, 'Asia/Bangkok'), 'รีเซ็ต: 25 ต.ค. 12:30 (America/New_York)');
  assert.equal(usageResetLabel({ ...common, resetsText: 'Oct 25, 12am (Asia/Bangkok)' }), 'รีเซ็ต: 25 ต.ค. 00:00 (Asia/Bangkok)');
});

test('past, missing and unknown dates do not fabricate reset times', () => {
  const common = { label: 'รายสัปดาห์', remainingPercent: 59 };
  assert.equal(usageResetLabel({ ...common, resetsAt: '2026-10-01T00:00:00Z' }, Date.parse('2026-10-25T00:00:00Z')), 'รีเซ็ตแล้ว');
  assert.equal(usageResetLabel(common), '');
  assert.equal(usageResetLabel({ ...common, resetsAt: 'bad', resetsText: 'provider-specific value' }), 'รีเซ็ต: provider-specific value');
});
