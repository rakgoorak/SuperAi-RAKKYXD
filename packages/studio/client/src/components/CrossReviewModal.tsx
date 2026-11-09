import { useState } from 'react';
import {
  Scale,
  ShieldAlert,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  XCircle,
  LoaderCircle,
  X,
  Send,
  Copy,
  Check,
  FileText,
  UserCheck,
} from 'lucide-react';
import {
  requestCrossReview,
  applyCrossReviewFixes,
  type CrossReviewResult,
  type Session,
} from '../api';

export function CrossReviewModal({
  workspaceId,
  sessions,
  onClose,
  onApplied,
}: {
  workspaceId: string;
  sessions: Session[];
  onClose: () => void;
  onApplied?: () => void;
}) {
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id || '');
  const [reviewerChoice, setReviewerChoice] = useState('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [reviewResult, setReviewResult] = useState<CrossReviewResult | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'suggestion'>('all');
  const [problem, setProblem] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const activeSession = sessions.find((s) => s.id === selectedSessionId) || sessions[0];
  const authorProvider = activeSession?.agentType || 'claude-code';

  const handleStartReview = async () => {
    setIsLoading(true);
    setProblem('');
    setApplySuccess(false);

    let reviewerParam: any = undefined;
    if (reviewerChoice !== 'auto') {
      if (reviewerChoice.startsWith('cli:')) {
        reviewerParam = { name: reviewerChoice.slice(4), provider: reviewerChoice, model: '', effort: 'medium' };
      } else {
        reviewerParam = { name: reviewerChoice, provider: reviewerChoice, model: '', effort: '' };
      }
    }

    try {
      const res = await requestCrossReview(workspaceId, {
        authorProvider,
        reviewer: reviewerParam,
      });
      setReviewResult(res);
    } catch (err: any) {
      setProblem(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFixes = async () => {
    if (!reviewResult || !selectedSessionId) return;
    setIsApplying(true);
    setProblem('');
    try {
      await applyCrossReviewFixes(workspaceId, selectedSessionId, reviewResult);
      setApplySuccess(true);
      onApplied?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setProblem(err.message);
    } finally {
      setIsApplying(false);
    }
  };

  const filteredIssues = (reviewResult?.issues || []).filter((iss) => {
    if (filterSeverity === 'all') return true;
    return iss.severity === filterSeverity;
  });

  const criticalCount = reviewResult?.issues.filter((i) => i.severity === 'critical').length || 0;
  const warningCount = reviewResult?.issues.filter((i) => i.severity === 'warning').length || 0;
  const suggestionCount = reviewResult?.issues.filter((i) => i.severity === 'suggestion').length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-3xl max-h-[85vh] bg-[#14191e] border border-white/10 rounded-xl shadow-2xl overflow-hidden text-slate-200 text-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#171d23]">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <Scale size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
                AI Cross-Examination
                <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  Adversarial Review
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                ส่งโค้ดที่ AI ตัวหนึ่งเขียน ให้ AI อีกค่ายเป็นผู้ตรวจทาน (Code Review) เพื่อค้นหาข้อบกพร่อง ช่องโหว่ และ Logic Bug
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-white/[0.02] border border-white/5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                เซสชันที่เป็นผู้เขียนโค้ด (Author):
              </label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                disabled={isLoading || isApplying}
                className="w-full px-2.5 py-1.5 bg-[#0e1216] border border-white/10 rounded-md text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.agentType} ({s.agentType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                AI ผู้ตรวจทานอิสระ (Reviewer):
              </label>
              <select
                value={reviewerChoice}
                onChange={(e) => setReviewerChoice(e.target.value)}
                disabled={isLoading || isApplying}
                className="w-full px-2.5 py-1.5 bg-[#0e1216] border border-white/10 rounded-md text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50"
              >
                <option value="auto">⚡ คัดเลือกค่ายตรงข้ามให้อัตโนมัติ (แนะนำ)</option>
                <option value="cli:codex">OpenAI Codex (Senior Auditor)</option>
                <option value="cli:claude-code">Claude Code (Principal Architect)</option>
                <option value="cli:antigravity">Antigravity CLI (Google Gemini)</option>
                <option value="deepseek">DeepSeek Reasoner (Math &amp; Logic)</option>
                <option value="ollama">Ollama Local Model (Offline &amp; Private)</option>
              </select>
            </div>
          </div>

          {problem && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs">
              <XCircle size={15} className="flex-shrink-0 text-rose-400" />
              <span>{problem}</span>
            </div>
          )}

          {applySuccess && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium">
              <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-400" />
              <span>ส่งคำแนะนำให้ AI ผู้เขียนโค้ดทำการแก้ไขเรียบร้อยแล้ว! กำลังปิดหน้าต่าง...</span>
            </div>
          )}

          {/* Empty / Initial State */}
          {!reviewResult && !isLoading && (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3">
                <UserCheck size={24} />
              </div>
              <h4 className="font-semibold text-slate-200 mb-1">ยังไม่มีผลการตรวจทาน</h4>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                กดปุ่มด้านล่างเพื่อให้ AI อีกค่ายตรวจสอบ Git Diff ล่าสุดในโปรเจกต์ของคุณ
              </p>
              <button
                onClick={handleStartReview}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors shadow-lg shadow-indigo-600/20"
              >
                <Scale size={15} />
                <span>เริ่มการตรวจทานโค้ด (Start Cross-Review)</span>
              </button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl bg-white/[0.01] border border-white/10">
              <LoaderCircle size={32} className="animate-spin text-indigo-400 mb-3" />
              <h4 className="font-semibold text-slate-200 mb-1">AI Reviewer กำลังวิเคราะห์โค้ด...</h4>
              <p className="text-xs text-slate-400">
                กำลังอ่าน Git Diff ตรวจสอบช่องโหว่ด้านความปลอดภัย ข้อผิดพลาดทางตรรกะ และมาตรฐานโค้ด
              </p>
            </div>
          )}

          {/* Review Results Card */}
          {reviewResult && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Review Score & Verdict Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#0e1216] border border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-xl text-lg font-bold border ${
                      reviewResult.score >= 80
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : reviewResult.score >= 60
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {reviewResult.score}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 text-sm">
                        {reviewResult.reviewer.name}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          reviewResult.verdict === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : reviewResult.verdict === 'changes_requested'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {reviewResult.verdict.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ตรวจทานโค้ดของ <b className="text-slate-300">{reviewResult.authorProvider}</b> ({reviewResult.diffStats.filesChanged} ไฟล์ที่มีการเปลี่ยนแปลง)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 font-medium">
                    {criticalCount} Critical
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 font-medium">
                    {warningCount} Warning
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 font-medium">
                    {suggestionCount} Suggestion
                  </span>
                </div>
              </div>

              {/* Summary Box */}
              <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-xs font-semibold text-slate-400 block mb-1">
                  บทสรุปความเห็นของ Reviewer:
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {reviewResult.summary}
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                <button
                  onClick={() => setFilterSeverity('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filterSeverity === 'all'
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ทั้งหมด ({reviewResult.issues.length})
                </button>
                {criticalCount > 0 && (
                  <button
                    onClick={() => setFilterSeverity('critical')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      filterSeverity === 'critical'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'text-slate-400 hover:text-rose-400'
                    }`}
                  >
                    Critical ({criticalCount})
                  </button>
                )}
                {warningCount > 0 && (
                  <button
                    onClick={() => setFilterSeverity('warning')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      filterSeverity === 'warning'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'text-slate-400 hover:text-amber-400'
                    }`}
                  >
                    Warnings ({warningCount})
                  </button>
                )}
                {suggestionCount > 0 && (
                  <button
                    onClick={() => setFilterSeverity('suggestion')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      filterSeverity === 'suggestion'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'text-slate-400 hover:text-blue-400'
                    }`}
                  >
                    Suggestions ({suggestionCount})
                  </button>
                )}
              </div>

              {/* Issues List */}
              <div className="space-y-3">
                {filteredIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg bg-[#0e1216] border border-white/10 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {issue.severity === 'critical' ? (
                          <ShieldAlert size={16} className="text-rose-400 flex-shrink-0" />
                        ) : issue.severity === 'warning' ? (
                          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                        ) : (
                          <Lightbulb size={16} className="text-blue-400 flex-shrink-0" />
                        )}
                        <span className="font-semibold text-xs text-slate-100">
                          {issue.title}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          issue.severity === 'critical'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                            : issue.severity === 'warning'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                        }`}
                      >
                        {issue.severity}
                      </span>
                    </div>

                    {issue.file && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                        <FileText size={12} className="text-slate-500" />
                        <span>
                          {issue.file}
                          {issue.line ? `:${issue.line}` : ''}
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {issue.description}
                    </p>

                    {issue.suggestedFix && (
                      <div className="mt-2 rounded bg-black/50 border border-white/5 overflow-hidden">
                        <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/[0.02] border-b border-white/5 text-[10px] font-medium text-slate-400">
                          <span>แนวทางแก้ไขที่แนะนำ:</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(issue.suggestedFix!);
                              setCopiedIdx(idx);
                              setTimeout(() => setCopiedIdx(null), 2000);
                            }}
                            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {copiedIdx === idx ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            {copiedIdx === idx ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}
                          </button>
                        </div>
                        <pre className="p-2.5 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {issue.suggestedFix}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}

                {!filteredIssues.length && (
                  <div className="p-6 text-center text-xs text-slate-500">
                    ไม่พบรายการในหมวดหมู่นี้
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 bg-[#171d23]">
          {reviewResult && (
            <button
              onClick={handleStartReview}
              disabled={isLoading || isApplying}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              ตรวจทานซ้ำ (Re-run)
            </button>
          )}
          {!reviewResult && <div />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors text-xs font-medium"
            >
              ปิด
            </button>
            {reviewResult && reviewResult.issues.length > 0 && (
              <button
                onClick={handleApplyFixes}
                disabled={isApplying || !selectedSessionId}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    <span>กำลังส่งให้ AI แก้ไข...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>⚡ นำคำแนะนำส่งให้ AI แก้โค้ดทันที</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
