import React, { useState } from 'react';
import { 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  ExternalLink, 
  Smartphone, 
  Tablet, 
  Monitor, 
  CheckCircle,
  X
} from 'lucide-react';

interface BrowserPreviewProps {
  onClose: () => void;
}

export const BrowserPreview: React.FC<BrowserPreviewProps> = ({ onClose }) => {
  const [url, setUrl] = useState('http://localhost:3000');
  const [currentUrl, setCurrentUrl] = useState('http://localhost:3000');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isLoading, setIsLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const handleNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let target = url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'http://' + target;
    }
    setUrl(target);
    setCurrentUrl(target);
    setIsLoading(true);
    setIframeError(false);
    setTimeout(() => setIsLoading(false), 800);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeError(false);
    setTimeout(() => setIsLoading(false), 600);
  };

  const getContainerWidth = () => {
    switch (deviceMode) {
      case 'mobile':
        return 'max-w-[375px]';
      case 'tablet':
        return 'max-w-[768px]';
      default:
        return 'w-full';
    }
  };

  return (
    <aside className="w-96 lg:w-[460px] bg-[#0e131f] border-l border-[#1f293d] flex flex-col h-full select-none shrink-0 transition-all">
      {/* Browser Header / Navigation Bar */}
      <div className="p-2 border-b border-[#1f293d] space-y-1.5 bg-[#0e131f]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200">Live Webview</span>
          </div>

          {/* Viewport switchers */}
          <div className="flex items-center space-x-1 bg-[#141a29] p-0.5 rounded border border-[#1f293d]">
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`p-1 rounded ${deviceMode === 'desktop' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Desktop View"
            >
              <Monitor className="w-3 h-3" />
            </button>
            <button
              onClick={() => setDeviceMode('tablet')}
              className={`p-1 rounded ${deviceMode === 'tablet' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Tablet View"
            >
              <Tablet className="w-3 h-3" />
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`p-1 rounded ${deviceMode === 'mobile' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Mobile View"
            >
              <Smartphone className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-[#1a2337] rounded"
            title="Close Preview Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* URL Address Bar */}
        <form onSubmit={handleNavigate} className="flex items-center space-x-1">
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-white hover:bg-[#192133] rounded"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="p-1 text-slate-400 hover:text-white hover:bg-[#192133] rounded"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className={`p-1 text-slate-400 hover:text-cyan-400 hover:bg-[#192133] rounded ${isLoading ? 'animate-spin' : ''}`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 bg-[#141a29] border border-[#232f48] focus:border-cyan-500 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none"
            placeholder="http://localhost:3000"
          />

          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-[#192133] rounded"
            title="Open in new browser tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </form>
      </div>

      {/* Webview Content / Live Iframe Simulator */}
      <div className="flex-1 bg-[#0a0d14] p-2 flex items-center justify-center overflow-auto">
        <div className={`h-full ${getContainerWidth()} bg-[#111726] border border-[#1f293d] rounded-lg overflow-hidden flex flex-col shadow-xl`}>
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <RotateCw className="w-6 h-6 text-cyan-400 animate-spin" />
              <span className="text-xs">Loading {currentUrl}...</span>
            </div>
          ) : !iframeError ? (
            <iframe
              src={currentUrl}
              onError={() => setIframeError(true)}
              className="w-full h-full border-0 bg-white"
              title="Browser Webview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-3 text-slate-400">
              <div className="w-12 h-12 rounded-full bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                <Globe className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-200">Waiting for Dev Server</h4>
                <p className="text-xs text-slate-400 max-w-[260px]">
                  When your multi-agent team runs a local dev server (e.g. Next.js, Vite, Express), the live preview updates here automatically.
                </p>
              </div>
              <div className="text-[11px] font-mono bg-[#141a29] px-3 py-1.5 rounded border border-[#1f293d] text-cyan-300">
                Target: {currentUrl}
              </div>
              <button
                onClick={handleRefresh}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
