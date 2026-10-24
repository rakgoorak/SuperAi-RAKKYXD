import { useEffect, useMemo, useRef, useState } from 'react';
import { Code, Eye, Copy, Check, RotateCw, Sparkles, Download, X, Maximize2, Minimize2, Plus, Minus, AlertTriangle } from 'lucide-react';
import { artifactDocument, visualArtifact } from '../artifactDocument';
import '../artifact-preview.css';

interface Props { title: string; language: string; content: string; onClose?: () => void }

export function ArtifactPreview({ title, language, content, onClose }: Props) {
  const lang = (language || '').toLowerCase();
  const visual = visualArtifact(lang);
  const diagram = lang === 'mermaid' || lang === 'svg';
  const [tab, setTab] = useState<'preview' | 'code'>(visual ? 'preview' : 'code');
  const [copied, setCopied] = useState(false);
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState({ state: 'loading', error: '' });
  const frame = useRef<HTMLIFrameElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const doc = useMemo(() => {
    const token = crypto.randomUUID();
    try { return { token, html: visual ? artifactDocument(lang, content, token) : '', error: '' }; }
    catch (error) { return { token, html: '', error: (error as Error).message }; }
  }, [lang, content, revision, visual]);
  useEffect(() => { setTab(visual ? 'preview' : 'code'); setZoom(1); setCopied(false); }, [lang, content, visual]);
  useEffect(() => {
    setStatus({ state: 'loading', error: '' });
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== 'superai-artifact' || event.data.token !== doc.token) return;
      if (event.data.status === 'error') setStatus({ state: 'error', error: String(event.data.message).slice(0, 1600) });
      else if (event.data.status === 'ready') setStatus(old => old.state === 'error' ? old : { state: 'ready', error: '' });
    };
    window.addEventListener('message', receive);
    const timeout = setTimeout(() => setStatus(old => old.state === 'loading' ? { state: 'error', error: lang === 'mermaid' ? 'โหลดตัววาดแผนภาพไม่สำเร็จ ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อโหลด Mermaid กดลองใหม่หรือดูโค้ดต้นฉบับ' : 'การแสดงผลใช้เวลานานเกินไป ลองใหม่หรือตรวจโค้ดต้นฉบับ' } : old), 20000);
    return () => { clearTimeout(timeout); window.removeEventListener('message', receive); };
  }, [doc, lang, tab, expanded]);
  useEffect(() => {
    if (expanded) { if (!dialog.current?.open) dialog.current?.showModal(); wasExpanded.current = true; }
    else if (wasExpanded.current) { dialog.current?.close(); wasExpanded.current = false; expandButton.current?.focus(); }
  }, [expanded]);
  useEffect(() => () => { clearTimeout(copyTimer.current); }, []);
  useEffect(() => {
    if (status.state === 'ready') frame.current?.contentWindow?.postMessage({ channel: 'superai-artifact-zoom', token: doc.token, zoom }, '*');
  }, [zoom, doc.token, status.state]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(content); setCopied(true); clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2000); }
    catch { setStatus({ state: 'error', error: 'คัดลอกไม่ได้ ลองเลือกข้อความจากแท็บโค้ด' }); }
  };
  const download = () => {
    const ext = lang === 'react' ? 'tsx' : lang === 'mermaid' ? 'mmd' : lang || 'txt';
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${(title || 'artifact').replace(/[<>:"/\\|?*]/g, '-')}.${ext}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const error = doc.error || status.error;
  const panel = <section className="artifact-preview-panel artifact-live" aria-label="ชิ้นงาน Artifact">
    <header className="artifact-header">
      <div className="artifact-title-row"><Sparkles size={16} className="artifact-sparkle-icon" /><strong className="artifact-title" title={title}>{title || 'ชิ้นงานของคุณ'}</strong><span className="artifact-lang-badge">{lang || 'code'}</span></div>
      <div className="artifact-tab-switch" role="group" aria-label="มุมมองชิ้นงาน">
        {visual && <button className={`artifact-tab-btn ${tab === 'preview' ? 'active' : ''}`} aria-pressed={tab === 'preview'} onClick={() => setTab('preview')}><Eye size={14} />แสดงผล</button>}
        <button className={`artifact-tab-btn ${tab === 'code' ? 'active' : ''}`} aria-pressed={tab === 'code'} onClick={() => setTab('code')}><Code size={14} />โค้ด</button>
      </div>
      <div className="artifact-actions">
        <button className="icon-button" title={copied ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'} onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
        <button className="icon-button" title="ดาวน์โหลดไฟล์" onClick={download}><Download size={16} /></button>
        <button ref={expandButton} className="icon-button" title={expanded ? 'ย่อกลับ' : 'ขยายพื้นที่'} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        {(expanded || onClose) && <button className="artifact-close" aria-label={expanded ? 'ปิดมุมมองขยาย' : 'ปิดชิ้นงาน'} onClick={() => expanded ? setExpanded(false) : onClose?.()}><X size={16} /><span>ปิด</span></button>}
      </div>
    </header>
    <div className="artifact-body">
      {tab === 'code' ? <div className="artifact-code-view"><pre tabIndex={0}><code>{content}</code></pre></div> : <>
        {!error && status.state === 'loading' && <div className="artifact-loading" role="status">กำลังสร้าง{diagram ? 'แผนภาพ' : 'ตัวอย่าง'}…</div>}
        {error && <div className="artifact-render-error" role="alert"><AlertTriangle size={26} /><h3>แสดงชิ้นงานไม่ได้</h3><p>{lang === 'mermaid' ? 'ตรวจรูปแบบแผนภาพและการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง' : 'ตรวจโค้ดต้นฉบับตามรายละเอียดด้านล่าง'}</p><pre>{error}</pre><div><button className="secondary" onClick={() => setRevision(value => value + 1)}><RotateCw size={14} />ลองใหม่</button><button className="secondary" onClick={() => setTab('code')}>ดูโค้ด</button></div></div>}
        {!doc.error && <div className={`artifact-scroll ${error ? 'artifact-hidden' : ''}`} aria-hidden={!!error}>
          <iframe ref={frame} key={`${doc.token}-${tab}-${expanded}`} sandbox="allow-scripts" referrerPolicy="no-referrer" title={title || 'Artifact Preview'} srcDoc={doc.html} onLoad={() => frame.current?.contentWindow?.postMessage({ channel: 'superai-artifact-start', token: doc.token }, '*')} className="artifact-iframe" />
        </div>}
      </>}
    </div>
    {tab === 'preview' && <footer className="artifact-controls"><span>{diagram ? 'แผนภาพ' : 'ตัวอย่างที่โต้ตอบได้'}</span><div>{diagram && <><button title="ซูมออก" disabled={zoom <= .25} onClick={() => setZoom(value => Math.max(.25, value - .25))}><Minus size={15} /></button><output aria-label="ระดับการซูม">{Math.round(zoom * 100)}%</output><button title="ซูมเข้า" disabled={zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + .25))}><Plus size={15} /></button><button onClick={() => setZoom(1)}>พอดีจอ</button></>}<button title="รีเฟรชหน้าแสดงผล" onClick={() => setRevision(value => value + 1)}><RotateCw size={14} /><span>รีเฟรช</span></button></div></footer>}
  </section>;
  return <>{!expanded && panel}<dialog className="artifact-expanded" ref={dialog} aria-label="ชิ้นงานแบบขยาย" onCancel={event => { event.preventDefault(); setExpanded(false); }} onClose={() => setExpanded(false)}>{expanded && panel}</dialog></>;
}
