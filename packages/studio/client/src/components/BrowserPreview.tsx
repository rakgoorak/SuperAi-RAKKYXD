import React, { useState } from 'react';
import { 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  ExternalLink, 
  Plus, 
  X, 
  LayoutDashboard, 
  CheckSquare, 
  MessageSquareQuote,
  Music
} from 'lucide-react';

interface BrowserPreviewProps {
  onClose: () => void;
}

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  icon?: string;
}

export const BrowserPreview: React.FC<BrowserPreviewProps> = ({ onClose }) => {
  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: 'tab-dash', title: 'Dashboard', url: 'http://localhost:3000' },
    { id: 'tab-tasks', title: 'Tasks', url: 'http://localhost:3000/tasks' },
    { id: 'tab-prompts', title: 'Prompts', url: 'http://localhost:3000/prompts' },
    {
      id: 'tab-yt',
      title: 'TRON LEGACY Daft P...',
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0',
      icon: '🔴',
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-yt');
  const [urlInput, setUrlInput] = useState('https://youtube.com/watch');
  const [isLoading, setIsLoading] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let target = urlInput.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'http://' + target;
    }
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, url: target } : t))
    );
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleSelectTab = (tab: BrowserTab) => {
    setActiveTabId(tab.id);
    setUrlInput(tab.url);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const next = tabs.filter((t) => t.id !== tabId);
    setTabs(next);
    if (activeTabId === tabId) {
      setActiveTabId(next[0].id);
      setUrlInput(next[0].url);
    }
  };

  return (
    <aside className="w-[480px] lg:w-[560px] bg-[#0c0f18] border-l border-[#1a2337] flex flex-col h-full select-none shrink-0 transition-all">
      {/* Browser Tab Bar (Matching Screenshot 1 & 2: Dashboard, Tasks, Prompts, Video) */}
      <div className="h-9 px-2 bg-[#090c14] border-b border-[#1a2337] flex items-center space-x-1 overflow-x-auto text-xs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => handleSelectTab(tab)}
              className={`group flex items-center space-x-1.5 px-2.5 py-1 rounded-t-md font-medium cursor-pointer transition-all border-t-2 ${
                isActive
                  ? 'bg-[#111726] text-cyan-300 border-cyan-500 font-semibold'
                  : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-[#111624]'
              }`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span className="truncate max-w-[110px]">{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => {
            const newId = `tab-${Date.now()}`;
            setTabs((prev) => [
              ...prev,
              { id: newId, title: 'New Tab', url: 'http://localhost:3000' },
            ]);
            setActiveTabId(newId);
          }}
          className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-[#141a29] rounded"
          title="New Tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1" />

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-[#141a29] rounded"
          title="Close Preview Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Address & Navigation Bar */}
      <div className="p-2 border-b border-[#1a2337] bg-[#0c101a] flex items-center space-x-1 text-xs">
        <button
          onClick={() => {}}
          className="p-1 text-slate-400 hover:text-white hover:bg-[#141a29] rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {}}
          className="p-1 text-slate-400 hover:text-white hover:bg-[#141a29] rounded"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleRefresh}
          className={`p-1 text-slate-400 hover:text-cyan-400 hover:bg-[#141a29] rounded ${
            isLoading ? 'animate-spin' : ''
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <form onSubmit={handleNavigate} className="flex-1 flex items-center">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-[#121726] border border-[#202a40] focus:border-cyan-500 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none"
            placeholder="https://..."
          />
        </form>

        <a
          href={activeTab.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-[#141a29] rounded"
          title="Open externally"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Webview Content / Live Iframe */}
      <div className="flex-1 bg-[#05070d] overflow-hidden flex flex-col">
        {activeTab.id === 'tab-yt' ? (
          <div className="flex-1 flex flex-col bg-[#05070d] text-slate-300">
            {/* Mock Tron / YouTube player area */}
            <div className="w-full aspect-video bg-black flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
              <img
                src="https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80"
                alt="Tron Synthwave"
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute z-20 flex flex-col items-center justify-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-cyan-500/90 hover:bg-cyan-400 text-black flex items-center justify-center shadow-lg shadow-cyan-500/50 cursor-pointer transition-transform hover:scale-110">
                  <Music className="w-6 h-6 ml-0.5" />
                </div>
                <span className="text-xs font-mono font-bold text-white bg-black/60 px-2 py-0.5 rounded">
                  TRON LEGACY Daft Punk End Of Line Slowed
                </span>
              </div>
            </div>

            {/* Video description info bar */}
            <div className="p-3 border-b border-[#1a2337] space-y-2 bg-[#0c101a]">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-semibold text-white">TRON LEGACY Daft Punk End Of Line Slowed</h4>
                  <p className="text-[11px] text-slate-400">2.4M views · 2y ago</p>
                </div>
                <button className="px-3 py-1 rounded bg-white text-black font-semibold text-xs hover:bg-slate-200 transition-colors">
                  Subscribe
                </button>
              </div>

              {/* Watermark branding */}
              <div className="flex items-center justify-between pt-1 border-t border-[#1a2337] text-[11px] text-slate-400">
                <span className="text-cyan-400 font-semibold font-mono">⚡ RakkyXD Stream</span>
                <span>rest a while, user // Relaxing Ambient Music</span>
              </div>
            </div>
          </div>
        ) : (
          <iframe
            src={activeTab.url}
            className="w-full h-full border-0 bg-white"
            title="Browser Webview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </aside>
  );
};
