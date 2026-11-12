import { useState } from "react";
import { Check, CircleHelp, LoaderCircle } from "lucide-react";
import { post } from "../api";
import { chatPrefs } from "../chatControls";

// Mirrors server/Questions.ts and the "question" chat item in server/CliChat.ts.
export type ChatQuestion = { id: string; header: string; question: string; multiSelect: boolean; options: { label: string; description: string; recommended: boolean }[] };
type Answer = { selected: string[]; other: string };
export type QuestionItem = {
  id: string; kind: "question"; by: string; intro: string; questions: ChatQuestion[];
  status: "waiting" | "answered" | "skipped" | "expired"; answers?: Record<string, Answer>; requestId?: string; at: number;
};

/**
 * Questions any chat AI asks, Claude-style: pick an option (the recommended one is marked), type
 * your own, or let the AI decide. Works in every permission mode: the answer goes back to the AI
 * as the next message (or straight into Claude's AskUserQuestion call).
 */
export function QuestionCard({ item, sessionId, onError }: { item: QuestionItem; sessionId: string; onError: (message: string) => void }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [sending, setSending] = useState(false);
  const waiting = item.status === "waiting";

  if (!waiting) {
    return (
      <section className="clarify-card done" aria-label={`คำถามจาก ${item.by}`}>
        <header><CircleHelp size={14} /><strong>{item.by} ถาม</strong>
          {item.status === "expired" && <span className="chip">หมดเวลาตอบ</span>}
          {item.status === "skipped" && <span className="chip">ให้ AI ตัดสินใจ</span>}
        </header>
        <ul className="clarify-summary">
          {item.questions.map((q) => {
            const a = item.answers?.[q.id];
            const picked = [...(a?.selected || []), ...(a?.other ? [a.other] : [])];
            return (
              <li key={q.id}>
                <strong>{q.question}</strong>
                <span>{picked.length ? picked.join(", ") : item.status === "expired" ? "—" : "ให้ AI ตัดสินใจ"}</span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const edit = (id: string, change: (a: Answer) => Answer) =>
    setAnswers((all) => ({ ...all, [id]: change(all[id] || { selected: [], other: "" }) }));
  const answered = item.questions.filter((q) => answers[q.id]?.selected.length || answers[q.id]?.other.trim()).length;

  const send = async (skip: boolean) => {
    setSending(true);
    try {
      const result = await post<{ reply?: string }>(`/api/terminals/${sessionId}/chat/question`, skip ? { itemId: item.id, skip: true } : { itemId: item.id, answers });
      if (result.reply) {
        // The AI stopped to ask; the choices continue the conversation with this chat's settings.
        const prefs = chatPrefs(sessionId);
        await post(`/api/terminals/${sessionId}/chat`, {
          text: result.reply, model: prefs.model, effort: prefs.effort, permission: prefs.permission,
          responseStyle: prefs.responseStyle, includeProjectContext: prefs.includeProjectContext, queue: true,
        });
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="clarify-card" aria-label={`คำถามจาก ${item.by}`}>
      <header><CircleHelp size={14} /><strong>{item.by} ขอถามก่อนทำต่อ</strong><span className="chip">รอคำตอบ</span></header>
      {item.intro && <p className="clarify-intro">{item.intro}</p>}
      {item.questions.map((q, index) => {
        const a = answers[q.id] || { selected: [], other: "" };
        return (
          <fieldset key={q.id} className="clarify-question">
            <legend>
              {q.header && <span className="chip">{q.header}</span>}
              <span>{index + 1}. {q.question}</span>
              {q.multiSelect && <small>(เลือกได้หลายข้อ)</small>}
            </legend>
            {q.options.map((o) => {
              const on = a.selected.includes(o.label);
              return (
                <button key={o.label} type="button" className={`clarify-option ${on ? "selected" : ""}`} aria-pressed={on} disabled={sending}
                  onClick={() => edit(q.id, (cur) => q.multiSelect
                    ? { ...cur, selected: on ? cur.selected.filter((s) => s !== o.label) : [...cur.selected, o.label] }
                    : { selected: on ? [] : [o.label], other: "" })}>
                  <span className={`clarify-mark ${q.multiSelect ? "box" : ""}`}>{on && <Check size={11} />}</span>
                  <span className="clarify-option-text">
                    <strong>{o.label}{o.recommended && <em> (แนะนำ)</em>}</strong>
                    {o.description && <small>{o.description}</small>}
                  </span>
                </button>
              );
            })}
            <input className="clarify-other" placeholder="หรือพิมพ์คำตอบเอง…" value={a.other} disabled={sending} aria-label={`คำตอบอื่นสำหรับข้อ ${index + 1}`}
              onChange={(e) => {
                const other = e.target.value;
                edit(q.id, (cur) => ({ selected: q.multiSelect ? cur.selected : [], other }));
              }} />
          </fieldset>
        );
      })}
      <footer>
        <button className="text-button" disabled={sending} onClick={() => void send(true)}>ให้ AI ตัดสินใจเอง</button>
        <button className="primary compact" disabled={sending || !answered} onClick={() => void send(false)}>
          {sending ? <LoaderCircle size={13} className="spin" /> : <Check size={13} />} ส่งคำตอบ ({answered}/{item.questions.length})
        </button>
      </footer>
    </section>
  );
}
