import { useEffect, useState } from 'react';
import { api, getWorktrees, mergeWorktree, type WorktreeInfo, type Session } from '../api';
import { SelfHealingModal } from './SelfHealingModal';
import { CrossReviewModal } from './CrossReviewModal';
import { VisualDiffViewer } from './VisualDiffViewer';
import { WorktreeModal } from './WorktreeModal';
import { GitBranch, GitMerge, LoaderCircle, CheckCircle2, AlertCircle, FolderGit2, Activity, Scale } from 'lucide-react';
import { tr } from '../i18n';

export function ChangesPanel({
  workspaceId,
  sessions = [],
  onPreview,
  onSelectSession,
}: {
  workspaceId: string;
  sessions?: Session[];
  onPreview: () => void;
  onSelectSession?: (id: string) => void;
}) {
  const [selfHealOpen, setSelfHealOpen] = useState(false);
  const [crossReviewOpen, setCrossReviewOpen] = useState(false);
  const [localSessions, setLocalSessions] = useState<Session[]>(sessions);

  useEffect(() => {
    if (sessions && sessions.length > 0) {
      setLocalSessions(sessions);
    } else {
      api<Session[]>('/api/sessions')
        .then(list => {
          if (Array.isArray(list)) setLocalSessions(list);
        })
        .catch(() => {});
    }
  }, [sessions]);
  const [files, setFiles] = useState<string[]>([]);
  const [file, setFile] = useState<{
    name: string;
    content: string;
    originalContent?: string;
    diff: string;
    deleted: boolean;
  } | null>(null);
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState('');

  // Worktree states
  const [worktreeInfo, setWorktreeInfo] = useState<{
    worktrees: WorktreeInfo[];
    current: WorktreeInfo | null;
    isWorktree: boolean;
  } | null>(null);
  const [worktreeModalOpen, setWorktreeModalOpen] = useState(false);
  const [deleteAfterMerge, setDeleteAfterMerge] = useState(true);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeNotice, setMergeNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let disposed = false;
    setProblem('');
    setLoading(true);
    api<{ files?: string[] }>(`/api/workspaces/${workspaceId}/changes`)
      .then(data => {
        if (!disposed) {
          const list = Array.isArray(data?.files) ? data.files : [];
          setFiles(list);
          setSelected(prev => (prev && list.includes(prev) ? prev : (list[0] || '')));
        }
      })
      .catch(error => {
        if (!disposed) {
          setProblem(error.message);
          setFiles([]);
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [workspaceId, revision]);

  useEffect(() => {
    let disposed = false;
    getWorktrees(workspaceId)
      .then(data => {
        if (!disposed && data && Array.isArray(data.worktrees)) {
          setWorktreeInfo(data);
        } else if (!disposed) {
          setWorktreeInfo(null);
        }
      })
      .catch(() => {
        if (!disposed) setWorktreeInfo(null);
      });
    return () => {
      disposed = true;
    };
  }, [workspaceId, revision]);

  useEffect(() => {
    if (!selected) {
      setFile(null);
      return;
    }
    let disposed = false;
    setFile(null);
    setProblem('');
    api<{
      name: string;
      content: string;
      originalContent?: string;
      diff: string;
      deleted: boolean;
    }>(`/api/workspaces/${workspaceId}/changed-file?path=${encodeURIComponent(selected)}`)
      .then(value => {
        if (!disposed) setFile(value);
      })
      .catch(error => {
        if (!disposed) setProblem(error.message);
      });
    return () => {
      disposed = true;
    };
  }, [selected, workspaceId, revision]);

  const handleMergeToMain = async () => {
    if (!worktreeInfo?.current || worktreeInfo.current.isMain) return;
    const branch = worktreeInfo.current.branch;
    setIsMerging(true);
    setMergeNotice(null);
    try {
      const res = await mergeWorktree(workspaceId, branch, 'main', deleteAfterMerge);
      if (res.success) {
        setMergeNotice({
          type: 'success',
          message: tr`รวมโค้ดจาก "${branch}" เข้าสู่ main สำเร็จแล้ว! (Commit: ${res.commit})${res.deleted ? tr(" พร้อมลบ Worktree เรียบร้อย") : ''}`,
        });
        setRevision(n => n + 1);
      } else if (res.conflict) {
        setMergeNotice({
          type: 'error',
          message: res.error || tr("เกิดข้อขัดแย้งในการรวมโค้ด (Merge Conflict) ในไฟล์ที่ทับซ้อนกัน"),
        });
      }
    } catch (err: any) {
      setMergeNotice({
        type: 'error',
        message: err.message || tr("รวมโค้ดไม่สำเร็จ"),
      });
    } finally {
      setIsMerging(false);
    }
  };

  const isCurrentWorktree = Boolean(worktreeInfo?.isWorktree && worktreeInfo.current && !worktreeInfo.current.isMain);

  return (
    <div className="changes-panel">
      {mergeNotice && (
        <div className={`worktree-alert ${mergeNotice.type}`} style={{ margin: '0 0 12px 0' }}>
          {mergeNotice.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{mergeNotice.message}</span>
        </div>
      )}

      {/* Smart Merge Banner when working inside a worktree */}
      {isCurrentWorktree && worktreeInfo?.current && (
        <aside className="worktree-smart-merge-banner" aria-label={tr("แถบรวมโค้ด Worktree เข้า main")}>
          <div className="worktree-merge-header">
            <GitBranch size={16} />
            <span>
              {tr("กำลังทำงานบน Worktree:")} <strong>{worktreeInfo.current.branch}</strong> {tr("(แตกมาจาก main)")}
            </span>
          </div>
          <p className="worktree-merge-details">
            {tr("ต้องการรวมการเปลี่ยนแปลงทั้งหมดใน Worktree นี้เข้าสู่ main หรือไม่?")}
          </p>
          <div className="worktree-merge-actions-row">
            <label className="worktree-delete-checkbox">
              <input
                type="checkbox"
                checked={deleteAfterMerge}
                onChange={e => setDeleteAfterMerge(e.target.checked)}
              />
              <span>{tr("ลบ Worktree หลังรวมเสร็จ")}</span>
            </label>
            <button
              type="button"
              className="btn-merge-action"
              onClick={handleMergeToMain}
              disabled={isMerging}
            >
              {isMerging ? <LoaderCircle size={13} className="spin" /> : <GitMerge size={13} />}
              <span>{tr("รวมโค้ดเข้า main ทันที (Merge)")}</span>
            </button>
          </div>
        </aside>
      )}

      <div className="recovery-actions">
        <button
          type="button"
          className={`secondary btn-worktree-trigger ${isCurrentWorktree ? 'is-worktree' : ''}`}
          onClick={() => setWorktreeModalOpen(true)}
          title={tr("จัดการ Git Worktrees")}
        >
          <FolderGit2 size={13} />
          <span>{worktreeInfo?.current ? (isCurrentWorktree ? worktreeInfo.current.branch : 'main') : 'Worktrees'}</span>
        </button>
        <button
          type="button"
          className="secondary btn-self-heal-trigger"
          onClick={() => setSelfHealOpen(true)}
          title={tr("รันคำสั่งทดสอบและซ่อมแซมโค้ดอัตโนมัติ (Self-Healing Loop)")}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Activity size={13} style={{ color: '#10b981' }} />
          <span>Self-Healing</span>
        </button>
        <button
          type="button"
          className="secondary btn-cross-review-trigger"
          onClick={() => setCrossReviewOpen(true)}
          title={tr("ให้ AI ข้ามค่ายช่วยตรวจทานหาข้อบกพร่อง (AI Cross-Examination)")}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Scale size={13} style={{ color: '#6366f1' }} />
          <span>AI Cross-Review</span>
        </button>
        <button className="secondary" onClick={() => setRevision(n => n + 1)}>
          {tr("ตรวจไฟล์อีกครั้ง")}
        </button>
        <button className="primary" onClick={onPreview}>
          {tr("เปิด Preview")}
        </button>
      </div>
      <p className="muted">
        {tr("ไฟล์ที่เปลี่ยนเทียบกับ Git HEAD ของโปรเจกต์ รวมการแก้ไขของคุณด้วย ไม่ใช่เฉพาะงานของ AI")}
      </p>
      {loading && <p role="status">{tr("กำลังตรวจ Git…")}</p>}
      {problem && <p role="alert">{problem}</p>}

      <div className="changes-grid">
        <nav aria-label={tr("ไฟล์ที่เปลี่ยน")}>
          {files.map(name => (
            <button
              key={name}
              aria-current={selected === name ? 'page' : undefined}
              onClick={() => setSelected(name)}
            >
              {name}
            </button>
          ))}
        </nav>
        <section>
          {file ? (
            <VisualDiffViewer
              workspaceId={workspaceId}
              filePath={file.name}
              original={file.originalContent ?? ''}
              modified={file.content ?? ''}
              diffText={file.diff}
              deleted={file.deleted}
              onActionComplete={() => setRevision(n => n + 1)}
              onError={err => setProblem(err)}
            />
          ) : (
            <p>{files.length ? tr("เลือกไฟล์เพื่อดูเนื้อหาหรือ diff") : tr("ยังไม่มีไฟล์ที่เปลี่ยน")}</p>
          )}
        </section>
      </div>

      <WorktreeModal
        open={worktreeModalOpen}
        onClose={() => setWorktreeModalOpen(false)}
        wsId={workspaceId}
        onWorktreeCreated={() => setRevision(n => n + 1)}
      />

      {selfHealOpen && (
        <SelfHealingModal
          workspaceId={workspaceId}
          sessions={localSessions}
          onClose={() => setSelfHealOpen(false)}
          onSelectSession={onSelectSession}
        />
      )}

      {crossReviewOpen && (
        <CrossReviewModal
          workspaceId={workspaceId}
          sessions={localSessions}
          onClose={() => setCrossReviewOpen(false)}
          onApplied={() => setRevision(n => n + 1)}
        />
      )}
    </div>
  );
}
