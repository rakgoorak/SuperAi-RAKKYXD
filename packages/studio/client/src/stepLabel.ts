// Lines that only open or close a script (PowerShell here-strings, shell heredocs, brackets)
// say nothing about what the step does: "กำลังทำงาน: @'" looked like the app had stalled.
const WRAPPER = /^(?:@['"]|['"]@|(?:\S+\s+)?<<-?\s*['"]?\w*['"]?|EOF|[{}()[\];]+|```\w*)$/;

/** The first line of a step's title that shows what it is doing, kept short for the status row. */
export function stepLabel(title: string, max = 120): string {
  const lines = String(title || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const line = lines.find((l) => !WRAPPER.test(l)) || lines[0] || '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
