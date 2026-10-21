// Plain-text view of a terminal buffer for the reading mode: Thai shapes like
// normal text instead of one letter per terminal cell.

/** The slice of xterm's IBuffer this needs (kept small so it can be tested without a DOM). */
export interface TextBuffer {
  readonly length: number;
  getLine(y: number): { readonly isWrapped: boolean; translateToString(trimRight?: boolean): string } | undefined;
}

/** Whole buffer (scrollback + screen) as text: wrapped rows rejoined, trailing blank lines dropped. */
export function bufferText(buffer: TextBuffer): string {
  const lines: string[] = [];
  for (let y = 0; y < buffer.length; y++) {
    const line = buffer.getLine(y);
    if (!line) continue;
    // Untrimmed, so a space that fell exactly on the wrap point survives the rejoin.
    const text = line.translateToString(false);
    if (line.isWrapped && lines.length) lines[lines.length - 1] += text;
    else lines.push(text);
  }
  const trimmed = lines.map((l) => l.trimEnd());
  while (trimmed.length && !trimmed[trimmed.length - 1]) trimmed.pop();
  return trimmed.join('\n');
}

/**
 * Fonts the terminal draws Thai with. xterm measures each character once and caches
 * the width, so the Thai face must be loaded before it measures, or marks drift and
 * columns stop lining up. Resolves when both weights the terminal uses are ready.
 */
export function loadTerminalThaiFont(fonts: FontFaceSet | undefined = typeof document === 'undefined' ? undefined : document.fonts): Promise<void> {
  if (!fonts) return Promise.resolve();
  const sample = 'กขค่้๊๋ำ';
  return Promise.all([
    fonts.load('15px "Noto Sans Thai"', sample),
    fonts.load('bold 15px "Noto Sans Thai"', sample),
  ]).then(() => undefined, () => undefined);
}
