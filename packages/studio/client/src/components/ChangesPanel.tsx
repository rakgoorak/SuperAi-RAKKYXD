import { useEffect, useState } from 'react';
import { api, getWorktrees, mergeWorktree, type WorktreeInfo } from '../api';
import { VisualDiffViewer } from './VisualDiffViewer';
import { WorktreeModal } from './WorktreeModal';
import { GitBranch, GitMerge, LoaderCircle, CheckCircle2, AlertCircle, FolderGit2 } from 'lucide-react';

export function ChangesPanel({ workspaceId, onPreview }: { workspaceId: string; onPreview: () => void }) {
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
    api<{ files: string[] }>(`/api/workspaces/${workspaceId}/changes`)
      .then(data => {
        if (!disposed) {
          setFiles(data.files);
          setSelected(prev => (prev && data.files.includes(prev) ? prev : (data.files[0] || '')));
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
        if (!disposed) setWorktreeInfo(data);
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
          message: `รวมโค้ดจาก "${branch}" เข้าสู่ main สำเร็จแล้ว! (Commit: ${res.commit})${res.deleted ? ' พร้อมลบ Worktree เรียบร้อย' : ''}`,
        });
        setRevision(n => n + 1);
      } else if (res.conflict) {
        setMergeNotice({
          type: 'error',
          message: res.error || 'เกิดข้อขัดแย้งในการรวมโค้ด (Merge Conflict) ในไฟล์ที่ทับซ้อนกัน',
        });
      }
    } catch (err: any) {
      setMergeNotice({
        type: 'error',
        message: err.message || 'รวมโค้ดไม่สำเร็จ',
      });
    } finally {
      setIsMerging(false);
    }
  };

  const isCurrentWorktree = Boolean(worktreeInfo?.isWorktree && worktreeInfo.current && !worktreeInfo.current.isMain);

  return (
    <div className="changes-panel">
      {/* Smart Merge Banner when working inside a worktree */}
      {isCurrentWorktree && worktreeInfo?.current && (
        <aside className="worktree-smart-merge-banner" aria-label="แถบรวมโค้ด Worktree เข้า main">
          <div className="worktree-merge-header">
            <GitBranch size={16} />
            <span>
              กำลังทำงานบน Worktree: <strong>{worktreeInfo.current.branch}</strong> (แตกมาจาก main)
            </span>
          </div>
          <p className="worktree-merge-details">
            ต้องการรวมการเปลี่ยนแปลงทั้งหมดใน Worktree นี้เข้าสู่ main หรือไม่?
          </p>
          <div className="worktree-merge-actions-row">
            <label className="worktree-delete-checkbox">
              <input
                type="checkbox"
                checked={deleteAfterMerge}
                onChange={e => setDeleteAfterMerge(e.target.checked)}
              />
              <span>ลบ Worktree หลังรวมเสร็จ</span>
            </label>
            <button
              type="button"
              className="btn-merge-action"
              onClick={handleMergeToMain}
              disabled={isMerging}
            >
              {isMerging ? <LoaderCircle size={13} className="spin" /> : <GitMerge size={13} />}
              <span>รวมโค้ดเข้า main ทันที (Merge)</span>
            </button>
          </div>
          {mergeNotice && (
            <div className={`worktree-alert ${mergeNotice.type}`} style={{ margin: '8px 0 0 0' }}>
              {mergeNotice.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              <span>{mergeNotice.message}</span>
            </div>
          )}
        </aside>
      )}

      <div className="recovery-actions">
        <button
          type="button"
          className={`secondary btn-worktree-trigger ${isCurrentWorktree ? 'is-worktree' : ''}`}
          onClick={() => setWorktreeModalOpen(true)}
          title="จัดการ Git Worktrees"
        >
          <FolderGit2 size={13} />
          <span>{worktreeInfo?.current ? (isCurrentWorktree ? `🌿 ${worktreeInfo.current.branch}` : '🌿 main') : '🌿 Worktrees'}</span>
        </button>
        <button className="secondary" onClick={() => setRevision(n => n + 1)}>
          ตรวจไฟล์อีกครั้ง
        </button>
        <button className="primary" onClick={onPreview}>
          เปิด Preview
        </button>
      </div>
      <p className="muted">
        ไฟล์ที่เปลี่ยนเทียบกับ Git HEAD ของโปรเจกต์ รวมการแก้ไขของคุณด้วย ไม่ใช่เฉพาะงานของ AI
      </p>
      {loading && <p role="status">กำลังตรวจ Git…</p>}
      {problem && <p role="alert">{problem}</p>}

      <div className="changes-grid">
        <nav aria-label="ไฟล์ที่เปลี่ยน">
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
            <p>{files.length ? 'เลือกไฟล์เพื่อดูเนื้อหาหรือ diff' : 'ยังไม่มีไฟล์ที่เปลี่ยน'}</p>
          )}
        </section>
      </div>

      <WorktreeModal
        open={worktreeModalOpen}
        onClose={() => setWorktreeModalOpen(false)}
        wsId={workspaceId}
        onWorktreeCreated={() => setRevision(n => n + 1)}
      />
    </div>
  );
}
