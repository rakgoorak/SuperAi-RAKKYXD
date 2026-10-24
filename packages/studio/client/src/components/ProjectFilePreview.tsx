import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, FileText, LoaderCircle, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import type { PreviewTarget } from '../previewLinks';
import '../preview-files.css';

export type FilePreviewRequest = { id: string; workspaceId?: string; target: Extract<PreviewTarget, { kind: 'file' }> };
type FileContent = { kind: 'text'; text: string } | { kind: 'image' | 'pdf'; url: string };

export function ProjectFilePreview({ request }: { request: FilePreviewRequest }) {
  const [content, setContent] = useState<FileContent>();
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [originalSize, setOriginalSize] = useState(false);
  const textArea = useRef<HTMLPreElement>(null);
  const name = request.target.path.split(/[\\/]/).at(-1) || request.target.path;
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setLoading(true); setProblem(''); setContent(undefined); setOriginalSize(false);
    const load = async () => {
      try {
        if (!request.workspaceId) throw new Error('เลือกโปรเจกต์ก่อนเปิดไฟล์นี้');
        const response = await fetch(`/api/workspaces/${encodeURIComponent(request.workspaceId)}/preview-file?path=${encodeURIComponent(request.target.path)}`, { signal: controller.signal });
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(error?.error || 'เปิดไฟล์นี้ไม่ได้ กรุณาตรวจที่อยู่ไฟล์');
        }
        const type = response.headers.get('content-type') || '';
        let next: FileContent;
        if (type.startsWith('image/') || type.startsWith('application/pdf')) {
          const blob = await response.blob();
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(blob);
          next = { kind: type.startsWith('image/') ? 'image' : 'pdf', url: objectUrl };
        } else if (type.startsWith('text/plain')) next = { kind: 'text', text: await response.text() };
        else throw new Error('ไฟล์ชนิดนี้ยังเปิดใน Preview ไม่ได้');
        if (!controller.signal.aborted) setContent(next);
      } catch (error) { if (!controller.signal.aborted) setProblem((error as Error).message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [request.id, request.workspaceId, request.target.path, revision]);
  useEffect(() => {
    if (content?.kind !== 'text' || !request.target.line) return;
    textArea.current?.querySelector(`[data-line="${request.target.line}"]`)?.scrollIntoView({ block: 'center' });
  }, [content, request.target.line]);

  return <section className="project-file-preview" aria-label={`Preview ไฟล์ ${name}`}>
    <header><span><FileText size={14} /><strong title={request.target.path}>{name}</strong></span><div>
      {content?.kind === 'image' && <button className="icon-button" title={originalSize ? 'ปรับภาพให้พอดี' : 'ดูภาพขนาดจริง'} aria-pressed={originalSize} onClick={() => setOriginalSize(value => !value)}>{originalSize ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>}
      {content && content.kind !== 'text' && <a href={content.url} download={name} title="ดาวน์โหลดไฟล์" aria-label="ดาวน์โหลดไฟล์"><Download size={15} /></a>}
      <button className="icon-button" title="โหลดไฟล์อีกครั้ง" onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} /></button>
    </div></header>
    {loading ? <div className="preview-empty" role="status"><LoaderCircle size={22} className="spin" /><p>กำลังเปิดไฟล์…</p></div>
      : problem ? <div className="preview-empty" role="alert"><AlertTriangle size={25} /><h3>เปิดไฟล์ไม่ได้</h3><p>{problem}</p><button className="secondary" onClick={() => setRevision(value => value + 1)}>ลองใหม่</button></div>
      : content?.kind === 'image' ? <div className={`preview-image ${originalSize ? 'original-size' : ''}`}><img src={content.url} alt={name} onError={() => setProblem('อ่านรูปภาพไม่ได้ ไฟล์อาจเสียหายหรือไม่ใช่รูปภาพ')} /></div>
      : content?.kind === 'pdf' ? <iframe title={`PDF ${name}`} src={content.url} />
      : content?.kind === 'text' ? <pre className="preview-file-text" ref={textArea} tabIndex={0}>{content.text.split('\n').map((line, index) => <span key={index} data-line={index + 1} className={request.target.line === index + 1 ? 'highlighted' : ''}>{line || ' '}</span>)}</pre> : null}
  </section>;
}
