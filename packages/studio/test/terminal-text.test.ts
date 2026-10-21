import test from 'node:test';
import assert from 'node:assert/strict';
import { bufferText, loadTerminalThaiFont, type TextBuffer } from '../client/src/terminalText.ts';

const buffer = (rows: Array<[string, boolean?]>): TextBuffer => ({
  length: rows.length,
  getLine: (y) => rows[y] && { isWrapped: !!rows[y][1], translateToString: (trimRight) => (trimRight ? rows[y][0].trimEnd() : rows[y][0]) },
});

test('reading view joins wrapped rows, trims padding and drops trailing blank lines', () => {
  const text = bufferText(buffer([
    ['> ช่วย commit + push อัปเดตเป็น '],
    ['Version 1.0.6 ให้ด้วยแบบ Hard Update', true],
    [''],
    ['• Ran git status   '],
    ['   '],
    [''],
  ]));
  assert.equal(text, '> ช่วย commit + push อัปเดตเป็น Version 1.0.6 ให้ด้วยแบบ Hard Update\n\n• Ran git status');
});

test('reading view keeps Thai combining marks with their letters', () => {
  assert.equal(bufferText(buffer([['ที่ปรับมาใช้งานได้ทั้งหมด']])), 'ที่ปรับมาใช้งานได้ทั้งหมด');
  assert.equal(bufferText(buffer([])), '');
});

test('Thai font loading asks for both weights and never rejects', async () => {
  const asked: string[] = [];
  const fonts = { load: async (font: string) => { asked.push(font); return []; } } as unknown as FontFaceSet;
  await loadTerminalThaiFont(fonts);
  assert.deepEqual(asked, ['15px "Noto Sans Thai"', 'bold 15px "Noto Sans Thai"']);
  const failing = { load: () => Promise.reject(new Error('offline')) } as unknown as FontFaceSet;
  await loadTerminalThaiFont(failing);
  await loadTerminalThaiFont(undefined);
});
