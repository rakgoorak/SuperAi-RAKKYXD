import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, type Run, type Session, type Workspace } from '../api';
import { HEADLESS } from '../providers';
import { chatHistoryEntries, recentConversations, runHistoryEntries, type HistoryEntry, type HistoryMessage } from '../historyEntries';
import { providerIdentity } from '../providerIdentity';
import { ProviderBadge } from './ProviderBadge';
export type { HistoryEntry } from '../historyEntries';

const MODE_LABEL = { code: 'คุย AI / Terminal', agent: 'ทีม Agent', chat: 'เทียบคำตอบ' };

export function HistoryPanel({ workspaces, sessions, onSelect }: { workspaces: Workspace[]; sessions: Session[]; onSelect: (entry: HistoryEntry) => void }) {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState('');
  const [mode, setMode] = useState('');
  const [provider, setProvider] = useState('');
  const [revision, setRevision] = useState(0);
  const sourceKey = JSON.stringify([workspaces.map(ws => ws.id), sessions.map(s => [s.id, s.wsId, s.name, s.agentType, s.view])]);
  useEffect(() => {
    let disposed = false;
    setLoading(true); setProblem('');
    const loads: Promise<HistoryEntry[]>[] = [
      ...workspaces.map(ws => api<Run[]>(`/api/conversations/${ws.id}`).then(runHistoryEntries)),
      ...sessions.filter(s => s.wsId && !s.authOnly).map(session => HEADLESS.includes(session.agentType)
        ? api<{ items: HistoryMessage[] }>(`/api/terminals/${session.id}/chat`).then(chat => chatHistoryEntries(session, chat.items))
        : Promise.resolve(chatHistoryEntries(session, []))),
    ];
    void Promise.allSettled(loads).then(results => {
      if (disposed) return;
      setEntries(results.flatMap(result => result.status === 'fulfilled' ? result.value : []).sort((a, b) => b.at - a.at));
      if (results.some(r => r.status === 'rejected')) setProblem('โหลดประวัติบางส่วนไม่สำเร็จ กดโหลดใหม่เพื่อลองอีกครั้ง');
      setLoading(false);
    });
    return () => { disposed = true; };
    // Polling replaces these objects; only reload when history-relevant fields change.
  }, [sourceKey, revision]);
  const needle = query.trim().toLowerCase();
  const providers = [...new Set(entries.flatMap(entry => entry.providers))].sort();
  const filtered = entries.filter(entry => (!mode || entry.mode === mode) && (!provider || entry.providers.includes(provider)));
  const matches = needle ? filtered.filter(entry => [entry.text, entry.snippet, workspaces.find(ws => ws.id === entry.wsId)?.name, ...entry.providers.map(id => providerIdentity(id).label)].join(' ').toLowerCase().includes(needle)) : recentConversations(filtered);
  return <div className="history-panel">
    <input autoFocus aria-label="ค้นหาประวัติบทสนทนา" placeholder="ค้นหาคำถาม คำตอบ ชื่อ AI หรือโปรเจกต์…" value={query} onChange={event => setQuery(event.target.value)} />
    <div className="history-filters">
      <label>รูปแบบ<select aria-label="กรองประวัติตามโหมด" value={mode} onChange={event => setMode(event.target.value)}><option value="">ทุกโหมด</option>{Object.entries(MODE_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>AI<select aria-label="กรองประวัติตาม AI" value={provider} onChange={event => setProvider(event.target.value)}><option value="">ทุก AI</option>{providers.map(id => <option key={id} value={id}>{providerIdentity(id).label}</option>)}</select></label>
      <button className="text-button" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={13} />โหลดใหม่</button>
    </div>
    <p className="history-view-label">{needle ? `ผลการค้นหา · ${matches.length} ข้อความ` : `บทสนทนาล่าสุด · ${matches.length} ห้อง`}</p>
    {loading && <p role="status">กำลังอ่านประวัติที่บันทึกไว้…</p>}{problem && <p role="alert">{problem}</p>}
    <div className="history-results">{matches.slice(0, 100).map(entry => {
      const start = needle ? Math.max(0, entry.snippet.toLowerCase().indexOf(needle) - 60) : 0;
      return <button key={`${entry.wsId}:${entry.sessionId || ''}:${entry.id}`} onClick={() => onSelect(entry)}>
        <small>{workspaces.find(ws => ws.id === entry.wsId)?.name} · {MODE_LABEL[entry.mode]} · {new Date(entry.at).toLocaleString('th-TH')}</small>
        <strong>{needle ? entry.text : entry.title || entry.text}</strong>
        <span className="history-providers">{entry.providers.map(id => <ProviderBadge key={id} provider={id} />)}</span>
        <span>{entry.snippet.slice(start, start + 180) || entry.text}</span>
      </button>;
    })}</div>
    {!loading && !matches.length && <p>{needle || mode || provider ? 'ไม่พบบทสนทนาที่ตรงกัน ลองเปลี่ยนคำค้นหรือตัวกรอง' : 'ยังไม่มีบทสนทนา กดคุยใหม่เพื่อเริ่มกับ AI ที่ต้องการ'}</p>}
    {matches.length > 100 && <p>แสดง 100 รายการแรก กรุณาระบุคำค้นให้แคบลง</p>}
  </div>;
}
