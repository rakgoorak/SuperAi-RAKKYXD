import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Loader2 } from 'lucide-react';
import { api, type Run } from '../api';
import {
  conversationMarkdown,
  teamMarkdown,
  conversationHtml,
  teamHtml,
  conversationSummaryText,
  exportFilename,
} from '../conversationExport';

export function ConversationExport({
  title,
  sessionId,
  workspaceId,
  mode,
}: {
  title: string;
  sessionId?: string;
  workspaceId?: string;
  mode?: 'agent' | 'chat';
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape' && root.current?.open) {
        root.current.open = false;
        root.current.querySelector('summary')?.focus();
      } else if (event instanceof PointerEvent && !root.current?.contains(event.target as Node) && root.current) {
        root.current.open = false;
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  const fetchData = async () => {
    return sessionId
      ? await api<{ items: Parameters<typeof conversationMarkdown>[1] }>(`/api/terminals/${sessionId}/chat`)
      : { runs: (await api<Run[]>(`/api/conversations/${workspaceId}`)).filter((run) => run.mode === mode) };
  };

  const download = async (format: 'md' | 'json' | 'html') => {
    if (busy) return;
    setBusy(true);
    setProblem('');
    try {
      const data = await fetchData();
      let content = '';
      let mime = 'text/plain;charset=utf-8';

      if (format === 'json') {
        content = JSON.stringify({ schemaVersion: 1, title, exportedAt: new Date().toISOString(), ...data }, null, 2);
        mime = 'application/json;charset=utf-8';
      } else if (format === 'html') {
        content = 'items' in data ? conversationHtml(title, data.items) : teamHtml(title, data.runs);
        mime = 'text/html;charset=utf-8';
      } else {
        content = 'items' in data ? conversationMarkdown(title, data.items) : teamMarkdown(title, data.runs);
        mime = 'text/markdown;charset=utf-8';
      }

      const url = URL.createObjectURL(new Blob([content], { type: mime }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = exportFilename(title, format);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (root.current) root.current.open = false;
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCopySummary = async () => {
    if (busy) return;
    setBusy(true);
    setProblem('');
    try {
      const data = await fetchData();
      const text =
        'items' in data
          ? conversationSummaryText(title, data.items)
          : teamMarkdown(title, data.runs.slice(-1));
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        if (root.current) root.current.open = false;
      }, 1500);
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details ref={root} className="conversation-export">
      <summary aria-label="ส่งออกบทสนทนา" title="ส่งออกบทสนทนา">
        {busy ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
      </summary>
      <div className="conversation-export-menu" role="group" aria-label="รูปแบบส่งออก">
        <button type="button" disabled={busy} onClick={() => void download('html')}>
          เว็บเพจสวยงาม (.html)
        </button>
        <button type="button" disabled={busy} onClick={() => void download('md')}>
          Markdown (.md)
        </button>
        <button type="button" disabled={busy} onClick={() => void download('json')}>
          JSON (.json)
        </button>
        <button type="button" disabled={busy} onClick={() => void handleCopySummary()}>
          {copied ? <Check size={13} style={{ color: '#4ade80' }} /> : <Copy size={13} />}
          {copied ? 'คัดลอกสรุปแล้ว!' : 'คัดลอกสรุปบทสนทนา'}
        </button>
        <small>ดาวน์โหลดหรือแชร์ข้อมูลจากห้องนี้</small>
        {problem && <p role="alert">{problem}</p>}
      </div>
    </details>
  );
}
