import { useEffect, useState } from 'react';
import { RefreshCw, FileText } from 'lucide-react';
import { api } from '../api';
import type { ProjectContext, ContextFile } from '../../../server/ProjectContext';
import { tr } from '../i18n';
export function ProjectContextStatus({ workspaceId, sessionId, revision }: { workspaceId?: string; sessionId?: string; revision: string }) {
  const LABEL: Record<ContextFile['status'], string> = { included: tr("พร้อมแนบ"), native: tr("AI อ่านไฟล์นี้เองอยู่แล้ว"), missing: tr("ไม่พบไฟล์"), 'outside-root': tr("อยู่นอกโฟลเดอร์โปรเจกต์"), 'too-large': tr("ไฟล์ใหญ่เกิน 64 KB"), unsupported: tr("ไม่ใช่ไฟล์ข้อความที่รองรับ"), budget: tr("เกินพื้นที่บริบท"), duplicate: tr("รวมจากกฎโปรเจกต์แล้ว"), unreadable: tr("อ่านไฟล์ไม่ได้") };
  const [state, setState] = useState<{ context?: ProjectContext; error?: string; loading: boolean }>({ loading: true });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let disposed = false;
    const endpoint = sessionId ? `/api/terminals/${sessionId}/project-context` : workspaceId ? `/api/workspaces/${workspaceId}/project-context` : '';
    setState({ loading: !!endpoint });
    if (endpoint) void api<ProjectContext>(endpoint).then(context => {
      if (!disposed) setState({ context: Array.isArray(context.files) ? context : undefined, loading: false });
    }, error => { if (!disposed) setState({ error: error.message, loading: false }); });
    return () => { disposed = true; };
  }, [workspaceId, sessionId, revision, refresh]);
  const context = state.context;
  if (!workspaceId && !sessionId) return null;
  if (!state.loading && !state.error && (!context || !context.instructions && !context.files.length)) return null;
  const skipped = context?.files.filter(file => !['included', 'native', 'duplicate'].includes(file.status)) || [];
  return <details className="project-context-status">
    <summary title={tr("ตรวจสิ่งที่จะส่งให้ AI ในคำขอถัดไป")}><FileText size={12} />{state.loading ? tr("กำลังตรวจบริบท…") : state.error ? tr("ตรวจบริบทไม่สำเร็จ") : tr`บริบทโปรเจกต์${context?.instructions ? tr(" · มีกฎ") : ''}${context?.files.length ? tr` · ${context.files.filter(file => file.status === 'included').length} ไฟล์` : ''}`}{!!skipped.length && <span> {tr("· ใช้ไม่ได้")} {skipped.length}</span>}</summary>
    <div className="project-context-details">
      <p>{tr("ตรวจสำหรับข้อความถัดไป · ระบบอ่านไฟล์อีกครั้งเมื่อกดส่ง")}</p>
      {state.error && <p role="alert">{state.error}</p>}
      {context?.instructions && <p>{tr("คำสั่งประจำโปรเจกต์: พร้อมแนบ")}</p>}
      {context?.files.map((file, index) => <div key={`${file.source}:${file.path}:${index}`}><code>{file.path}</code><span className={['included', 'native', 'duplicate'].includes(file.status) ? '' : 'context-omitted'}>{LABEL[file.status]}</span></div>)}
      {context && !context.instructions && !context.files.length && <p>{tr("ยังไม่ได้ตั้งกฎหรือปักหมุดไฟล์")}</p>}
      <button type="button" className="text-button" onClick={() => setRefresh(value => value + 1)} disabled={state.loading}><RefreshCw size={12} />{tr("ตรวจอีกครั้ง")}</button>
    </div>
  </details>;
}
