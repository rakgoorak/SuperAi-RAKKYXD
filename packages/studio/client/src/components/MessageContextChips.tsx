import { useEffect, useState } from 'react';
import { X, Quote } from 'lucide-react';
import { messageContexts, saveMessageContexts } from '../conversationContext';

export function MessageContextChips({ sessionId }: { sessionId: string }) {
  const [items, setItems] = useState(() => messageContexts(sessionId));
  const [problem, setProblem] = useState('');
  useEffect(() => {
    const reload = () => setItems(messageContexts(sessionId));
    reload();
    window.addEventListener('superai:message-context', reload);
    return () => window.removeEventListener('superai:message-context', reload);
  }, [sessionId]);
  return <div className="message-context-chips" aria-label="ข้อความที่แนบเป็นบริบท">
    {items.map(item => <div key={item.id} className="message-context-chip">
      <Quote size={13} /><span title={item.text}>{item.text}</span>
      <button type="button" aria-label="เอาข้อความอ้างอิงออก" onClick={() => {
        try { saveMessageContexts(sessionId, items.filter(other => other.id !== item.id)); setProblem(''); }
        catch { setProblem('บันทึกบริบทไม่ได้ กรุณาตรวจพื้นที่จัดเก็บ'); }
      }}><X size={13} /></button>
    </div>)}
    {problem && <span role="alert">{problem}</span>}
  </div>;
}
