import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, Plus, Trash2, X, LoaderCircle, CheckCircle2, AlertCircle, FolderGit2 } from 'lucide-react';
import { getWorktrees, createWorktree, deleteWorktree, type WorktreeInfo } from '../api';
import '../worktree-modal.css';
import { tr } from '../i18n';

export interface WorktreeModalProps {
  open: boolean;
  onClose: () => void;
  wsId: string;
  onSelectWorktree?: (worktree: WorktreeInfo) => void;
  onWorktreeCreated?: (worktree: WorktreeInfo) => void;
}

export function WorktreeModal({ open, onClose, wsId, onSelectWorktree, onWorktreeCreated }: WorktreeModalProps) {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [newBranch, setNewBranch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchWorktrees = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWorktrees(wsId);
      setWorktrees(Array.isArray(data?.worktrees) ? data.worktrees : []);
    } catch (err: any) {
      setError(err.message || tr("อ่านข้อมูล Worktree ไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useEffect(() => {
    if (open) {
      fetchWorktrees();
      setNewBranch('');
      setError(null);
      setNotice(null);
    }
  }, [open, fetchWorktrees]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const branch = newBranch.trim();
    if (!branch) {
      setError(tr("กรุณาระบุชื่อ Branch"));
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await createWorktree(wsId, branch);
      setNewBranch('');
      setNotice(tr`สร้าง Worktree "${branch}" สำเร็จแล้ว`);
      await fetchWorktrees();
      if (onWorktreeCreated && res.worktree) {
        onWorktreeCreated(res.worktree);
      }
    } catch (err: any) {
      setError(err.message || tr("สร้าง Worktree ไม่สำเร็จ"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (wt: WorktreeInfo) => {
    if (wt.isMain) return;
    if (!window.confirm(tr`ต้องการลบ Worktree "${wt.branch}" และโฟลเดอร์นี้ใช่ไหม?`)) return;
    setDeletingPath(wt.path);
    setError(null);
    try {
      await deleteWorktree(wsId, wt.path, true);
      setNotice(tr`ลบ Worktree "${wt.branch}" เรียบร้อยแล้ว`);
      await fetchWorktrees();
    } catch (err: any) {
      setError(err.message || tr("ลบ Worktree ไม่สำเร็จ"));
    } finally {
      setDeletingPath(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="worktree-modal-backdrop"
      onClick={onClose}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={tr("จัดการ Git Worktrees")}
    >
      <div className="worktree-modal-card" onClick={e => e.stopPropagation()}>
        <header className="worktree-modal-header">
          <div className="worktree-modal-title">
            <FolderGit2 size={18} className="worktree-title-icon" />
            <div>
              <h3>{tr("จัดการ Git Worktrees (คู่ขนาน)")}</h3>
              <p>{tr("แยกโฟลเดอร์ทำงานเพื่อแก้โค้ดพร้อมกันได้ 100% โดยไม่ทับซ้อนกัน")}</p>
            </div>
          </div>
          <button type="button" className="worktree-modal-close" onClick={onClose} aria-label={tr("ปิดหน้าต่าง")}>
            <X size={16} />
          </button>
        </header>

        {notice && (
          <div className="worktree-alert success">
            <CheckCircle2 size={14} />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="worktree-alert error">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form className="worktree-create-form" onSubmit={handleCreate}>
          <label htmlFor="wt-branch-input" className="sr-only">{tr("ชื่อ Worktree หรือ Branch")}</label>
          <div className="worktree-input-group">
            <GitBranch size={14} className="input-icon" />
            <input
              id="wt-branch-input"
              type="text"
              placeholder={tr("ตั้งชื่อ Branch ใหม่ เช่น feature-auth, fix-login")}
              value={newBranch}
              onChange={e => setNewBranch(e.target.value)}
              disabled={creating}
              autoFocus
            />
          </div>
          <button type="submit" className="btn-create-worktree" disabled={creating || !newBranch.trim()}>
            {creating ? <LoaderCircle size={14} className="spin" /> : <Plus size={14} />}
            <span>{tr("สร้าง Worktree")}</span>
          </button>
        </form>

        <div className="worktree-list-container">
          <div className="worktree-list-head">
            <span>{tr("Worktrees ที่มีอยู่ (")}{worktrees.length})</span>
          </div>

          {loading ? (
            <div className="worktree-loading">
              <LoaderCircle size={18} className="spin" />
              <span>{tr("กำลังโหลดข้อมูล Worktrees...")}</span>
            </div>
          ) : worktrees.length === 0 ? (
            <div className="worktree-empty">
              <span>{tr("ไม่พบข้อมูล Worktrees หรือยังไม่ได้เปิดเป็น Git Repository")}</span>
            </div>
          ) : (
            <div className="worktree-items">
              {worktrees.map((wt) => {
                const isDeleting = deletingPath === wt.path;
                return (
                  <div key={wt.path} className={`worktree-item ${wt.isCurrent ? 'active' : ''} ${wt.isMain ? 'main' : ''}`}>
                    <div className="worktree-item-info">
                      <div className="worktree-item-title">
                        <GitBranch size={14} />
                        <strong>{wt.branch}</strong>
                        {wt.isMain && <span className="badge-main">Main Repo</span>}
                        {wt.isCurrent && <span className="badge-current">{tr("กำลังใช้งาน")}</span>}
                      </div>
                      <div className="worktree-item-meta">
                        <span className="commit-hash" title={`Commit: ${wt.commit}`}>{wt.commit}</span>
                        <span className="item-path" title={wt.path}>{wt.relativeDir}</span>
                      </div>
                    </div>

                    <div className="worktree-item-actions">
                      {onSelectWorktree && !wt.isCurrent && (
                        <button
                          type="button"
                          className="btn-select-wt"
                          onClick={() => {
                            onSelectWorktree(wt);
                            onClose();
                          }}
                          title={tr("สลับไปยัง Worktree นี้")}
                        >
                          {tr("สลับ")}
                        </button>
                      )}
                      {!wt.isMain && (
                        <button
                          type="button"
                          className="btn-delete-wt"
                          onClick={() => handleDelete(wt)}
                          disabled={isDeleting}
                          title={tr("ลบ Worktree นี้")}
                          aria-label={tr`ลบ Worktree ${wt.branch}`}
                        >
                          {isDeleting ? <LoaderCircle size={13} className="spin" /> : <Trash2 size={13} />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="worktree-modal-footer">
          <small>
            {tr("โฟลเดอร์")} <code>.worktrees/</code> {tr("จะถูกป้องกันใน")} <code>.gitignore</code> {tr("ให้อัตโนมัติ ไม่ต้องกังวลเรื่องไฟล์หลุดเข้า Git")}
          </small>
        </footer>
      </div>
    </div>
  );
}
