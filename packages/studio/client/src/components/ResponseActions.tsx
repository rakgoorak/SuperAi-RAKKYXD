import { useEffect, useRef, useState } from 'react';
import {
  ArrowRightCircle,
  Check,
  Copy,
  FilePen,
  Forward,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Share2,
} from 'lucide-react';
import { api } from '../api';
import type { Session } from '../api';
import { timeLabel } from '../chatFormat';
import {
  dispatchHandoff,
  filterHandoffTargets,
  formatHandoffPrompt,
  formatSessionLabel,
  getQuickAgentTargets,
} from '../handoffUtils';

export interface ResponseActionsProps {
  text?: string;
  disabled?: boolean;
  onRetry?: () => void;
  onEdit?: () => void;
  onChanges?: () => void;
  /** When the answer arrived, shown after the buttons like Claude's "Just now". */
  at?: number;
  now?: number;
  agentName?: string;
  currentSessionId?: string;
  sessions?: Session[];
  onHandoff?: (targetSessionId: string, prompt: string) => void;
}

/** Response controls are separate from suggestions and never invent provider capabilities. */
export function ResponseActions({
  text,
  at,
  now,
  disabled = false,
  agentName,
  currentSessionId,
  sessions,
  onRetry,
  onEdit,
  onChanges,
  onHandoff,
}: ResponseActionsProps) {
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState('');
  const [open, setOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffDone, setHandoffDone] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState('');
  const [fetchedSessions, setFetchedSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const handoffMenu = useRef<HTMLDivElement>(null);
  const handoffTrigger = useRef<HTMLButtonElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();
  const handoffTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      clearTimeout(copiedTimer.current);
      clearTimeout(handoffTimer.current);
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setHandoffOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
        event.stopPropagation();
      }
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', escape);
    };
  }, [open]);

  useEffect(() => {
    if (!handoffOpen) return;
    if (sessions && sessions.length > 0) return;
    setLoadingSessions(true);
    api<Session[]>('/api/sessions')
      .catch(() => api<Session[]>('/api/terminals'))
      .then((list) => {
        if (Array.isArray(list)) setFetchedSessions(list);
      })
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, [handoffOpen, sessions]);

  useEffect(() => {
    if (!handoffOpen) return;
    const outside = (event: PointerEvent) => {
      if (!handoffMenu.current?.contains(event.target as Node)) setHandoffOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHandoffOpen(false);
        handoffTrigger.current?.focus();
        event.stopPropagation();
      }
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', escape);
    };
  }, [handoffOpen]);

  const copy = async () => {
    setProblem('');
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text || '');
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setProblem('คัดลอกไม่ได้ ลองเลือกข้อความแล้วคัดลอกอีกครั้ง');
    }
  };

  const handleHandoff = (targetSessionId?: string, targetLabel?: string) => {
    if (!text?.trim()) return;
    const prompt = formatHandoffPrompt({
      agentName: agentName || 'AI',
      text: text.trim(),
    });

    if (targetSessionId) {
      dispatchHandoff(targetSessionId, prompt);
    } else {
      window.dispatchEvent(
        new CustomEvent('superai:prepare-composer', {
          detail: { text: prompt, mode: 'code' },
        })
      );
      window.dispatchEvent(
        new CustomEvent('superai:prepare-message', {
          detail: { text: prompt },
        })
      );
    }

    if (onHandoff && targetSessionId) {
      onHandoff(targetSessionId, prompt);
    }

    const label = targetLabel || 'session อื่น';
    setHandoffDone(true);
    setHandoffStatus(`ส่งต่อไป ${label} แล้ว`);
    setHandoffOpen(false);
    clearTimeout(handoffTimer.current);
    handoffTimer.current = setTimeout(() => {
      setHandoffDone(false);
      setHandoffStatus('');
    }, 2000);
  };

  const allSessions = sessions && sessions.length > 0 ? sessions : fetchedSessions;
  const filteredTargets = filterHandoffTargets(allSessions, {
    currentSessionId,
  });
  const quickAgents = getQuickAgentTargets(allSessions);

  return (
    <div className="response-controls">
      <div className="response-actions" role="group" aria-label="จัดการคำตอบ">
        {text?.trim() && (
          <button
            type="button"
            aria-label={copied ? 'คัดลอกแล้ว' : 'คัดลอกคำตอบ'}
            title={copied ? 'คัดลอกแล้ว' : 'คัดลอกคำตอบ'}
            onClick={() => void copy()}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        )}
        {onRetry && (
          <button
            type="button"
            aria-label="สร้างคำตอบใหม่"
            title="สร้างคำตอบใหม่ด้วยข้อความและการตั้งค่าเดิม อาจแก้ไฟล์หรือรันคำสั่งซ้ำ"
            disabled={disabled}
            onClick={onRetry}
          >
            <RotateCcw size={16} />
          </button>
        )}
        {text?.trim() && (
          <div className="response-handoff-wrap" ref={handoffMenu}>
            <button
              ref={handoffTrigger}
              type="button"
              aria-label={handoffDone ? 'ส่งต่องานแล้ว' : 'ส่งต่องาน (Handoff)'}
              title={
                handoffDone
                  ? 'ส่งต่องานแล้ว'
                  : 'ส่งต่องาน (Handoff) ไปยัง AI หรือ session อื่น'
              }
              aria-expanded={handoffOpen}
              disabled={disabled}
              onClick={() => setHandoffOpen(!handoffOpen)}
            >
              {handoffDone ? <Check size={16} /> : <Share2 size={16} />}
            </button>
            {handoffOpen && (
              <div className="response-handoff-menu" role="menu">
                <div className="handoff-title">ส่งต่องานไปยัง</div>
                {loadingSessions && (
                  <div className="handoff-loading">กำลังโหลด session…</div>
                )}
                {filteredTargets.length > 0 ? (
                  filteredTargets.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleHandoff(s.id, s.name)}
                    >
                      <Forward size={14} />
                      <span className="handoff-session-name">
                        {formatSessionLabel(s)}
                      </span>
                    </button>
                  ))
                ) : (
                  <>
                    <div className="handoff-empty">ยังไม่มี session อื่นในโปรเจกต์</div>
                    {quickAgents.map((qa) => (
                      <button
                        key={qa.agentType}
                        type="button"
                        role="menuitem"
                        onClick={() => handleHandoff(qa.id, qa.name)}
                      >
                        <Forward size={14} />
                        <span className="handoff-session-name">{qa.label}</span>
                      </button>
                    ))}
                  </>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleHandoff(undefined, 'ช่องคำสั่งทั่วไป')}
                >
                  <ArrowRightCircle size={14} />
                  <span className="handoff-session-name">ใส่ในช่องคำสั่งทั่วไป</span>
                </button>
              </div>
            )}
          </div>
        )}
        {(onEdit || onChanges) && (
          <div
            className="response-more"
            ref={menu}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                setOpen(false);
            }}
          >
            <button
              ref={trigger}
              type="button"
              aria-label="ตัวเลือกคำตอบ"
              title="ตัวเลือกคำตอบ"
              aria-expanded={open}
              disabled={disabled}
              onClick={() => setOpen(!open)}
            >
              <MoreHorizontal size={18} />
            </button>
            {open && (
              <div className="response-options">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onEdit();
                    }}
                  >
                    <Pencil size={14} />
                    แก้ไขข้อความต้นฉบับ
                  </button>
                )}
                {onChanges && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onChanges();
                    }}
                  >
                    <FilePen size={14} />
                    ดูไฟล์ที่เปลี่ยน
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <span className="response-copy-status" role="status">
          {handoffStatus || (copied ? 'คัดลอกแล้ว' : '')}
        </span>
        {at ? (
          <time
            className="response-time"
            dateTime={new Date(at).toISOString()}
            title={new Date(at).toLocaleString('th-TH')}
          >
            {timeLabel(at, now)}
          </time>
        ) : null}
      </div>
      {problem && <small role="alert">{problem}</small>}
    </div>
  );
}
