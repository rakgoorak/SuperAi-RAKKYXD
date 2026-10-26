import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bufferText, loadTerminalThaiFont, type TextBuffer } from '../client/src/terminalText.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

test('bundled xterm requestMode handles Freebuff DECRQM queries without ReferenceError in strict mode', () => {
  const assetsDir = path.resolve(__dirname, '../client/dist/assets');
  if (!fs.existsSync(assetsDir)) return;
  const terminalChunk = fs.readdirSync(assetsDir).find((f) => /^terminal-.*\.js$/.test(f));
  assert.ok(terminalChunk, 'terminal-*.js chunk should exist in client/dist/assets');
  const code = fs.readFileSync(path.join(assetsDir, terminalChunk), 'utf8');
  const match = code.match(/requestMode\([a-zA-Z0-9_$,]+\)\{[\s\S]*?(?=_updateAttrColor\()/);
  assert.ok(match, 'requestMode method should be present in terminal chunk');
  assert.ok(!match[0].includes('NOT_RECOGNIZED'), 'unused inline enum IIFE should be stripped from requestMode');

  const replies: string[] = [];
  const runRequestMode = new Function(
    'ctx',
    'params',
    'isAnsi',
    'f',
    `"use strict"; return ({ ${match[0]} }).requestMode.call(ctx, params, isAnsi);`,
  );
  const ctx = {
    _coreService: {
      decPrivateModes: {
        applicationCursorKeys: false,
        applicationKeypad: false,
        bracketedPasteMode: true,
        origin: false,
        reverseWraparound: false,
        sendFocus: true,
        synchronizedOutput: false,
        wraparound: true,
      },
      modes: { insertMode: false },
      isCursorHidden: false,
      triggerDataEvent: (data: string) => replies.push(data),
    },
    _coreMouseService: { activeProtocol: 'NONE', activeEncoding: 'SGR' },
    _bufferService: { buffers: { active: {}, alt: {} }, cols: 80 },
    _optionsService: { rawOptions: { cursorBlink: true, convertEol: false, windowOptions: {} } },
  };
  // Freebuff (@opentui) sends \x1b[?1016$p and \x1b[?2004$p on startup.
  assert.equal(runRequestMode(ctx, { length: 1, params: [1016] }, false, { ESC: '\x1b' }), true);
  assert.equal(runRequestMode(ctx, { length: 1, params: [2004] }, false, { ESC: '\x1b' }), true);
  assert.deepEqual(replies, ['\x1b[?1016;2$y', '\x1b[?2004;1$y']);
});
