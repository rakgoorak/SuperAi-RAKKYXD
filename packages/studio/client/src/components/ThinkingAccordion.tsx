import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { tr } from '../i18n';

interface Props {
  thought: string;
  durationSeconds?: number;
}

export function ThinkingAccordion({ thought, durationSeconds }: Props) {
  const [open, setOpen] = useState(false);
  const wordCount = thought.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className={`thinking-accordion ${open ? 'is-open' : 'is-collapsed'}`}>
      <button
        type="button"
        className="thinking-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="thinking-title">
          <Brain size={14} className="thinking-brain-icon" />
          <span>{tr("กระบวนการคิดวิเคราะห์ (Thought process)")}</span>
        </span>
        <span className="thinking-meta">
          <small className="thinking-badge">
            {durationSeconds ? tr`คิด ${durationSeconds} วิ` : tr`${wordCount} คำ`}
          </small>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {open && (
        <div className="thinking-content">
          <div className="thinking-body">
            <pre tabIndex={0}>
              <code>{thought.trim()}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
