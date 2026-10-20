import { useState } from 'react';
import { Bookmark, Plus, Trash2 } from 'lucide-react';
import type { Cli } from '../api';
export interface LaunchSeat { type: string; count: number; }
interface Preset { id: string; name: string; seats: LaunchSeat[]; }
export function LaunchPresets({ clis, type, count, onChoose, onError }: {
  clis: Cli[]; type: string; count: number; onChoose: (seats: LaunchSeat[]) => void; onError: (text: string) => void;
}) {
  const [presets, setPresets] = useState<Preset[]>(() => {
    try { const data = JSON.parse(localStorage.getItem('superai-launch-presets-v1') || '[]');
      // Gemini CLI was retired; saved sets carry over to its replacement.
      if (Array.isArray(data)) for (const p of data) for (const s of p?.seats || []) if (s?.type === 'gemini') s.type = 'antigravity';
      return Array.isArray(data) ? data.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.seats) && p.seats.length && p.seats.every((s: LaunchSeat) => typeof s.type === 'string' && Number.isInteger(s.count) && s.count >= 1 && s.count <= 12)) : [];
    } catch { return []; }
  });
  const [draft, setDraft] = useState<LaunchSeat[]>([]);
  const [name, setName] = useState('');
  const update = (next: Preset[]) => {
    try { localStorage.setItem('superai-launch-presets-v1', JSON.stringify(next)); setPresets(next); }
    catch { onError('บันทึกชุด CLI บนเครื่องไม่ได้'); }
  };
  const add = () => {
    const next = draft.some(s => s.type === type) ? draft.map(s => s.type === type ? { ...s, count: s.count + count } : s) : [...draft, { type, count }];
    if (next.reduce((n, s) => n + s.count, 0) > 12) return onError('ชุดหนึ่งเปิดได้ไม่เกิน 12 session');
    if (next.some(s => s.type === 'freebuff' && s.count > 1)) return onError('Freebuff อยู่ในชุดได้เพียง 1 session');
    setDraft(next);
  };
  return <section className="launch-presets" aria-label="ชุด CLI ที่บันทึก">
    <h3><Bookmark size={13} />ชุด CLI</h3>
    <div className="preset-list">{presets.map(p => <div className="preset-card" key={p.id}>
      <button disabled={p.seats.some(s => !clis.find(c => c.id === s.type)?.available)} onClick={() => onChoose(p.seats)}>
        <strong>{p.name}</strong><small>{p.seats.map(s => `${clis.find(c => c.id === s.type)?.name || s.type} ×${s.count}`).join(' · ')}</small>
      </button><button className="icon-button" title={`ลบชุด ${p.name}`} onClick={() => update(presets.filter(x => x.id !== p.id))}><Trash2 size={12} /></button>
    </div>)}</div>
    <details><summary>สร้างชุด CLI ของคุณ</summary>
      <p className="muted">เลือก CLI และจำนวนด้านล่าง แล้วเพิ่มเข้าชุดได้หลายชนิด</p>
      <button className="text-button" onClick={add}><Plus size={12} />เพิ่ม {clis.find(c => c.id === type)?.name || type} ×{count} เข้าชุด</button>
      {!!draft.length && <><p className="preset-draft">{draft.map(s => `${clis.find(c => c.id === s.type)?.name || s.type} ×${s.count}`).join(' + ')}</p>
        <div className="input-action"><input aria-label="ชื่อชุด CLI" placeholder="เช่น ทีมสร้างเว็บไซต์" maxLength={60} value={name} onChange={e => setName(e.target.value)} />
          <button className="secondary" disabled={!name.trim()} onClick={() => {
            if (!name.trim()) return;
            update([...presets, { id: crypto.randomUUID(), name: name.trim(), seats: draft }]); setDraft([]); setName('');
          }}>บันทึกชุด</button><button className="text-button" onClick={() => setDraft([])}>ล้างชุด</button></div>
      </>}
    </details>
  </section>;
}
