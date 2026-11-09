import { useEffect, useState, useCallback } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  CheckCircle2,
  Rocket,
  Compass,
} from 'lucide-react';

export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  badge: string;
  desc: string;
  hint?: string;
  preferredPosition?: 'top' | 'bottom' | 'left' | 'right';
  padding?: number;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'mode-tabs',
    targetSelector: '[data-tour="mode-tabs"]',
    title: '1. สลับโหมดการทำงาน (3 โหมดหลัก)',
    badge: 'ขั้นตอนที่ 1 / 5',
    desc: 'SuperAi รวมโหมดทำงานอัจฉริยะไว้ในที่เดียว:\n• 🤖 ทีม Agent: สั่งงานใหญ่ ให้ AI หลายตัวช่วยกันวางแผนและเขียนโค้ด\n• ⚡ Terminal: คุยตรงกับ AI CLI สั่งรันคำสั่งและแก้ไฟล์บนเครื่อง\n• 💬 ถามหลาย AI: ถามข้อความเดียว AI ทุกค่ายร่วมแข่งกันตอบ',
    hint: '💡 ลองคลิกปุ่มสลับโหมด หรือกดปุ่ม "ถัดไป" ได้เลยครับ',
    preferredPosition: 'bottom',
    padding: 6,
  },
  {
    id: 'composer',
    targetSelector: '[data-tour="composer"]',
    title: '2. กล่องพิมพ์สั่งงาน AI (Smart Composer)',
    badge: 'ขั้นตอนที่ 2 / 5',
    desc: 'กล่องคำสั่ง AI ที่รองรับทุกอย่างที่คุณต้องการ:\n• พิมพ์ภาษาไทยหรืออังกฤษตามธรรมชาติ\n• กด Enter เพื่อส่ง / Shift+Enter ขึ้นบรรทัดใหม่\n• พิมพ์ / เพื่อเปิดเมนูคำสั่งลัด เช่น /review, /test\n• พิมพ์ @ เพื่อแท็กอ้างอิงไฟล์ในโปรเจกต์',
    hint: '💡 สามารถลากไฟล์ รูปภาพ หรือโฟลเดอร์มาวางในกล่องนี้ได้ทันที',
    preferredPosition: 'top',
    padding: 8,
  },
  {
    id: 'dictation',
    targetSelector: '[data-tour="dictation"]',
    title: '3. สั่งงานด้วยเสียงภาษาไทย (Whisper AI)',
    badge: 'ขั้นตอนที่ 3 / 5',
    desc: 'ประหยัดเวลาพิมพ์คำสั่งยาวๆ!\n• กดปุ่มไมโครโฟนสีฟ้าข้างกล่องพิมพ์ แล้วพูดภาษาไทยได้ทันที\n• ระบบใช้ Local Whisper AI ถอดเสียงเป็นข้อความลงช่องพิมพ์ให้อัตโนมัติ\n• ทำงานบนเครื่องของคุณ 100% ปลอดภัยและเป็นส่วนตัว',
    hint: '💡 ลองกดปุ่มไมโครโฟน แล้วพูดทดสอบได้เลยครับ',
    preferredPosition: 'top',
    padding: 6,
  },
  {
    id: 'toolbar-actions',
    targetSelector: '[data-tour="toolbar-actions"]',
    title: '4. เปิด Preview ดูเว็บจริง & ควบคุมระบบ',
    badge: 'ขั้นตอนที่ 4 / 5',
    desc: 'ศูนย์ตรวจงานและมอนิเตอร์:\n• 🌐 เปิด Preview: เปิดดูหน้าเว็บจริงที่ AI สร้างขึ้นในหน้าต่างเดียว ไม่ต้องสลับเบราว์เซอร์\n• 💻 เปิด Terminal: เปิดหน้าจอดำสำหรับรันคำสั่งภายนอกอิสระ',
    hint: '💡 เห็นทั้งโค้ดและหน้าเว็บที่ AI กำลังสร้างพร้อมๆ กัน',
    preferredPosition: 'bottom',
    padding: 6,
  },
  {
    id: 'sidebar-mcp',
    targetSelector: '[data-tour="sidebar-mcp"]',
    title: '5. ปลั๊กอิน MCP & ซ่อมโค้ดอัตโนมัติ',
    badge: 'ขั้นตอนที่ 5 / 5',
    desc: 'ขุมพลังพิเศษของ SuperAi:\n• 🔌 MCP Servers: เชื่อมต่อเครื่องมือเบราว์เซอร์ Puppeteer, ฐานข้อมูล SQLite/Postgres ให้ AI ทุกค่ายใช้ร่วมกัน\n• 🩹 Self-Healing: ซ่อมโค้ดอัตโนมัติเมื่อ Test พัง (ดูได้ที่หน้า Changes)\n• ⚖️ AI Cross-Review: ให้ AI ต่างค่ายช่วยรีวิวหาช่องโหว่ความปลอดภัย',
    hint: '💡 ลองคลิกที่ปุ่ม MCP Servers เพื่อดูเครื่องมือที่เปิดให้เชื่อมต่อได้ในคลิกเดียว',
    preferredPosition: 'right',
    padding: 6,
  },
];

interface Props {
  active: boolean;
  onClose: () => void;
}

export function InteractiveTour({ active, onClose }: Props) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isCompleted, setIsCompleted] = useState(false);

  const step = TOUR_STEPS[currentStepIdx];

  const persistDismissed = () => {
    try {
      localStorage.setItem('superai-tour-dismissed', '1');
      localStorage.setItem('superai-tutorial-dismissed', '1');
    } catch {}
  };

  const handleClose = () => {
    persistDismissed();
    onClose();
  };

  const handleFinish = () => {
    persistDismissed();
    setIsCompleted(false);
    onClose();
  };

  const updateTargetBounds = useCallback(() => {
    if (!active || !step) return;
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const el = document.querySelector(step.targetSelector);
    if (el) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } catch {}

      const r = el.getBoundingClientRect();
      setRect(r);

      // Tooltip dimensions
      const tooltipWidth = 380;
      const tooltipHeight = 250;
      const margin = 16;

      let top = 0;
      let left = 0;

      const pos = step.preferredPosition || 'bottom';

      if (pos === 'bottom') {
        top = r.bottom + margin;
        left = r.left + r.width / 2 - tooltipWidth / 2;
      } else if (pos === 'top') {
        top = r.top - tooltipHeight - margin;
        left = r.left + r.width / 2 - tooltipWidth / 2;
      } else if (pos === 'right') {
        top = r.top + r.height / 2 - tooltipHeight / 2;
        left = r.right + margin;
        if (left + tooltipWidth > window.innerWidth - 16) {
          left = Math.max(16, r.left - tooltipWidth - margin);
        }
      } else {
        // left
        top = r.top + r.height / 2 - tooltipHeight / 2;
        left = r.left - tooltipWidth - margin;
      }

      // Constrain inside viewport
      top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, top));
      left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left));

      setTooltipPos({ top, left });
    } else {
      setRect(null);
    }
  }, [active, step]);

  useEffect(() => {
    if (!active) return;
    updateTargetBounds();

    const handleResize = () => updateTargetBounds();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    const checkInterval = setInterval(updateTargetBounds, 350);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      clearInterval(checkInterval);
    };
  }, [active, updateTargetBounds]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, currentStepIdx, isCompleted]);

  const handleNext = () => {
    if (currentStepIdx < TOUR_STEPS.length - 1) {
      setCurrentStepIdx((n) => n + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx((n) => n - 1);
      setIsCompleted(false);
    }
  };

  if (!active) return null;

  // SVG Cutout geometry
  const pad = step?.padding || 8;
  const x = rect ? Math.max(0, rect.left - pad) : 0;
  const y = rect ? Math.max(0, rect.top - pad) : 0;
  const w = rect ? rect.width + pad * 2 : 0;
  const h = rect ? rect.height + pad * 2 : 0;
  const r = 10;

  // SVG path with evenodd rule: outer fullscreen rect minus inner rounded rect hole
  const svgCutoutPath = rect && !isCompleted ? `
    M 0 0 H ${windowSize.width} V ${windowSize.height} H 0 Z
    M ${x + r} ${y}
    H ${x + w - r}
    A ${r} ${r} 0 0 1 ${x + w} ${y + r}
    V ${y + h - r}
    A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}
    H ${x + r}
    A ${r} ${r} 0 0 1 ${x} ${y + h - r}
    V ${y + r}
    A ${r} ${r} 0 0 1 ${x + r} ${y}
    Z
  ` : '';

  return (
    <div className="fixed inset-0 z-[9990] select-none font-sans pointer-events-none">
      {/* Semi-transparent Backdrop with Cutout Hole */}
      {rect && !isCompleted ? (
        <>
          {/* SVG Overlay: Semi-transparent spotlight backdrop */}
          <svg
            className="fixed inset-0 w-full h-full pointer-events-none"
            style={{ fill: 'rgba(5, 8, 15, 0.78)' }}
          >
            <path fillRule="evenodd" d={svgCutoutPath} />
          </svg>

          {/* Glowing Target Ring on the Cutout */}
          <div
            style={{
              position: 'fixed',
              top: `${y}px`,
              left: `${x}px`,
              width: `${w}px`,
              height: `${h}px`,
              borderRadius: `${r}px`,
              border: '2px solid #6366f1',
              boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.4), 0 0 25px rgba(99, 102, 241, 0.45)',
              pointerEvents: 'none',
              zIndex: 9995,
              transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            {/* Number Beacon Badge */}
            <span className="absolute -top-3.5 -right-3.5 flex h-7 w-7 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-7 w-7 bg-indigo-600 text-[11px] font-extrabold text-white items-center justify-center shadow-lg border-2 border-indigo-300">
                {currentStepIdx + 1}
              </span>
            </span>
          </div>
        </>
      ) : (
        <div className="fixed inset-0 bg-black/80 pointer-events-none transition-opacity" />
      )}

      {/* Floating Tooltip Card */}
      {!isCompleted ? (
        <div
          style={{
            position: 'fixed',
            top: `${tooltipPos.top}px`,
            left: `${tooltipPos.left}px`,
            width: '380px',
            zIndex: 10001,
            transition: 'top 0.2s ease-out, left 0.2s ease-out',
          }}
          className="pointer-events-auto bg-[#141820]/95 border border-indigo-500/40 rounded-2xl p-4 shadow-2xl shadow-black/90 text-slate-200 text-sm backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/10"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 shadow-sm">
              <Compass size={12} className="text-indigo-400 animate-spin-slow" />
              {step.badge}
            </span>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="ข้ามทัวร์ (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
            {step.title}
          </h3>

          {/* Description */}
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line mb-3 font-normal">
            {step.desc}
          </p>

          {/* Hint Badge */}
          {step.hint && (
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center gap-2 mb-3.5">
              <Sparkles size={14} className="flex-shrink-0 text-indigo-400" />
              <span className="leading-snug">{step.hint}</span>
            </div>
          )}

          {/* Navigation & Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            {/* Step Indicators */}
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStepIdx(i)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    currentStepIdx === i
                      ? 'w-6 bg-gradient-to-r from-indigo-500 to-cyan-400 shadow-sm shadow-indigo-500/50'
                      : 'w-2 bg-white/20 hover:bg-white/40'
                  }`}
                  title={`ไปยังสเต็ปที่ ${i + 1}`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {currentStepIdx > 0 && (
                <button
                  onClick={handlePrev}
                  className="px-2.5 py-1.5 rounded-xl border border-white/15 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={14} /> ย้อน
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>{currentStepIdx === TOUR_STEPS.length - 1 ? 'เสร็จสิ้น' : 'ถัดไป'}</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Completion Modal */
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[10005] pointer-events-auto">
          <div className="w-full max-w-md bg-[#141820] border border-emerald-500/40 rounded-2xl p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200 backdrop-blur-xl ring-1 ring-emerald-500/20">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">ยอดเยี่ยม! คุณพร้อมใช้งานแล้ว 🎉</h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                คุณได้รู้จักเครื่องมือหลักของ SuperAi ครบถ้วนแล้ว ลองพิมพ์คำสั่งแรกในกล่องข้อความ หรือสั่งงานด้วยเสียงภาษาไทยได้ทันที
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleFinish}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <Rocket size={16} />
                <span>เริ่มต้นใช้งาน SuperAi ทันที</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
