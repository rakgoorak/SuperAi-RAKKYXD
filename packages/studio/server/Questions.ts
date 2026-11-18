import { replyLanguageRule, tr } from './i18n.js';
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
export const ASK_RULES = `Ask only about things whose answer changes the outcome significantly and that you cannot infer from the request, the attachments or the project files.
Ask at most ${MAX_QUESTIONS} questions, each with 2-4 clearly different options. Put "recommended":true on the recommended option and list it first.
Use "multiSelect":true when several can be chosen. Do not add an "Other" option: the user can always type their own answer.
JSON format:
{"intro":"what you checked and why you need to ask, briefly","questions":[{"header":"short topic","question":"full question?","multiSelect":false,"options":[{"label":"short option","description":"what choosing this means","recommended":true},{"label":"another option","description":"what choosing this means"}]}]}`;

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
    "Decide yourself whether to ask the user first: if the request is clear or the task is small, just do it. If the task touches several parts and leaves decisions to the user (goal, scope, approach) that would mean redoing work if guessed wrong, ask them all at once before editing files or running commands, then stop and wait.",
    `To ask, put the questions in a ${QUESTION_FENCE} code block containing JSON at the end of your message, then end the message. The app shows them as options the user can click.`,
    ASK_RULES,
    `Write the questions and options following this rule: ${replyLanguageRule()}`,
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
