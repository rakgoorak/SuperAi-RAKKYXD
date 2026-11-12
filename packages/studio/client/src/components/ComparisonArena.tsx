import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  LoaderCircle,
  Sparkles,
  Timer,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import type { PanelAnswer, Run, StepStatus } from "../api";
import { providerName, seatSummary } from "../providers";
import {
  formatLatency,
  formatTtft,
  estimateTokenCount,
  formatTokens,
  formatArenaError,
} from "../comparisonMetrics";
import { Markdown } from "./Markdown";
import { RunUsage } from './RunUsage';
import "../comparison-arena.css";
import { tr } from '../i18n';

export { formatLatency, formatTtft, estimateTokenCount, formatTokens, formatArenaError };

function stepLabel(status: StepStatus) {
  switch (status) {
    case "pending": return tr("รอ");
    case "running": return tr("กำลังคิด");
    case "completed": return tr("ตอบแล้ว");
    case "failed": return tr("ไม่สำเร็จ");
    case "cancelled": return tr("ยกเลิก");
    case "skipped": return tr("ข้าม");
  }
}

export function ComparisonArena({ run }: { run: Run }) {
  const panel = run.panel || [];
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [handoffIndex, setHandoffIndex] = useState<number | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();
  const handoffTimer = useRef<ReturnType<typeof setTimeout>>();
  const summaryCopyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
      if (summaryCopyTimer.current) clearTimeout(summaryCopyTimer.current);
    };
  }, []);

  const copyAnswer = async (text: string, index: number) => {
    if (!text) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedIndex(index);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedIndex(null), 2000);
    } catch {}
  };

  const copySummaryText = async (text: string) => {
    if (!text) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedSummary(true);
      if (summaryCopyTimer.current) clearTimeout(summaryCopyTimer.current);
      summaryCopyTimer.current = setTimeout(() => setCopiedSummary(false), 2000);
    } catch {}
  };

  const handoffToCode = (answer: PanelAnswer, index: number) => {
    if (!answer.output) return;
    const promptIntro = run.prompt
      ? tr`จากคำถามเดิม: "${run.prompt.slice(0, 200)}${run.prompt.length > 200 ? "…" : ""}"\n\n`
      : "";
    const handoffText = tr`${promptIntro}แนวทางและโค้ดที่เลือกจาก ${answer.seat.name} (${providerName(answer.seat.provider)}):\n\n${answer.output}\n\nกรุณานำแนวทางหรือโค้ดนี้ไปปรับปรุงและใช้งานจริงในโปรเจกต์`;

    // Dispatch event to switch to code mode and populate composer draft
    window.dispatchEvent(
      new CustomEvent("superai:prepare-composer", {
        detail: { mode: "code", text: handoffText },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("superai:prepare-message", {
        detail: { text: handoffText },
      }),
    );

    setHandoffIndex(index);
    if (handoffTimer.current) clearTimeout(handoffTimer.current);
    handoffTimer.current = setTimeout(() => setHandoffIndex(null), 2000);
  };

  const columnClass = `columns-${Math.min(panel.length, 5)}`;

  return (
    <section className="comparison-arena" aria-label={tr("สนามประลอง AI (Comparison Arena)")}>
      <RunUsage steps={run.usageSteps} />
      <div className="arena-header">
        <div className="arena-title-wrap">
          <Sparkles size={16} />
          <span>{tr("เปรียบเทียบคำตอบ AI (")}{panel.length} {tr("โมเดล)")}</span>
        </div>
        <span className="arena-count-badge">
          {panel.filter((a) => a.status === "completed").length}/{panel.length} {tr("ตอบแล้ว")}
        </span>
      </div>

      <div className={`arena-grid ${columnClass}`}>
        {panel.map((answer, index) => {
          const isWinner = winnerIndex === index;
          const isCopied = copiedIndex === index;
          const isHandoff = handoffIndex === index;
          const latency = formatLatency(answer);
          const ttft = formatTtft(answer);

          return (
            <article
              key={index}
              className={`arena-card answer-card state-${answer.status} ${isWinner ? "is-winner" : ""}`}
              aria-label={tr`คำตอบจาก ${answer.seat.name}`}
            >
              <header className="arena-card-header">
                <div className="arena-card-title-row">
                  <div className="arena-seat-identity">
                    <strong className="arena-seat-name">{answer.seat.name}</strong>
                    <span className="arena-provider-badge">
                      {providerName(answer.seat.provider)}
                    </span>
                    {answer.seat.model && (
                      <span className="arena-model-badge" title={answer.seat.model}>
                        {answer.seat.model}
                      </span>
                    )}
                  </div>

                  <div className="arena-header-status-wrap">
                    {isWinner && (
                      <span className="arena-winner-badge" title={tr("คำตอบที่เลือก")}>
                        <Trophy size={11} /> {tr("คำตอบที่เลือก")}
                      </span>
                    )}
                    <span className={`arena-status-indicator state-${answer.status}`}>
                      {answer.status === "running" && (
                        <LoaderCircle size={11} className="spin" />
                      )}
                      {answer.status === "completed" && <CheckCircle2 size={11} />}
                      {answer.status === "failed" && <AlertCircle size={11} />}
                      {answer.status === "cancelled" && <XCircle size={11} />}
                      {answer.status === "pending" && <Clock size={11} />}
                      {stepLabel(answer.status) || answer.status}
                    </span>
                  </div>
                </div>

                <small className="arena-seat-summary" title={seatSummary(answer.seat)}>
                  {seatSummary(answer.seat)}
                </small>

                {/* Performance Metrics Pill */}
                <div
                  className="arena-metrics-pill"
                  title={`Latency: ${latency} · TTFT: ${ttft}`}
                >
                  <span className="arena-metric-item" title={tr("ระยะเวลาตอบ")}>
                    <Timer size={11} /> {latency}
                  </span>
                  <span className="arena-metric-divider">·</span>
                  <span className="arena-metric-item" title={tr("เวลาถึงโทเค็นแรก (TTFT)")}>
                    <Zap size={11} /> {ttft}
                  </span>
                </div>

                {/* Action Buttons Toolbar */}
                <div className="arena-card-actions">
                  <button
                    type="button"
                    className={`arena-action-btn ${isCopied ? "btn-copied" : ""}`}
                    disabled={!answer.output}
                    onClick={() => void copyAnswer(answer.output, index)}
                    title={isCopied ? tr("คัดลอกแล้ว") : tr("คัดลอกคำตอบ")}
                  >
                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{isCopied ? tr("คัดลอกแล้ว") : tr("คัดลอก")}</span>
                  </button>

                  <button
                    type="button"
                    className={`arena-action-btn btn-winner ${isWinner ? "active" : ""}`}
                    disabled={!answer.output}
                    onClick={() => setWinnerIndex(isWinner ? null : index)}
                    title={isWinner ? tr("ยกเลิกการเลือกคำตอบนี้") : tr("เลือกคำตอบนี้เป็นคำตอบที่ดีที่สุด")}
                  >
                    <Trophy size={12} />
                    <span>{isWinner ? tr("เลือกแล้ว") : tr("เลือกคำตอบนี้")}</span>
                  </button>

                  <button
                    type="button"
                    className={`arena-action-btn btn-handoff ${isHandoff ? "btn-copied" : ""}`}
                    disabled={!answer.output}
                    onClick={() => handoffToCode(answer, index)}
                    title={tr("ส่งคำตอบนี้ไปยังช่องคำสั่งโหมด Code เพื่อนำไปพัฒนาต่อ")}
                  >
                    {isHandoff ? <Check size={12} /> : <Code2 size={12} />}
                    <span>{isHandoff ? tr("ส่งไป Code แล้ว") : tr("ส่งต่อไปโหมด Code")}</span>
                  </button>
                </div>
              </header>

              <div className="arena-card-body">
                {answer.output ? (
                  <Markdown text={answer.output} />
                ) : answer.status === "running" ? (
                  <div className="arena-card-status-msg running">
                    <LoaderCircle size={13} className="spin" />
                    <span>{tr("กำลังคิดคำตอบ…")}</span>
                  </div>
                ) : answer.error ? (
                  <div className="arena-card-status-msg failed">
                    <AlertCircle size={13} />
                    <span>{formatArenaError(answer.error)}</span>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {run.summarizer && (
        <article
          className={`arena-summarizer-card summary-card state-${run.summaryStatus || "pending"}`}
          aria-label={tr("สรุปผลรวมคำตอบ")}
        >
          <header className="arena-summarizer-header">
            <div className="arena-summarizer-title">
              <Sparkles size={16} />
              <strong>{tr("สรุปผลโดย")} {run.summarizer.name}</strong>
              <span className="arena-summarizer-meta">
                {providerName(run.summarizer.provider)} ·{" "}
                {run.summaryStyle === "best" ? tr("คัดเฉพาะส่วนที่ดีที่สุด") : tr("รวมทุกความเห็น")}
              </span>
            </div>

            <div className="arena-summarizer-actions">
              <span className={`arena-status-indicator state-${run.summaryStatus || "pending"}`}>
                {run.summaryStatus === "running" && <LoaderCircle size={11} className="spin" />}
                {run.summaryStatus === "completed" && <CheckCircle2 size={11} />}
                {run.summaryStatus === "failed" && <AlertCircle size={11} />}
                {run.summaryStatus === "pending"
                  ? tr("รอคำตอบครบ")
                  : stepLabel(run.summaryStatus || "pending")}
              </span>

              {run.output && (
                <button
                  type="button"
                  className={`arena-action-btn ${copiedSummary ? "btn-copied" : ""}`}
                  onClick={() => void copySummaryText(run.output)}
                  title={tr("คัดลอกบทสรุป")}
                >
                  {copiedSummary ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedSummary ? tr("คัดลอกแล้ว") : tr("คัดลอกสรุป")}</span>
                </button>
              )}
            </div>
          </header>

          <div className="arena-summarizer-body">
            {run.output ? (
              <Markdown text={run.output} />
            ) : run.summaryStatus === "running" ? (
              <div className="arena-card-status-msg running">
                <LoaderCircle size={13} className="spin" />
                <span>{tr("กำลังวิเคราะห์และสรุปคำตอบ…")}</span>
              </div>
            ) : null}
          </div>
        </article>
      )}
    </section>
  );
}
