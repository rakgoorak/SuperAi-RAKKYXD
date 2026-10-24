import { ArrowUpRight } from 'lucide-react';
import type { SuggestionItem } from '../suggestions';
import { prepareMessage } from '../recovery';

export function NextSteps({ items, sessionId, disabled = false, onSelect }: {
  items: SuggestionItem[]; sessionId?: string; disabled?: boolean; onSelect?: (text: string) => void;
}) {
  if (!items.length) return null;
  return <section className="answer-next-steps" aria-label="คำแนะนำหลังคำตอบ">
    <p>ทำต่อจากคำตอบนี้</p>
    <div>{items.map(item => <button key={item.id} type="button" disabled={disabled} title={item.promptText}
      onClick={() => onSelect ? onSelect(item.promptText) : prepareMessage(item.promptText, sessionId, { expand: false })}>
      <span>{item.label}</span><ArrowUpRight size={14} />
    </button>)}</div>
  </section>;
}
