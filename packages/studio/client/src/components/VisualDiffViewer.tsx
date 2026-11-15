import { useEffect, useMemo, useRef, useState } from 'react';
import { AlignJustify, Check, Columns2, Copy, FileText, Minus, Plus, RotateCcw } from 'lucide-react';
import { post } from '../api';
import {
  computeDiffLines,
  computeSideBySideRows,
  type DiffLine,
  type DiffType,
  type SideBySideRow,
  splitLines,
} from '../diffUtils';
import '../diff-viewer.css';
import { tr, useTranslation } from '../i18n';

export interface VisualDiffViewerProps {
  workspaceId: string;
  filePath: string;
  original: string;
  modified: string;
  diffText?: string;
  deleted?: boolean;
  onActionComplete?: () => void;
  onError?: (error: string) => void;
}

export {
  computeDiffLines,
  computeSideBySideRows,
  type DiffLine,
  type DiffType,
  type SideBySideRow,
  splitLines,
};

export function VisualDiffViewer({
  workspaceId,
  filePath,
  original,
  modified,
  diffText: _diffText,
  deleted,
  onActionComplete,
  onError,
}: VisualDiffViewerProps) {
  const { locale } = useTranslation();
  const [mode, setMode] = useState<'side-by-side' | 'inline' | 'file'>('side-by-side');
  const [copied, setCopied] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  // Compute diff lines
  const diffLines = useMemo(() => {
    return computeDiffLines(original, modified, deleted);
  }, [original, modified, deleted]);

  // Compute side-by-side rows
  const sideBySideRows = useMemo(() => {
    return computeSideBySideRows(diffLines);
  }, [diffLines]);

  // Stats: additions and deletions
  const stats = useMemo(() => {
    let added = 0;
    let del = 0;
    for (const l of diffLines) {
      if (l.type === 'add') added++;
      else if (l.type === 'delete') del++;
    }
    return { added, del };
  }, [diffLines]);

  // Status Badge
  const statusBadge = useMemo(() => {
    if (deleted) {
      return { label: tr("ลบแล้ว"), className: 'badge-deleted' };
    }
    if ((!original || original.trim() === '') && modified) {
      return { label: tr("สร้างใหม่"), className: 'badge-added' };
    }
    return { label: tr("แก้ไข"), className: 'badge-modified' };
  }, [deleted, original, modified, locale]);

  // Reset scroll and discard confirmation on file change
  useEffect(() => {
    if (leftScrollRef.current) {
      leftScrollRef.current.scrollTop = 0;
      leftScrollRef.current.scrollLeft = 0;
    }
    if (rightScrollRef.current) {
      rightScrollRef.current.scrollTop = 0;
      rightScrollRef.current.scrollLeft = 0;
    }
    setConfirmDiscard(false);
  }, [filePath]);

  // Synchronized scroll handlers for side-by-side view
  const handleLeftScroll = () => {
    if (isSyncingScroll.current) return;
    const left = leftScrollRef.current;
    const right = rightScrollRef.current;
    if (!left || !right) return;
    isSyncingScroll.current = true;
    right.scrollTop = left.scrollTop;
    right.scrollLeft = left.scrollLeft;
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const handleRightScroll = () => {
    if (isSyncingScroll.current) return;
    const left = leftScrollRef.current;
    const right = rightScrollRef.current;
    if (!left || !right) return;
    isSyncingScroll.current = true;
    left.scrollTop = right.scrollTop;
    left.scrollLeft = right.scrollLeft;
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  // Actions
  const handleStage = async () => {
    setActionLoading(true);
    try {
      await post(`/api/workspaces/${workspaceId}/files/stage`, { filePath });
      onActionComplete?.();
    } catch (err) {
      onError?.((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnstage = async () => {
    setActionLoading(true);
    try {
      await post(`/api/workspaces/${workspaceId}/files/unstage`, { filePath });
      onActionComplete?.();
    } catch (err) {
      onError?.((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDiscard = async () => {
    setActionLoading(true);
    try {
      await post(`/api/workspaces/${workspaceId}/files/discard`, { filePath });
      setConfirmDiscard(false);
      onActionComplete?.();
    } catch (err) {
      onError?.((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyPath = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(filePath);
      } else {
        const input = document.createElement('input');
        input.value = filePath;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="visual-diff-viewer">
      {/* Header Toolbar */}
      <header className="diff-toolbar">
        <div className="diff-toolbar-left">
          <div className="diff-file-info">
            <span className="diff-file-name" title={filePath}>
              {filePath}
            </span>
            <span className={`diff-status-badge ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
            <div className="diff-stats" aria-label={tr("สถิติการเปลี่ยนแปลง")}>
              {stats.added > 0 && <span className="diff-stat-add">+{stats.added}</span>}
              {stats.del > 0 && <span className="diff-stat-del">-{stats.del}</span>}
            </div>
          </div>
        </div>

        <div className="diff-toolbar-right">
          {/* View mode toggle */}
          <div className="diff-btn-group" role="group" aria-label={tr("โหมดแสดงผล")}>
            <button
              type="button"
              className={`diff-btn-group-item ${mode === 'side-by-side' ? 'active' : ''}`}
              onClick={() => setMode('side-by-side')}
              title={tr("Side-by-Side (เทียบ 2 ฝั่ง)")}
            >
              <Columns2 size={13} />
              <span>{tr("เทียบ 2 ฝั่ง")}</span>
            </button>
            <button
              type="button"
              className={`diff-btn-group-item ${mode === 'inline' ? 'active' : ''}`}
              onClick={() => setMode('inline')}
              title={tr("Inline (บรรทัดรวม)")}
            >
              <AlignJustify size={13} />
              <span>{tr("บรรทัดรวม")}</span>
            </button>
            <button
              type="button"
              className={`diff-btn-group-item ${mode === 'file' ? 'active' : ''}`}
              onClick={() => setMode('file')}
              title={tr("เปิดไฟล์ (ดูเนื้อหาไฟล์)")}
            >
              <FileText size={13} />
              <span>{tr("เปิดไฟล์")}</span>
            </button>
          </div>

          {/* Action: Copy Path */}
          <button
            type="button"
            className="diff-btn"
            onClick={handleCopyPath}
            title={tr("คัดลอกที่อยู่ไฟล์")}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? tr("คัดลอกแล้ว") : tr("คัดลอกพาธ")}</span>
          </button>

          {/* Action: Stage */}
          <button
            type="button"
            className="diff-btn"
            onClick={handleStage}
            disabled={actionLoading}
            title={tr("Stage ไฟล์นี้ (git add)")}
          >
            <Plus size={13} />
            <span>Stage</span>
          </button>

          {/* Action: Unstage */}
          <button
            type="button"
            className="diff-btn"
            onClick={handleUnstage}
            disabled={actionLoading}
            title={tr("Unstage ไฟล์นี้ (git restore --staged)")}
          >
            <Minus size={13} />
            <span>Unstage</span>
          </button>

          {/* Action: Discard with Confirmation */}
          {confirmDiscard ? (
            <div className="diff-discard-confirm">
              <span className="diff-discard-warn">{tr("ยกเลิกการแก้ไขไฟล์นี้?")}</span>
              <button
                type="button"
                className="diff-btn-danger"
                onClick={handleDiscard}
                disabled={actionLoading}
              >
                {actionLoading ? tr("กำลังยกเลิก…") : tr("ยืนยันยกเลิก")}
              </button>
              <button
                type="button"
                className="diff-btn-secondary"
                onClick={() => setConfirmDiscard(false)}
                disabled={actionLoading}
              >
                {tr("ไม่ทำ")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="diff-btn diff-btn-discard"
              onClick={() => setConfirmDiscard(true)}
              disabled={actionLoading}
              title={tr("ยกเลิกการแก้ไขไฟล์นี้และคืนค่าเดิมจาก HEAD")}
            >
              <RotateCcw size={13} />
              <span>{tr("ยกเลิกการแก้ไข")}</span>
            </button>
          )}
        </div>
      </header>

      {/* Diff Viewport */}
      <div className="diff-viewport">
        {mode === 'file' ? (
          <div className="diff-raw-file-container" style={{ padding: '14px', overflow: 'auto', height: '100%', boxSizing: 'border-box' }}>
            <pre tabIndex={0} style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap', color: 'var(--text, #edece9)' }}>
              {modified || (deleted ? tr("ไฟล์นี้ถูกลบแล้ว") : tr("ไฟล์ว่าง"))}
            </pre>
          </div>
        ) : diffLines.length === 0 ? (
          <div className="diff-empty-message">
            {tr("ไม่มีการเปลี่ยนแปลงในไฟล์นี้ (ไฟล์ว่างหรือเนื้อหาตรงกับ HEAD)")}
          </div>
        ) : mode === 'side-by-side' ? (
          /* Side-by-Side View */
          <div className="diff-split-container">
            {/* Left Pane (Original / HEAD) */}
            <div className="diff-split-pane">
              <div className="diff-pane-header">{tr("HEAD (ก่อนหน้า)")}</div>
              <div
                className="diff-scroll-pane"
                ref={leftScrollRef}
                onScroll={handleLeftScroll}
                tabIndex={0}
              >
                <div className="diff-table">
                  {sideBySideRows.map((row, idx) => (
                    <div key={idx} className={`diff-row diff-row-${row.left.type}`}>
                      <span className="diff-line-num">{row.left.lineNumber ?? ''}</span>
                      <span className="diff-marker">
                        {row.left.type === 'delete' ? '-' : ' '}
                      </span>
                      <span className="diff-content">{row.left.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Pane (Modified / Working Copy) */}
            <div className="diff-split-pane">
              <div className="diff-pane-header">{tr("Working Copy (ปัจจุบัน)")}</div>
              <div
                className="diff-scroll-pane"
                ref={rightScrollRef}
                onScroll={handleRightScroll}
                tabIndex={0}
              >
                <div className="diff-table">
                  {sideBySideRows.map((row, idx) => (
                    <div key={idx} className={`diff-row diff-row-${row.right.type}`}>
                      <span className="diff-line-num">{row.right.lineNumber ?? ''}</span>
                      <span className="diff-marker">
                        {row.right.type === 'add' ? '+' : ' '}
                      </span>
                      <span className="diff-content">{row.right.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Inline View */
          <div className="diff-inline-container" tabIndex={0}>
            <div className="diff-table">
              {diffLines.map((line, idx) => (
                <div key={idx} className={`diff-row diff-row-${line.type}`}>
                  <span className="diff-line-num diff-line-num-old">
                    {line.oldLineNumber ?? ''}
                  </span>
                  <span className="diff-line-num diff-line-num-new">
                    {line.newLineNumber ?? ''}
                  </span>
                  <span className="diff-marker">
                    {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                  </span>
                  <span className="diff-content">{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
