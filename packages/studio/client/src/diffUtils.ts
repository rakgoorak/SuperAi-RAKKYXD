export type DiffType = 'unchanged' | 'add' | 'delete';

export interface DiffLine {
  type: DiffType;
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface SideBySideRow {
  left: {
    lineNumber?: number;
    text: string;
    type: 'unchanged' | 'delete' | 'empty';
  };
  right: {
    lineNumber?: number;
    text: string;
    type: 'unchanged' | 'add' | 'empty';
  };
}

export function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

export function lcsDiff(orig: string[], mod: string[]): { type: DiffType; text: string }[] {
  const n = orig.length;
  const m = mod.length;

  if (n === 0) {
    return mod.map(text => ({ type: 'add' as const, text }));
  }
  if (m === 0) {
    return orig.map(text => ({ type: 'delete' as const, text }));
  }

  // Fallback for massive slices
  if (n * m > 2_500_000) {
    const fallback: { type: DiffType; text: string }[] = [];
    for (const text of orig) fallback.push({ type: 'delete', text });
    for (const text of mod) fallback.push({ type: 'add', text });
    return fallback;
  }

  const stride = m + 1;
  const dp = new Int32Array((n + 1) * (m + 1));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (orig[i] === mod[j]) {
        dp[(i + 1) * stride + (j + 1)] = dp[i * stride + j] + 1;
      } else {
        const up = dp[(i + 1) * stride + j];
        const left = dp[i * stride + (j + 1)];
        dp[(i + 1) * stride + (j + 1)] = up > left ? up : left;
      }
    }
  }

  let i = n;
  let j = m;
  const reversed: { type: DiffType; text: string }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && orig[i - 1] === mod[j - 1]) {
      reversed.push({ type: 'unchanged', text: orig[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i * stride + (j - 1)] >= dp[(i - 1) * stride + j])) {
      reversed.push({ type: 'add', text: mod[j - 1] });
      j--;
    } else if (i > 0) {
      reversed.push({ type: 'delete', text: orig[i - 1] });
      i--;
    }
  }

  return reversed.reverse();
}

export function computeDiffLines(original: string, modified: string, deleted?: boolean): DiffLine[] {
  if (deleted) {
    const origLines = splitLines(original);
    return origLines.map((text, i) => ({
      type: 'delete',
      text,
      oldLineNumber: i + 1,
    }));
  }

  const origLines = splitLines(original);
  const modLines = splitLines(modified);

  if (origLines.length === 0 && modLines.length === 0) {
    return [];
  }

  if (origLines.length === 0) {
    return modLines.map((text, i) => ({
      type: 'add',
      text,
      newLineNumber: i + 1,
    }));
  }

  if (modLines.length === 0) {
    return origLines.map((text, i) => ({
      type: 'delete',
      text,
      oldLineNumber: i + 1,
    }));
  }

  if (original === modified) {
    return origLines.map((text, i) => ({
      type: 'unchanged',
      text,
      oldLineNumber: i + 1,
      newLineNumber: i + 1,
    }));
  }

  // 1. Prefix trim
  let start = 0;
  while (start < origLines.length && start < modLines.length && origLines[start] === modLines[start]) {
    start++;
  }

  // 2. Suffix trim
  let endOrig = origLines.length - 1;
  let endMod = modLines.length - 1;
  while (endOrig >= start && endMod >= start && origLines[endOrig] === modLines[endMod]) {
    endOrig--;
    endMod--;
  }

  const result: DiffLine[] = [];

  // Prefix unchanged lines
  for (let i = 0; i < start; i++) {
    result.push({
      type: 'unchanged',
      text: origLines[i],
      oldLineNumber: i + 1,
      newLineNumber: i + 1,
    });
  }

  // Diff middle slice
  const midOrig = origLines.slice(start, endOrig + 1);
  const midMod = modLines.slice(start, endMod + 1);

  let curOld = start + 1;
  let curNew = start + 1;

  if (midOrig.length > 0 || midMod.length > 0) {
    const midDiff = lcsDiff(midOrig, midMod);

    for (const item of midDiff) {
      if (item.type === 'unchanged') {
        result.push({
          type: 'unchanged',
          text: item.text,
          oldLineNumber: curOld++,
          newLineNumber: curNew++,
        });
      } else if (item.type === 'delete') {
        result.push({
          type: 'delete',
          text: item.text,
          oldLineNumber: curOld++,
        });
      } else if (item.type === 'add') {
        result.push({
          type: 'add',
          text: item.text,
          newLineNumber: curNew++,
        });
      }
    }
  }

  // Suffix unchanged lines
  const suffixCount = origLines.length - 1 - endOrig;
  for (let k = 0; k < suffixCount; k++) {
    result.push({
      type: 'unchanged',
      text: origLines[endOrig + 1 + k],
      oldLineNumber: curOld + k,
      newLineNumber: curNew + k,
    });
  }

  return result;
}

export function computeSideBySideRows(diffLines: DiffLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let i = 0;

  while (i < diffLines.length) {
    const line = diffLines[i];

    if (line.type === 'unchanged') {
      rows.push({
        left: {
          lineNumber: line.oldLineNumber,
          text: line.text,
          type: 'unchanged',
        },
        right: {
          lineNumber: line.newLineNumber,
          text: line.text,
          type: 'unchanged',
        },
      });
      i++;
    } else {
      const deletes: DiffLine[] = [];
      const adds: DiffLine[] = [];

      while (i < diffLines.length && (diffLines[i].type === 'delete' || diffLines[i].type === 'add')) {
        if (diffLines[i].type === 'delete') {
          deletes.push(diffLines[i]);
        } else {
          adds.push(diffLines[i]);
        }
        i++;
      }

      const maxLen = Math.max(deletes.length, adds.length);
      for (let k = 0; k < maxLen; k++) {
        const del = deletes[k];
        const add = adds[k];

        rows.push({
          left: del
            ? { lineNumber: del.oldLineNumber, text: del.text, type: 'delete' }
            : { text: '', type: 'empty' },
          right: add
            ? { lineNumber: add.newLineNumber, text: add.text, type: 'add' }
            : { text: '', type: 'empty' },
        });
      }
    }
  }

  return rows;
}
