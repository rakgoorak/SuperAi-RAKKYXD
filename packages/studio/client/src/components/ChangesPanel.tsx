import { useEffect, useState } from 'react';
import { api } from '../api';
export function ChangesPanel({ workspaceId, onPreview }: { workspaceId: string; onPreview: () => void }) {
  const [files, setFiles] = useState<string[]>([]);
  const [file, setFile] = useState<{name:string;content:string;diff:string;deleted:boolean}|null>(null);
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState('');
  const [view, setView] = useState('diff');
  useEffect(() => { let disposed = false; setProblem(''); setLoading(true); setFile(null); setSelected(''); api<{files:string[]}>(`/api/workspaces/${workspaceId}/changes`).then(data=>{if(!disposed)setFiles(data.files);}).catch(error=>{if(!disposed){setProblem(error.message);setFiles([]);}}).finally(()=>{if(!disposed)setLoading(false);}); return ()=>{disposed=true;}; },[workspaceId,revision]);
  useEffect(() => { if(!selected)return;let disposed=false;setFile(null);setProblem('');api<{name:string;content:string;diff:string;deleted:boolean}>(`/api/workspaces/${workspaceId}/changed-file?path=${encodeURIComponent(selected)}`).then(value=>{if(!disposed)setFile(value);}).catch(error=>{if(!disposed)setProblem(error.message);});return()=>{disposed=true;}; },[selected,workspaceId]);
  return <div className="changes-panel"><div className="recovery-actions"><button className="secondary" onClick={()=>setRevision(n=>n+1)}>ตรวจไฟล์อีกครั้ง</button><button className="primary" onClick={onPreview}>เปิด Preview</button></div><p className="muted">ไฟล์ที่เปลี่ยนเทียบกับ Git HEAD ของโปรเจกต์ รวมการแก้ไขของคุณด้วย ไม่ใช่เฉพาะงานของ AI</p>{loading&&<p role="status">กำลังตรวจ Git…</p>}{problem&&<p role="alert">{problem}</p>}
  <div className="changes-grid"><nav aria-label="ไฟล์ที่เปลี่ยน">{files.map(name=><button key={name} aria-current={selected===name?'page':undefined} onClick={()=>setSelected(name)}>{name}</button>)}</nav><section>{file?<><h3>{file.name}{file.deleted?' · ลบแล้ว':''}</h3><div className="recovery-actions"><button aria-pressed={view==='diff'} onClick={()=>setView('diff')}>ดู diff</button><button aria-pressed={view==='content'} onClick={()=>setView('content')}>เปิดไฟล์</button></div><pre tabIndex={0}>{view==='diff' ? file.diff || 'ไฟล์ใหม่หรือยังไม่มี diff — เลือกเปิดไฟล์เพื่ออ่านเนื้อหา' : file.content || (file.deleted?'ไฟล์นี้ถูกลบแล้ว':'ไฟล์ว่าง')}</pre></>:<p>{files.length?'เลือกไฟล์เพื่อดูเนื้อหาหรือ diff':'ยังไม่มีไฟล์ที่เปลี่ยน'}</p>}</section></div></div>;
}
