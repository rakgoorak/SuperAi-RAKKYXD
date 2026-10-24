import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Image,
  Pin,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Save,
  X,
  RefreshCw,
  Maximize2,
  Minimize2,
  LoaderCircle,
  AlertCircle,
  ArrowLeft,
  Search,
} from 'lucide-react';
import type { Workspace } from '../api';
import { getProjectFiles, getPinnedContent, togglePinnedFile, saveProjectFile } from '../api';
import {
  type TreeNode,
  buildFileTree,
  filterTree,
  getFileCategory,
} from '../fileTree';
import '../file-explorer.css';

export { type TreeNode, buildFileTree };

export interface FileExplorerPanelProps {
  workspace?: Workspace;
  onOpenFile?: (path: string) => void;
  onError?: (message: string) => void;
}

export function getFileIcon(filename: string) {
  const category = getFileCategory(filename);
  if (category === 'image') return Image;
  if (category === 'code') return FileCode;
  return FileText;
}

export function FileExplorerPanel({ workspace, onOpenFile, onError }: FileExplorerPanelProps) {
  const [fileList, setFileList] = useState<string[]>([]);
  const [pinnedPaths, setPinnedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Quick Editor states
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [editorError, setEditorError] = useState<string>('');
  const [isModal, setIsModal] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ kind: 'image'; url: string } | null>(null);

  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load files and pinned files
  const loadFiles = useCallback(async () => {
    if (!workspace?.id) {
      setFileList([]);
      setPinnedPaths(new Set());
      return;
    }
    setLoading(true);
    try {
      const [filesRes, pinnedRes] = await Promise.all([
        getProjectFiles(workspace.id),
        getPinnedContent(workspace.id).catch(() => ({ files: [] })),
      ]);
      setFileList(filesRes.files || []);
      const pinned = new Set<string>();
      if (Array.isArray(workspace.pinnedFiles)) {
        workspace.pinnedFiles.forEach(p => pinned.add(p));
      }
      if (Array.isArray(pinnedRes.files)) {
        pinnedRes.files.forEach(f => pinned.add(f.path));
      }
      setPinnedPaths(pinned);
    } catch (err) {
      onError?.((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, workspace?.pinnedFiles, onError]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  // Build tree
  const fullTree = useMemo(() => {
    return buildFileTree(fileList, pinnedPaths);
  }, [fileList, pinnedPaths]);

  // Filter tree
  const { filtered: visibleTree, matchingDirs } = useMemo(() => {
    return filterTree(fullTree, search);
  }, [fullTree, search]);

  const toggleExpand = (dirPath: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const handleCopyPath = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(filePath).then(() => {
      setCopiedPath(filePath);
      setTimeout(() => setCopiedPath(null), 1500);
    }).catch(() => {
      onError?.('คัดลอกพาธไม่สำเร็จ');
    });
  };

  const handleTogglePin = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!workspace?.id) return;
    try {
      const updated = await togglePinnedFile(workspace.id, filePath);
      const nextPinned = new Set(updated.pinnedFiles || []);
      setPinnedPaths(nextPinned);
    } catch (err) {
      onError?.((err as Error).message);
    }
  };

  // Open file in Quick Editor
  const handleOpenFile = async (filePath: string) => {
    onOpenFile?.(filePath);
    if (!workspace?.id) return;

    if (editingFile && editorContent !== savedContent) {
      const proceed = window.confirm('คุณยังไม่ได้บันทึกไฟล์ปัจจุบัน ต้องการเปิดไฟล์ใหม่หรือไม่?');
      if (!proceed) return;
    }

    setEditingFile(filePath);
    setIsLoadingContent(true);
    setEditorError('');
    setSaveStatus('idle');
    setMediaPreview(null);

    try {
      const url = `/api/workspaces/${encodeURIComponent(workspace.id)}/preview-file?path=${encodeURIComponent(filePath)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `เปิดไฟล์ไม่สำเร็จ (${res.status})`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.startsWith('image/')) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        setMediaPreview({ kind: 'image', url: objectUrl });
        setEditorContent('');
        setSavedContent('');
      } else {
        const text = await res.text();
        setEditorContent(text);
        setSavedContent(text);
      }
    } catch (err) {
      setEditorError((err as Error).message);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleCloseEditor = () => {
    if (editorContent !== savedContent) {
      const proceed = window.confirm('คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการปิดโปรแกรมแก้ไขหรือไม่?');
      if (!proceed) return;
    }
    setEditingFile(null);
    setEditorContent('');
    setSavedContent('');
    setEditorError('');
    setIsModal(false);
    if (mediaPreview?.url) {
      URL.revokeObjectURL(mediaPreview.url);
      setMediaPreview(null);
    }
  };

  const handleSaveFile = async () => {
    if (!workspace?.id || !editingFile || isSaving) return;
    setIsSaving(true);
    setSaveStatus('idle');
    setEditorError('');

    try {
      const res = await saveProjectFile(workspace.id, editingFile, editorContent);
      if (res.success) {
        setSavedContent(editorContent);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        throw new Error('บันทึกไฟล์ไม่สำเร็จ');
      }
    } catch (err) {
      setSaveStatus('error');
      setEditorError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      void handleSaveFile();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      const updated = value.substring(0, start) + '  ' + value.substring(end);
      setEditorContent(updated);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  };

  const isDirty = editorContent !== savedContent;
  const lineCount = useMemo(() => {
    return editorContent ? editorContent.split('\n').length : 1;
  }, [editorContent]);

  // Tree node recursive renderer
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isSearching = !!search.trim();
    const isExpanded = isSearching ? matchingDirs.has(node.path) : expandedPaths.has(node.path);
    const isSelected = editingFile === node.path;
    const isPinned = pinnedPaths.has(node.path);

    if (node.isDirectory) {
      const DirIcon = isExpanded ? FolderOpen : Folder;
      return (
        <div key={node.path} className="tree-node">
          <div
            className={`tree-node-item ${isSelected ? 'is-active' : ''}`}
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
            onClick={() => toggleExpand(node.path)}
            title={node.path}
          >
            <span className="node-toggle" aria-label={isExpanded ? 'ยุบโฟลเดอร์' : 'ขยายโฟลเดอร์'}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="node-icon is-folder">
              <DirIcon size={15} />
            </span>
            <span className="node-name">{node.name}</span>
            <div className="tree-node-actions">
              <button
                className="tree-action-btn"
                title="คัดลอกพาธโฟลเดอร์"
                onClick={e => handleCopyPath(node.path, e)}
              >
                {copiedPath === node.path ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
          {isExpanded && node.children && node.children.length > 0 && (
            <div className="tree-children">
              {node.children.map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const FileIcon = getFileIcon(node.name);
    const category = getFileCategory(node.name);

    return (
      <div key={node.path} className="tree-node">
        <div
          className={`tree-node-item ${isSelected ? 'is-active' : ''}`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => void handleOpenFile(node.path)}
          title={node.path}
        >
          <span className="node-toggle" style={{ opacity: 0 }}>
            <span style={{ width: 14 }} />
          </span>
          <span className={`node-icon ${category === 'code' ? 'is-code' : category === 'image' ? 'is-image' : ''}`}>
            <FileIcon size={14} />
          </span>
          <span className="node-name">{node.name}</span>
          {isPinned && (
            <span className="node-pin-badge" title="ปักหมุดใน Context แล้ว">
              <Pin size={11} fill="currentColor" />
            </span>
          )}
          <div className="tree-node-actions">
            <button
              className={`tree-action-btn ${isPinned ? 'is-pinned' : ''}`}
              title={isPinned ? 'ยกเลิกการปักหมุด' : 'ปักหมุดไฟล์เพื่อให้อยู่ใน Context'}
              onClick={e => void handleTogglePin(node.path, e)}
            >
              <Pin size={13} fill={isPinned ? 'currentColor' : 'none'} />
            </button>
            <button
              className="tree-action-btn"
              title="คัดลอกพาธไฟล์"
              onClick={e => handleCopyPath(node.path, e)}
            >
              {copiedPath === node.path ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Quick Editor Component
  const renderQuickEditor = () => {
    if (!editingFile) return null;
    const fileName = editingFile.split('/').pop() || editingFile;
    const isImg = mediaPreview !== null;

    return (
      <section className="quick-editor" aria-label={`โปรแกรมแก้ไขไฟล์ด่วน ${fileName}`}>
        <header className="quick-editor-header">
          <div className="quick-editor-info">
            <button
              className="tree-action-btn"
              title="กลับไปที่รายการไฟล์"
              onClick={handleCloseEditor}
            >
              <ArrowLeft size={15} />
            </button>
            <div className="quick-editor-path-wrapper">
              <span className="quick-editor-path" title={editingFile}>
                {fileName}
              </span>
              {isDirty && !isImg && (
                <span className="quick-editor-dirty-indicator">
                  • ยังไม่บันทึก
                </span>
              )}
            </div>
          </div>
          <div className="quick-editor-controls">
            {!isImg && (
              <button
                className="quick-editor-save-btn"
                disabled={isSaving || !isDirty}
                onClick={() => void handleSaveFile()}
                title="บันทึกไฟล์ (Ctrl+S)"
              >
                {isSaving ? (
                  <LoaderCircle size={13} className="spin" />
                ) : (
                  <Save size={13} />
                )}
                <span>บันทึกไฟล์</span>
              </button>
            )}
            <button
              className="tree-action-btn"
              title={isModal ? 'ย่อกลับเข้า Dock' : 'ขยายเต็มหน้าจอ'}
              onClick={() => setIsModal(!isModal)}
            >
              {isModal ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              className="tree-action-btn"
              title="ปิดโปรแกรมแก้ไข"
              onClick={handleCloseEditor}
            >
              <X size={14} />
            </button>
          </div>
        </header>

        {isLoadingContent ? (
          <div className="file-explorer-empty" role="status">
            <LoaderCircle size={22} className="spin" />
            <p>กำลังโหลดเนื้อหาไฟล์…</p>
          </div>
        ) : editorError ? (
          <div className="file-explorer-empty" role="alert">
            <AlertCircle size={24} color="#e06c75" />
            <p>{editorError}</p>
            <button className="secondary" onClick={() => void handleOpenFile(editingFile)}>
              ลองใหม่
            </button>
          </div>
        ) : isImg ? (
          <div className="quick-editor-media">
            <img src={mediaPreview.url} alt={fileName} />
            <span style={{ fontSize: '11px', color: 'var(--dim)' }}>{editingFile}</span>
          </div>
        ) : (
          <>
            <div className="quick-editor-body">
              <div className="quick-editor-gutters" ref={gutterRef}>
                {Array.from({ length: lineCount }, (_, i) => (
                  <span key={i + 1} className="quick-editor-gutter-line">
                    {i + 1}
                  </span>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                className="quick-editor-textarea"
                value={editorContent}
                onChange={e => setEditorContent(e.target.value)}
                onScroll={handleTextareaScroll}
                onKeyDown={handleTextareaKeyDown}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
              />
            </div>
            <footer className="quick-editor-footer">
              <div className="quick-editor-status">
                {saveStatus === 'success' && (
                  <span className="quick-editor-status is-success">
                    <Check size={12} /> บันทึกสำเร็จ
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="quick-editor-status is-error">
                    <AlertCircle size={12} /> บันทึกผิดพลาด
                  </span>
                )}
                {saveStatus === 'idle' && (
                  <span>{isDirty ? 'มีการเปลี่ยนแปลง' : 'ไฟล์ไม่ถูกแก้ไข'}</span>
                )}
              </div>
              <div className="quick-editor-meta">
                <span>{lineCount} บรรทัด</span>
                <span>{editorContent.length} ตัวอักษร</span>
                <span>UTF-8</span>
              </div>
            </footer>
          </>
        )}
      </section>
    );
  };

  return (
    <div className="file-explorer-panel">
      {/* If Quick Editor is opened inside dock and not modal, show Quick Editor */}
      {editingFile && !isModal ? (
        renderQuickEditor()
      ) : (
        <>
          <div className="file-explorer-header">
            <div className="file-explorer-title">
              <Folder size={15} color="var(--accent)" />
              <h2>ไฟล์ในโปรเจกต์</h2>
              <span className="file-explorer-count">{fileList.length} ไฟล์</span>
            </div>
            <div className="file-explorer-toolbar">
              <button
                className="tree-action-btn"
                title="รีเฟรชรายการไฟล์"
                disabled={loading}
                onClick={() => void loadFiles()}
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>

          <div className="file-explorer-search">
            <Search size={13} />
            <input
              type="text"
              placeholder="ค้นหาไฟล์และโฟลเดอร์..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="file-explorer-search-clear"
                title="ล้างคำค้นหา"
                onClick={() => setSearch('')}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="file-explorer-content">
            {loading && fileList.length === 0 ? (
              <div className="file-explorer-empty">
                <LoaderCircle size={20} className="spin" />
                <p>กำลังค้นหาไฟล์ในโปรเจกต์…</p>
              </div>
            ) : !workspace?.id ? (
              <div className="file-explorer-empty">
                <p>กรุณาเลือกโปรเจกต์ก่อนดูไฟล์</p>
              </div>
            ) : visibleTree.length === 0 ? (
              <div className="file-explorer-empty">
                <p>
                  {search
                    ? `ไม่พบไฟล์ที่ตรงกับ "${search}"`
                    : 'ไม่พบไฟล์ในโฟลเดอร์ของโปรเจกต์นี้'}
                </p>
              </div>
            ) : (
              visibleTree.map(node => renderTreeNode(node, 0))
            )}
          </div>
        </>
      )}

      {/* If Quick Editor is in modal mode, render in modal dialog backdrop */}
      {editingFile && isModal && (
        <div
          className="quick-editor-modal-backdrop"
          onClick={e => {
            if (e.target === e.currentTarget) handleCloseEditor();
          }}
        >
          <div className="quick-editor-modal-content">
            {renderQuickEditor()}
          </div>
        </div>
      )}
    </div>
  );
}
