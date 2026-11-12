import { tr } from './i18n.js';
/**
 * Multiple-choice questions an AI asks the user, Claude-style. Used by Agent/Chat runs (before
 * planning) and by every CLI chat: the AI writes a ```superai-questions block, the app shows it
 * as a card with options, and the user's choices go back as the next message.
 */

/** A multiple-choice question the AI asks before it starts (like Claude's clarifying questions). */
export interface ClarifyQuestion {
  id: string;
  header: string;
  question: string;
  multiSelect: boolean;
  options: { label: string; description: string; recommended: boolean }[];
}
export interface ClarifyAnswer {
  selected: string[];
  other: string;
}

/** Pull the first JSON object or array out of a CLI reply that may wrap it in prose or fences. */
export function extractJson(raw: string): any {
  const text = raw.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(text);
  } catch {}
  for (const [open, close] of [["{", "}"], ["[", "]"]]) {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start >= 0 && end > start)
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {}
  }
  throw new Error("ไม่พบ JSON");
}

export const MAX_QUESTIONS = 4;
export const ASK_RULES = `ถามเฉพาะเรื่องที่คำตอบเปลี่ยนผลลัพธ์อย่างมีนัยสำคัญ และเดาจากคำขอ ไฟล์แนบ หรือไฟล์ในโปรเจกต์ไม่ได้
ถามได้ไม่เกิน ${MAX_QUESTIONS} ข้อ แต่ละข้อมี 2-4 ตัวเลือกที่ต่างกันชัดเจน ใส่ "recommended":true ที่ตัวเลือกที่แนะนำและวางไว้เป็นตัวแรก
ใช้ "multiSelect":true เมื่อเลือกได้หลายข้อ ไม่ต้องใส่ตัวเลือก "อื่นๆ" เพราะผู้ใช้พิมพ์คำตอบเองได้เสมอ
รูปแบบ JSON:
{"intro":"บอกสั้นๆ ว่าตรวจอะไรแล้วและทำไมต้องถาม","questions":[{"header":"หัวข้อสั้น","question":"คำถามเต็ม?","multiSelect":false,"options":[{"label":"ตัวเลือกสั้นๆ","description":"ผลของการเลือกข้อนี้","recommended":true},{"label":"ตัวเลือกอื่น","description":"ผลของการเลือกข้อนี้"}]}]}`;

/** Read clarifying questions from an AI reply; null when it asked none or the reply is not usable. */
export function parseQuestions(raw: string | object): { intro: string; questions: ClarifyQuestion[] } | null {
  let data: any = raw;
  if (typeof raw === "string") {
    try {
      data = extractJson(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(data?.questions)) return null;
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
  const questions = data.questions
    .slice(0, MAX_QUESTIONS)
    .map((q: any, index: number): ClarifyQuestion => ({
      id: `q${index + 1}`,
      header: text(q?.header, 40),
      question: text(q?.question, 500),
      multiSelect: q?.multiSelect === true,
      options: (Array.isArray(q?.options) ? q.options : [])
        .slice(0, 4)
        .map((o: any) => ({ label: text(typeof o === "string" ? o : o?.label, 120), description: text(o?.description, 300), recommended: o?.recommended === true }))
        .filter((o: { label: string }) => o.label),
    }))
    .filter((q: ClarifyQuestion) => q.question && q.options.length >= 2);
  return questions.length ? { intro: text(data.intro, 600), questions } : null;
}

/** The fence a chat AI uses for its questions; the app replaces it with a card. */
export const QUESTION_FENCE = "superai-questions";

/**
 * What every chat turn tells the AI. Works in any permission mode because it is only text. The AI
 * decides for itself whether a request needs questions first; there is no switch for it.
 */
export function questionRules(): string {
  return [
    "ตัดสินใจเองว่าต้องถามผู้ใช้ก่อนหรือไม่: ถ้าคำขอชัดเจนหรือเป็นงานเล็ก ให้ลงมือทำเลยโดยไม่ต้องถาม ถ้าเป็นงานที่ต้องแก้หลายส่วนและยังมีเรื่องที่ผู้ใช้ต้องตัดสินใจ (เป้าหมาย ขอบเขต วิธีทำ) ซึ่งเดาผิดแล้วต้องทำใหม่ ให้ถามทั้งหมดในครั้งเดียวก่อนแก้ไฟล์หรือรันคำสั่ง แล้วหยุดรอคำตอบ",
    `เวลาถาม ให้เขียนคำถามเป็นบล็อกโค้ดภาษา ${QUESTION_FENCE} ที่มี JSON อยู่ข้างใน ไว้ท้ายข้อความ แล้วจบข้อความทันที โปรแกรมจะแสดงเป็นตัวเลือกให้ผู้ใช้กด`,
    ASK_RULES,
  ].join("\n");
}

const FENCE = new RegExp("```" + QUESTION_FENCE + "[^\\n]*\\n([\\s\\S]*?)```", "i");

/** Split a reply into the text to show and the questions it asks (null when it asks none). */
export function takeQuestions(text: string): { text: string; asked: { intro: string; questions: ClarifyQuestion[] } | null } {
  const match = FENCE.exec(text);
  if (!match) return trailingQuestions(text);
  const asked = parseQuestions(match[1]);
  if (!asked) return { text, asked: null };
  return { text: (text.slice(0, match.index) + text.slice(match.index + match[0].length)).trim(), asked };
}

/**
 * Smaller models often drop the fence and end the reply with the bare JSON (or a ```json block).
 * Only a question object that ends the reply counts, so JSON shown mid-answer stays text.
 */
function trailingQuestions(text: string): { text: string; asked: { intro: string; questions: ClarifyQuestion[] } | null } {
  const body = text.replace(/\s*```\s*$/, "");
  const end = body.lastIndexOf("}");
  if (end < 0 || !/"questions"\s*:/.test(body) || body.slice(end + 1).trim()) return { text, asked: null };
  for (let start = body.indexOf("{"); start >= 0 && start < end; start = body.indexOf("{", start + 1)) {
    let data: any;
    try { data = JSON.parse(body.slice(start, end + 1)); } catch { continue; }
    const asked = data && typeof data === "object" && !Array.isArray(data) ? parseQuestions(data) : null;
    if (!asked) return { text, asked: null };
    const before = body.slice(0, start).replace(/```(?:json)?\s*$/i, "").trim();
    return { text: before, asked };
  }
  return { text, asked: null };
}

/** Claude Code's own AskUserQuestion tool input, in the same shape. */
export function fromAskUserQuestion(input: any): { intro: string; questions: ClarifyQuestion[] } | null {
  return parseQuestions({ intro: "", questions: Array.isArray(input?.questions) ? input.questions : [] });
}

/** The user's choices as text the AI can follow; skipped questions leave the call to the AI. */
export function describeChoices(questions: ClarifyQuestion[], answers: Record<string, ClarifyAnswer> | undefined, by = "AI"): string {
  const lines = questions.map((q) => {
    const a = answers?.[q.id];
    const picked = [...(a?.selected || []), ...(a?.other?.trim() ? [a.other.trim()] : [])];
    return `- ${q.question}\n  คำตอบ: ${picked.length ? picked.join(", ") : "ข้าม (ตัดสินใจเองตามที่เหมาะสม และบอกว่าเลือกอะไร)"}`;
  });
  return `คำตอบของผู้ใช้ต่อคำถามที่ ${by} ถามไว้:\n${lines.join("\n")}`;
}

/** Keep only answers that match the question's options (or typed text), as the client may send anything. */
export function cleanAnswers(questions: ClarifyQuestion[], given: unknown): Record<string, ClarifyAnswer> {
  const all = given && typeof given === "object" ? (given as Record<string, any>) : {};
  const answers: Record<string, ClarifyAnswer> = {};
  for (const q of questions) {
    const a = all[q.id];
    if (!a || typeof a !== "object") continue;
    const labels = q.options.map((o) => o.label);
    const selected = (Array.isArray(a.selected) ? a.selected : []).map(String).filter((s: string) => labels.includes(s));
    const other = typeof a.other === "string" ? a.other.trim().slice(0, 500) : "";
    if (!q.multiSelect && selected.length + (other ? 1 : 0) > 1) throw new Error(tr`“${q.header || q.question}” เลือกได้ข้อเดียว`);
    if (selected.length || other) answers[q.id] = { selected: Array.from(new Set(selected)), other };
  }
  return answers;
}
