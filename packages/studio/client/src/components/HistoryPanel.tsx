import { useEffect, useState } from 'react';
import { api, type Run, type Session, type Workspace } from '../api';
export interface HistoryEntry { id: string; wsId: string; sessionId?: string; mode: 'code' | 'agent' | 'chat'; text: string; snippet: string; at: number; }
export function HistoryPanel({ workspaces, sessions, onSelect }: { workspaces: Workspace[]; sessions: Session[]; onSelect: (entry: HistoryEntry) => void }) {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState('');
  const sourceKey = workspaces.map(ws=>ws.id).join() + ":" + sessions.map(session=>session.id+session.view).join();
  useEffect(() => {
    let disposed = false;
    const loads: Promise<HistoryEntry[]>[] = [
      ...workspaces.map(ws => api<Run[]>(`/api/conversations/${ws.id}`).then(runs => runs.map(run => ({ id: run.id, wsId: ws.id, mode: run.mode, text: run.prompt, snippet: [run.output, run.error, ...(run.tasks || []).map(task => task.output)].filter(Boolean).join('\n'), at: run.createdAt })))),
      ...sessions.filter(s => s.view === 'chat' && s.wsId).map(session => api<{ items: { id: string; kind: string; text?: string; at: number }[] }>(`/api/terminals/${session.id}/chat`).then(chat => chat.items.filter(item => item.kind === 'user').map((item, i, users) => ({ id: item.id, sessionId: session.id, wsId: session.wsId!, mode: 'code' as const, text: item.text || '', snippet: chat.items.filter(next => next.at >= item.at && (!users[i + 1] || next.at < users[i + 1].at)).map(next => next.text || '').join('\n'), at: item.at })))),
    ];
    Promise.allSettled(loads).then(results => { if (disposed) return; setEntries(results.flatMap(result => result.status === 'fulfilled' ? result.value : []).sort((a,b) => b.at-a.at)); if (results.some(r => r.status === 'rejected')) setProblem('โหลดประวัติบางส่วนไม่สำเร็จ ปิดแล้วเปิดใหม่เพื่อลองอีกครั้ง'); setLoading(false); });
    return () => { disposed = true; };
  }, [sourceKey]);
  const needle = query.trim().toLowerCase();
  const matches = entries.filter(entry => `${entry.text} ${entry.snippet} ${workspaces.find(ws => ws.id === entry.wsId)?.name || ''}`.toLowerCase().includes(needle));
  return <div className="history-panel"><input autoFocus aria-label="ค้นหาประวัติบทสนทนา" placeholder="ค้นหาคำถาม คำตอบ หรือชื่อโปรเจกต์…" value={query} onChange={event => setQuery(event.target.value)} />
    {loading && <p role="status">กำลังอ่านประวัติที่บันทึกไว้…</p>}{problem && <p role="alert">{problem}</p>}
    <div className="history-results">{matches.slice(0,100).map(entry => <button key={`${entry.wsId}:${entry.sessionId || ''}:${entry.id}`} onClick={() => onSelect(entry)}><small>{workspaces.find(ws => ws.id === entry.wsId)?.name} · {entry.mode} · {new Date(entry.at).toLocaleString('th-TH')}</small><strong>{entry.text}</strong><span>{entry.snippet.slice(Math.max(0,entry.snippet.toLowerCase().indexOf(needle)-60),Math.max(0,entry.snippet.toLowerCase().indexOf(needle)-60)+180)}</span></button>)}</div>
    {!loading && !matches.length && <p>ยังไม่มีบทสนทนาที่ตรงกับคำค้น</p>}{matches.length>100 && <p>แสดง 100 รายการแรก กรุณาระบุคำค้นให้แคบลง</p>}
  </div>;
}
