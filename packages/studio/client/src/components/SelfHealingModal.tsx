import { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wrench,
  LoaderCircle,
  X,
  Terminal,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  verifyProject,
  selfHealProject,
  type VerificationResult,
  type SelfHealResult,
  type Session,
} from '../api';
import { tr } from '../i18n';

export function SelfHealingModal({
  workspaceId,
  sessions,
  onClose,
  onSelectSession,
}: {
  workspaceId: string;
  sessions: Session[];
  onClose: () => void;
  onSelectSession?: (id: string) => void;
}) {
  const [command, setCommand] = useState('npm test');
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id || '');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<'idle' | 'verifying' | 'healing'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerificationResult | null>(null);
  const [healResult, setHealResult] = useState<SelfHealResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedLog, setExpandedLog] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [problem, setProblem] = useState('');

  // Initial verification on mount
  useEffect(() => {
    handleRunVerify();
  }, [workspaceId]);

  const handleRunVerify = async () => {
    setIsRunning(true);
    setCurrentStep('verifying');
    setStatusMessage(tr("กำลังรันคำสั่งตรวจสอบโปรเจกต์..."));
    setProblem('');
    try {
      const res = await verifyProject(workspaceId, command);
      setVerifyResult(res);
      if (res.passed) {
        setStatusMessage(tr("✓ การทดสอบทั้งหมดผ่านสมบูรณ์ 100%"));
      } else {
        setStatusMessage(tr`พบข้อผิดพลาดในการทดสอบ (Exit code ${res.exitCode})`);
      }
    } catch (err: any) {
      setProblem(err.message);
    } finally {
      setIsRunning(false);
      setCurrentStep('idle');
    }
  };

  const handleStartSelfHeal = async () => {
    if (!selectedSessionId) {
      setProblem(tr("กรุณาเลือก Agent ที่ต้องการให้ทำการแก้ไขโค้ด"));
      return;
    }
    setIsRunning(true);
    setCurrentStep('healing');
    setStatusMessage(tr("เริ่มต้น Self-Healing Loop: กำลังทดสอบและส่งผลให้ AI แก้ไขโค้ดอัตโนมัติ..."));
    setProblem('');
    try {
      const res = await selfHealProject(workspaceId, {
        sessionId: selectedSessionId,
        command,
        maxAttempts,
      });
      setHealResult(res);
      if (res.success) {
        setStatusMessage(tr`✓ ซ่อมแซมโค้ดสำเร็จในรอบที่ ${res.totalAttempts}! การทดสอบผ่านสมบูรณ์`);
      } else {
        setStatusMessage(tr`ไม่สามารถแก้โค้ดให้ผ่านได้หลังพยายาม ${res.totalAttempts} รอบ`);
      }
      // Refresh verify result to reflect latest state
      if (res.attempts.length > 0) {
        setVerifyResult(res.attempts[res.attempts.length - 1].verification);
      }
    } catch (err: any) {
      setProblem(err.message);
    } finally {
      setIsRunning(false);
      setCurrentStep('idle');
    }
  };

  const handleCopyError = () => {
    if (!verifyResult?.failureSummary) return;
    navigator.clipboard.writeText(verifyResult.failureSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-2xl max-h-[85vh] bg-[#14191e] border border-white/10 rounded-xl shadow-2xl overflow-hidden text-slate-200 text-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#171d23]">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <Activity size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
                Self-Healing Loop
                <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Auto-Repair
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {tr("รันคำสั่งทดสอบเบื้องหลังอัตโนมัติ หาก Test พังจะดึงข้อผิดพลาดส่งให้ AI ซ่อมแซมโค้ดจนกว่าจะผ่าน")}
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
          {/* Controls bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-white/[0.02] border border-white/5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                {tr("คำสั่งทดสอบ (Verification Command):")}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Terminal size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    disabled={isRunning}
                    placeholder={tr("เช่น npm test หรือ npm run build")}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#0e1216] border border-white/10 rounded-md text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                {tr("Agent ที่จะสั่งให้ซ่อมโค้ด:")}
              </label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                disabled={isRunning || !sessions.length}
                className="w-full px-2.5 py-1.5 bg-[#0e1216] border border-white/10 rounded-md text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.agentType || 'Session'} ({s.agentType || 'CLI'})
                  </option>
                ))}
                {!sessions.length && <option value="">{tr("ไม่มีเซสชันที่เปิดอยู่")}</option>}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-slate-400">
            <span>{tr("จำนวนรอบสูงสุดที่อนุญาตให้ AI ลองแก้ (Max Attempts):")}</span>
            <select
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              disabled={isRunning}
              className="px-2 py-1 bg-[#0e1216] border border-white/10 rounded text-xs text-slate-200 font-medium"
            >
              <option value={1}>{tr("1 รอบ")}</option>
              <option value={2}>{tr("2 รอบ")}</option>
              <option value={3}>{tr("3 รอบ (แนะนำ)")}</option>
              <option value={5}>{tr("5 รอบ")}</option>
            </select>
          </div>

          {/* Status Banner */}
          {statusMessage && (
            <div
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-xs font-medium border ${
                verifyResult?.passed
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : currentStep === 'healing' || isRunning
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
              }`}
            >
              {isRunning ? (
                <LoaderCircle size={15} className="animate-spin flex-shrink-0" />
              ) : verifyResult?.passed ? (
                <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle size={15} className="flex-shrink-0 text-amber-400" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          {problem && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs">
              <XCircle size={15} className="flex-shrink-0 text-rose-400" />
              <span>{problem}</span>
            </div>
          )}

          {/* Test Result Card */}
          {verifyResult && (
            <div className="rounded-lg bg-[#0e1216] border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-xs text-slate-300">{tr("ผลการรัน:")}</span>
                  <span className="font-mono text-xs text-slate-400">`{verifyResult.command}`</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">
                    {(verifyResult.durationMs / 1000).toFixed(2)}s
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                      verifyResult.passed
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {verifyResult.passed ? 'PASSED' : `FAILED (${verifyResult.exitCode})`}
                  </span>
                </div>
              </div>

              {!verifyResult.passed && verifyResult.failureSummary && (
                <div className="p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> {tr("จุดที่พัง (Failure Clues):")}
                    </span>
                    <button
                      onClick={handleCopyError}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copied ? tr("คัดลอกแล้ว") : tr("คัดลอก Error")}
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-black/40 border border-rose-500/20 text-rose-200 text-xs font-mono overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                    {verifyResult.failureSummary}
                  </pre>
                </div>
              )}

              {/* Full Output Toggle */}
              <div className="border-t border-white/5">
                <button
                  onClick={() => setExpandedLog(!expandedLog)}
                  className="flex items-center gap-1.5 w-full px-3.5 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.02] transition-colors"
                >
                  {expandedLog ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{tr("ดูบันทึก Log ฉบับเต็ม (")}{verifyResult.output.length.toLocaleString()} {tr("อักขระ)")}</span>
                </button>
                {expandedLog && (
                  <pre className="p-3.5 bg-black/60 border-t border-white/5 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60 whitespace-pre-wrap leading-relaxed">
                    {verifyResult.output || tr("(ไม่มีข้อความจากคำสั่ง)")}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Self-Healing Loop History */}
          {healResult && healResult.attempts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {tr("ประวัติการแก้ไขใน Loop (")}{healResult.attempts.length} {tr("รอบ):")}
              </h4>
              <div className="space-y-2">
                {healResult.attempts.map((att) => (
                  <div
                    key={att.attempt}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0e1216] border border-white/5 text-xs"
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                        att.verification.passed
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {att.attempt}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{tr("รอบที่")} {att.attempt}</span>
                        <span
                          className={`text-[10px] font-medium ${
                            att.verification.passed ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {att.verification.passed ? tr("ผ่านสมบูรณ์") : tr("พบข้อผิดพลาด → ส่งให้ AI แก้")}
                        </span>
                      </div>
                      {!att.verification.passed && att.verification.failureSummary && (
                        <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 font-mono">
                          {att.verification.failureSummary.split('\n')[0]}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 bg-[#171d23]">
          <button
            onClick={handleRunVerify}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 text-xs font-medium"
          >
            <RefreshCw size={13} className={isRunning && currentStep === 'verifying' ? 'animate-spin' : ''} />
            <span>{tr("รันตรวจสอบใหม่")}</span>
          </button>

          <div className="flex items-center gap-2">
            {selectedSessionId && onSelectSession && (
              <button
                type="button"
                onClick={() => {
                  onSelectSession(selectedSessionId);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-xs font-medium"
              >
                {tr("ดู Session")}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors text-xs font-medium"
            >
              {tr("ปิด")}
            </button>
            <button
              onClick={handleStartSelfHeal}
              disabled={isRunning || !sessions.length || verifyResult?.passed}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning && currentStep === 'healing' ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />
                  <span>{tr("กำลังซ่อมแซม...")}</span>
                </>
              ) : (
                <>
                  <Wrench size={14} />
                  <span>{tr("เริ่ม Self-Healing Loop")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
