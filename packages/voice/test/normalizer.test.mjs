import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeThaiTech } from '../thai_normalizer.mjs';

test('normalizeThaiTech transforms spoken Thai tech vocabulary into code syntax', () => {
  const input = 'สร้าง คอมโพเนนต์ ใน รีแอกต์ แล้วรัน เอ็นพีเอ็ม รัน เทสต์';
  const output = normalizeThaiTech(input);
  assert.equal(output.includes('component'), true);
  assert.equal(output.includes('React'), true);
  assert.equal(output.includes('npm run test'), true);
});

test('normalizeThaiTech transforms git commands and CLI tools', () => {
  const input = 'กิต สเตตัส แล้ว กิต คอมมิต ขีดเอ็ม และ กิต พุช';
  const output = normalizeThaiTech(input);
  assert.equal(output.includes('git status'), true);
  assert.equal(output.includes('git commit'), true);
  assert.equal(output.includes('git push'), true);
});

test('normalizeThaiTech transforms punctuation and file extensions', () => {
  const input = 'ไฟล์ อินเด็กซ์ จุด ทีเอสเอ็กซ์';
  const output = normalizeThaiTech(input);
  assert.equal(output.includes('.tsx'), true);
});

test('normalizeThaiTech preserves non-tech Thai text when techMode is false', () => {
  const input = 'สวัสดีครับวันนี้อากาศดีมาก';
  const output = normalizeThaiTech(input, { techMode: false, punctuationMode: false });
  assert.equal(output, input);
});
