/**
 * Release notes are written in English first, then a `## ภาษาไทย` heading and the same notes in
 * Thai (see docs/RELEASE.md). The update card shows only the part in the window's language:
 * Thai for the Thai app, English for the others. Notes without the heading are shown whole.
 * Older apps simply show both parts, one after the other.
 */
const THAI_HEADING = /^##\s*ภาษาไทย\s*$/m;

export function notesInLanguage(notes: string, locale: string): string {
  const at = notes.search(THAI_HEADING);
  if (at < 0) return notes;
  const english = notes.slice(0, at).trim();
  const thai = notes.slice(at).replace(THAI_HEADING, '').trim();
  return (locale === 'th' ? thai || english : english || thai);
}
