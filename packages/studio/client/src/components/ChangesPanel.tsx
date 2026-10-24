import { useEffect, useState } from 'react';
import { api } from '../api';
import { VisualDiffViewer } from './VisualDiffViewer';

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

  return (
    <div className="changes-panel">
      <div className="recovery-actions">
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
    </div>
  );
}
