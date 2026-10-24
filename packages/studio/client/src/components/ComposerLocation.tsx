import { useEffect, useState } from 'react';
import { Folder, GitBranch } from 'lucide-react';
import type { Session, Workspace } from '../api';
import '../composer-location.css';

interface Context { cwd: string; git: string; branch: string | null; commit: string | null }
export function ComposerLocation({ workspace, recipients }: { workspace?: Workspace; recipients?: Session[] }) {
  const paths = [...new Set((recipients || []).map(session => session.cwd || workspace?.rootPath || '').filter(Boolean))];
  const multiple = paths.length > 1;
  const cwd = paths[0] || workspace?.rootPath || '';
  const sessionId = recipients?.[0]?.id;
  const endpoint = multiple || !workspace ? '' : sessionId ? `/api/terminals/${encodeURIComponent(sessionId)}/context` : `/api/workspaces/${encodeURIComponent(workspace.id)}/context`;
  const [result, setResult] = useState<{ key: string; value?: Context; error?: boolean }>();
  useEffect(() => {
    if (!endpoint) return;
    let disposed = false, loading = false;
    const controller = new AbortController();
    const load = async () => {
      if (loading || document.hidden) return;
      loading = true;
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw new Error('context unavailable');
        const value = await response.json() as Context;
        if (!value || typeof value.cwd !== 'string' || typeof value.git !== 'string') throw new Error('invalid context');
        if (!disposed) setResult({ key: endpoint, value });
      } catch { if (!disposed) setResult({ key: endpoint, error: true }); }
      finally { loading = false; }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    window.addEventListener('focus', load);
    return () => { disposed = true; controller.abort(); clearInterval(timer); window.removeEventListener('focus', load); };
  }, [endpoint, cwd]);
  const value = result?.key === endpoint ? result.value : undefined;
  const branch = value?.git === 'ready' ? value.branch || (value.commit ? `Detached HEAD · ${value.commit}` : 'อ่าน branch ไม่ได้') : value?.git === 'none' ? 'ไม่ได้ใช้ Git' : result?.key === endpoint ? 'อ่าน Git ไม่ได้' : 'กำลังอ่าน branch…';
  return <div className="composer-location" aria-label="พื้นที่ทำงานของข้อความนี้">
    <span className="composer-folder" title={multiple ? paths.join('\n') : cwd}><Folder size={13} /><span>{multiple ? `หลายโฟลเดอร์ (${paths.length})` : cwd || 'เลือกโฟลเดอร์ก่อนเริ่มงาน'}</span></span>
    {cwd && !multiple && <span className="composer-branch" title={branch}><GitBranch size={13} /><span>{branch}</span></span>}
    {multiple && <span className="composer-branch">ส่งตามโฟลเดอร์ของแต่ละ session</span>}
  </div>;
}
