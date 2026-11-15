import { useState } from "react";
import { Check, CircleHelp, LoaderCircle } from "lucide-react";
import { post, type ClarifyAnswer, type Run } from "../api";
import { tr } from '../i18n';

/**
 * Multiple-choice questions the AI asks before it starts, Claude-style: pick an option (the
 * recommended one is marked), type your own, or skip and let the AI decide. Once answered it
 * folds to a question → answer summary.
 */
export function ClarifyCard({ run, onError }: { run: Run; onError: (message: string) => void }) {
  const clarify = run.clarify!;
  const [answers, setAnswers] = useState<Record<string, ClarifyAnswer>>({});
  const [sending, setSending] = useState(false);
  const waiting = clarify.status === "waiting" && run.status === "running";

  if (!waiting) {
    return (
      <section className="clarify-card done" aria-label={tr`คำถามจาก ${clarify.by}`}>
        <header><CircleHelp size={14} /><strong>{clarify.by} {tr("ถามก่อนเริ่ม")}</strong>
          {clarify.status === "cancelled" && <span className="chip">{tr("ไม่ได้ตอบ")}</span>}
        </header>
        <ul className="clarify-summary">
          {clarify.questions.map((q) => {
            const a = clarify.answers?.[q.id];
            const picked = [...(a?.selected || []), ...(a?.other ? [a.other] : [])].map((label) =>
              q.options.find((o) => o.label === label)?.recommended ? tr`${label} (แนะนำ)` : label,
            );
            return (
              <li key={q.id}>
                <strong>{q.question}</strong>
                <span>{picked.length ? picked.join(", ") : clarify.status === "cancelled" ? "—" : tr("ข้าม (ให้ AI ตัดสินใจ)")}</span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const edit = (id: string, change: (a: ClarifyAnswer) => ClarifyAnswer) =>
    setAnswers((all) => ({ ...all, [id]: change(all[id] || { selected: [], other: "" }) }));
  const send = async (skip: boolean) => {
    setSending(true);
    try {
      await post(`/api/runs/${run.id}/answer`, skip ? { skip: true } : { answers });
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSending(false);
    }
  };
  const answered = clarify.questions.filter((q) => answers[q.id]?.selected.length || answers[q.id]?.other.trim()).length;

  return (
    <section className="clarify-card" aria-label={tr`คำถามจาก ${clarify.by}`}>
      <header><CircleHelp size={14} /><strong>{clarify.by} {tr("ขอถามก่อนเริ่ม")}</strong><span className="chip">{tr("รอคำตอบ")}</span></header>
      {clarify.intro && <p className="clarify-intro">{clarify.intro}</p>}
      {clarify.questions.map((q, index) => {
        const a = answers[q.id] || { selected: [], other: "" };
        return (
          <fieldset key={q.id} className="clarify-question">
            <legend>
              {q.header && <span className="chip">{q.header}</span>}
              <span>{index + 1}. {q.question}</span>
              {q.multiSelect && <small>{tr("(เลือกได้หลายข้อ)")}</small>}
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
                    <strong>{o.label}{o.recommended && <em> {tr("(แนะนำ)")}</em>}</strong>
                    {o.description && <small>{o.description}</small>}
                  </span>
                </button>
              );
            })}
            <input className="clarify-other" placeholder={tr("หรือพิมพ์คำตอบเอง…")} value={a.other} disabled={sending} aria-label={tr`คำตอบอื่นสำหรับข้อ ${index + 1}`}
              onChange={(e) => {
                const other = e.target.value;
                edit(q.id, (cur) => ({ selected: q.multiSelect ? cur.selected : [], other }));
              }} />
          </fieldset>
        );
      })}
      <footer>
        <button className="text-button" disabled={sending} onClick={() => void send(true)}>{tr("ข้ามทั้งหมด ให้ AI ตัดสินใจเอง")}</button>
        <button className="primary compact" disabled={sending || !answered} onClick={() => void send(false)}>
          {sending ? <LoaderCircle size={13} className="spin" /> : <Check size={13} />} {tr("ส่งคำตอบ (")}{answered}/{clarify.questions.length})
        </button>
      </footer>
    </section>
  );
}
