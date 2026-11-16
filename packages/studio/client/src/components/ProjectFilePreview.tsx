import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, FileText, LoaderCircle, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import type { PreviewTarget } from '../previewLinks';
import '../preview-files.css';
import { tr } from '../i18n';

export type FilePreviewRequest = { id: string; workspaceId?: string; target: Extract<PreviewTarget, { kind: 'file' }> };
type FileContent = { kind: 'text'; text: string } | { kind: 'image' | 'pdf'; url: string } | { kind: 'video'; url: string; type: string };
/** A file outside the project: shown only after the user chooses to open it. */
type Outside = { file: string; message: string };

export function ProjectFilePreview({ request }: { request: FilePreviewRequest }) {
  const [content, setContent] = useState<FileContent>();
  const [problem, setProblem] = useState('');
  const [outside, setOutside] = useState<Outside>();
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [originalSize, setOriginalSize] = useState(false);
  const textArea = useRef<HTMLPreElement>(null);
  const name = request.target.path.split(/[\\/]/).at(-1) || request.target.path;
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setLoading(true); setProblem(''); setOutside(undefined); setContent(undefined); setOriginalSize(false);
    const load = async () => {
      try {
        if (!request.workspaceId) throw new Error(tr("เลือกโปรเจกต์ก่อนเปิดไฟล์นี้"));
        const url = `/api/workspaces/${encodeURIComponent(request.workspaceId)}/preview-file?path=${encodeURIComponent(request.target.path)}`;
        // Videos stream straight from the server (seeking works); only a quick look at the headers here.
        if (/.(mp4|m4v|webm|mov|ogv)$/i.test(request.target.path)) {
          const head = await fetch(url, { signal: controller.signal, headers: { Range: 'bytes=0-0' } });
          if (head.ok) { if (!controller.signal.aborted) setContent({ kind: 'video', url, type: head.headers.get('content-type') || 'video/mp4' }); return; }
          const error = await head.json().catch(() => null);
          if (error?.outside) { if (!controller.signal.aborted) setOutside({ file: error.file, message: error.error }); return; }
          throw new Error(error?.error || tr("เปิดไฟล์นี้ไม่ได้ กรุณาตรวจที่อยู่ไฟล์"));
        }
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          if (error?.outside) { if (!controller.signal.aborted) setOutside({ file: error.file, message: error.error }); return; }
          throw new Error(error?.error || tr("เปิดไฟล์นี้ไม่ได้ กรุณาตรวจที่อยู่ไฟล์"));
        }
        const type = response.headers.get('content-type') || '';
        let next: FileContent;
        if (type.startsWith('image/') || type.startsWith('application/pdf')) {
          const blob = await response.blob();
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(blob);
          next = { kind: type.startsWith('image/') ? 'image' : 'pdf', url: objectUrl };
        } else if (type.startsWith('text/plain')) next = { kind: 'text', text: await response.text() };
        else throw new Error(tr("ไฟล์ชนิดนี้ยังเปิดใน Preview ไม่ได้"));
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

  const allowOutside = async () => {
    if (!outside) return;
    try {
      const response = await fetch('/api/preview-file/allow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: outside.file }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || tr("เปิดไฟล์นี้ไม่ได้ กรุณาตรวจที่อยู่ไฟล์"));
      setRevision(value => value + 1);
    } catch (error) { setOutside(undefined); setProblem((error as Error).message); }
  };

  return <section className="project-file-preview" aria-label={tr`Preview ไฟล์ ${name}`}>
    <header><span><FileText size={14} /><strong title={request.target.path}>{name}</strong></span><div>
      {content?.kind === 'image' && <button className="icon-button" title={originalSize ? tr("ปรับภาพให้พอดี") : tr("ดูภาพขนาดจริง")} aria-pressed={originalSize} onClick={() => setOriginalSize(value => !value)}>{originalSize ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>}
      {content && content.kind !== 'text' && <a href={content.url} download={name} title={tr("ดาวน์โหลดไฟล์")} aria-label={tr("ดาวน์โหลดไฟล์")}><Download size={15} /></a>}
      <button className="icon-button" title={tr("โหลดไฟล์อีกครั้ง")} onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} /></button>
    </div></header>
    {loading ? <div className="preview-empty" role="status"><LoaderCircle size={22} className="spin" /><p>{tr("กำลังเปิดไฟล์…")}</p></div>
      : outside ? <div className="preview-empty" role="alert"><AlertTriangle size={25} /><h3>{tr("ไฟล์นี้อยู่นอกโปรเจกต์")}</h3><p className="preview-outside-path" title={outside.file}>{outside.file}</p><p>{tr("เปิดดูเฉพาะไฟล์ที่คุณไว้ใจ เช่นไฟล์ที่ AI สร้างให้คุณเอง")}</p><button className="primary" onClick={() => void allowOutside()}>{tr("เปิดดูไฟล์นี้")}</button></div>
      : problem ? <div className="preview-empty" role="alert"><AlertTriangle size={25} /><h3>{tr("เปิดไฟล์ไม่ได้")}</h3><p>{problem}</p><button className="secondary" onClick={() => setRevision(value => value + 1)}>{tr("ลองใหม่")}</button></div>
      : content?.kind === 'image' ? <div className={`preview-image ${originalSize ? 'original-size' : ''}`}><img src={content.url} alt={name} onError={() => setProblem(tr("อ่านรูปภาพไม่ได้ ไฟล์อาจเสียหายหรือไม่ใช่รูปภาพ"))} /></div>
      : content?.kind === 'video' ? <div className="preview-video"><video src={content.url} controls preload="metadata" onError={() => setProblem(tr("เล่นวิดีโอนี้ไม่ได้ ไฟล์อาจเสียหายหรือใช้รูปแบบที่ไม่รองรับ"))} /></div>
      : content?.kind === 'pdf' ? <iframe title={`PDF ${name}`} src={content.url} />
      : content?.kind === 'text' ? <pre className="preview-file-text" ref={textArea} tabIndex={0}>{content.text.split('\n').map((line, index) => <span key={index} data-line={index + 1} className={request.target.line === index + 1 ? 'highlighted' : ''}>{line || ' '}</span>)}</pre> : null}
  </section>;
}
