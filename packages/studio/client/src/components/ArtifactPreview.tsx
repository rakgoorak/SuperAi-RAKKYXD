import { useState } from 'react';
import {
  Code,
  Eye,
  Copy,
  Check,
  RotateCw,
  ExternalLink,
  Sparkles,
  Download,
  X,
} from 'lucide-react';

interface Props {
  title: string;
  language: string;
  content: string;
  onClose?: () => void;
}

export function ArtifactPreview({ title, language, content, onClose }: Props) {
  const isVisual = ['html', 'svg', 'xml', 'mermaid', 'jsx', 'tsx', 'react'].includes(language.toLowerCase());
  const [tab, setTab] = useState<'preview' | 'code'>(isVisual ? 'preview' : 'code');
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const downloadFile = () => {
    let ext = language.toLowerCase();
    if (ext === 'react') ext = 'tsx';
    if (!ext) ext = 'txt';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'artifact'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openNewTab = () => {
    if (['html', 'svg', 'xml'].includes(language.toLowerCase())) {
      const blob = new Blob([content], {
        type: language.toLowerCase() === 'svg' ? 'image/svg+xml' : 'text/html;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const renderPreview = () => {
    const lang = language.toLowerCase();

    if (lang === 'svg') {
      return (
        <div className="artifact-canvas svg-canvas">
          <div
            className="artifact-svg-container"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      );
    }

    // Default HTML / Component sandbox
    const wrappedHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      margin: 0;
      padding: 18px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Thai", sans-serif;
      background: #181816;
      color: #eeede7;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;

    return (
      <iframe
        key={refreshKey}
        sandbox="allow-scripts allow-modals"
        title={title || 'Artifact Preview'}
        srcDoc={wrappedHtml}
        className="artifact-iframe"
      />
    );
  };

  return (
    <div className="artifact-preview-panel">
      <header className="artifact-header">
        <div className="artifact-title-row">
          <Sparkles size={15} className="artifact-sparkle-icon" />
          <strong className="artifact-title" title={title}>
            {title || 'Artifact'}
          </strong>
          <span className="artifact-lang-badge">{language.toUpperCase() || 'CODE'}</span>
        </div>

        <div className="artifact-tab-switch">
          <button
            type="button"
            className={`artifact-tab-btn ${tab === 'preview' ? 'active' : ''}`}
            onClick={() => setTab('preview')}
            aria-selected={tab === 'preview'}
          >
            <Eye size={13} />
            <span>แสดงผล</span>
          </button>
          <button
            type="button"
            className={`artifact-tab-btn ${tab === 'code' ? 'active' : ''}`}
            onClick={() => setTab('code')}
            aria-selected={tab === 'code'}
          >
            <Code size={13} />
            <span>โค้ด</span>
          </button>
        </div>

        <div className="artifact-actions">
          <button
            type="button"
            className="icon-button"
            title={copied ? 'คัดลอกเรียบร้อย' : 'คัดลอกโค้ด'}
            onClick={copyCode}
          >
            {copied ? <Check size={14} style={{ color: 'var(--running, #91bf9f)' }} /> : <Copy size={14} />}
          </button>
          {tab === 'preview' && (
            <button
              type="button"
              className="icon-button"
              title="รีเฟรชหน้าแสดงผล"
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              <RotateCw size={14} />
            </button>
          )}
          {['html', 'svg'].includes(language.toLowerCase()) && (
            <button
              type="button"
              className="icon-button"
              title="เปิดในแท็บใหม่ของเบราว์เซอร์"
              onClick={openNewTab}
            >
              <ExternalLink size={14} />
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            title="ดาวน์โหลดไฟล์"
            onClick={downloadFile}
          >
            <Download size={14} />
          </button>
          {onClose && (
            <button
              type="button"
              className="icon-button"
              title="ปิดแผง Artifact"
              onClick={onClose}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      <div className="artifact-body">
        {tab === 'preview' ? (
          renderPreview()
        ) : (
          <div className="artifact-code-view">
            <pre tabIndex={0}>
              <code>{content}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
