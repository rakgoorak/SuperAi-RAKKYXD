import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { api, type Run } from '../api';
import { conversationMarkdown, teamMarkdown, exportFilename } from '../conversationExport';

export function ConversationExport({ title, sessionId, workspaceId, mode }: { title: string; sessionId?: string; workspaceId?: string; mode?: 'agent' | 'chat' }) {
  const root = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  useEffect(() => {
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape' && root.current?.open) { root.current.open = false; root.current.querySelector('summary')?.focus(); }
      else if (event instanceof PointerEvent && !root.current?.contains(event.target as Node) && root.current) root.current.open = false;
    };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, []);
  const download = async (format: 'md' | 'json') => {
    if (busy) return;
    setBusy(true); setProblem('');
    try {
      const data = sessionId ? await api<{ items: Parameters<typeof conversationMarkdown>[1] }>(`/api/terminals/${sessionId}/chat`)
        : { runs: (await api<Run[]>(`/api/conversations/${workspaceId}`)).filter(run => run.mode === mode) };
      const content = format === 'json' ? JSON.stringify({ schemaVersion: 1, title, exportedAt: new Date().toISOString(), ...data }, null, 2)
        : 'items' in data ? conversationMarkdown(title, data.items) : teamMarkdown(title, data.runs);
      const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = exportFilename(title, format); anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (root.current) root.current.open = false;
    } catch (error) { setProblem((error as Error).message); }
    finally { setBusy(false); }
  };
  return <details ref={root} className="conversation-export">
    <summary aria-label="ส่งออกบทสนทนา" title="ส่งออกบทสนทนา">{busy ? <Loader2 size={14} className="spin" /> : <Download size={14} />}</summary>
    <div className="conversation-export-menu" role="group" aria-label="รูปแบบส่งออก">
      <button type="button" disabled={busy} onClick={() => void download('md')}>Markdown (.md)</button>
      <button type="button" disabled={busy} onClick={() => void download('json')}>JSON (.json)</button>
      <small>ดาวน์โหลดข้อมูลที่แอปเก็บไว้ในห้องนี้</small>
      {problem && <p role="alert">{problem}</p>}
    </div>
  </details>;
}
