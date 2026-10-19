import React, { useState, useEffect } from 'react';
import { 
  X, 
  Globe, 
  CheckCircle2, 
  Loader2, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle,
  KeyRound
} from 'lucide-react';

interface BrowserLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthUpdated?: () => void;
}

interface ProviderStatus {
  name: string;
  service: 'chatgpt' | 'claude' | 'gemini' | 'deepseek';
  icon: string;
  color: string;
  borderColor: string;
  description: string;
  isLoggedIn: boolean;
}

export const BrowserLoginModal: React.FC<BrowserLoginModalProps> = ({
  isOpen,
  onClose,
  onAuthUpdated
}) => {
  const [authStatus, setAuthStatus] = useState<Record<string, boolean>>({});
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fetchAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (data.auth) {
        setAuthStatus(data.auth);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchAuthStatus();
      setErrorMessage('');
      setStatusMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const providers: ProviderStatus[] = [
    {
      name: 'ChatGPT / OpenAI',
      service: 'chatgpt',
      icon: '🟢',
      color: 'bg-emerald-500/10 text-emerald-400',
      borderColor: 'border-emerald-500/30',
      description: 'Web session token from chatgpt.com. Supports GPT-4o & o1.',
      isLoggedIn: !!authStatus['chatgpt'] || !!authStatus['openai']
    },
    {
      name: 'Claude / Anthropic',
      service: 'claude',
      icon: '🟠',
      color: 'bg-amber-500/10 text-amber-400',
      borderColor: 'border-amber-500/30',
      description: 'Web session from claude.ai. Supports Claude 3.7 & 3.5 Sonnet.',
      isLoggedIn: !!authStatus['claude'] || !!authStatus['anthropic']
    },
    {
      name: 'Google Gemini',
      service: 'gemini',
      icon: '🔵',
      color: 'bg-blue-500/10 text-blue-400',
      borderColor: 'border-blue-500/30',
      description: 'Google account session for Gemini 2.5 Pro & Flash.',
      isLoggedIn: !!authStatus['gemini']
    },
    {
      name: 'DeepSeek',
      service: 'deepseek',
      icon: '🟣',
      color: 'bg-purple-500/10 text-purple-400',
      borderColor: 'border-purple-500/30',
      description: 'Session cookie from chat.deepseek.com for DeepSeek V3 / R1.',
      isLoggedIn: !!authStatus['deepseek']
    }
  ];

  const handleStartBrowserLogin = async (service: string) => {
    setLoadingService(service);
    setErrorMessage('');
    setStatusMessage(`A login window for ${service} is open. Log in as normal — it closes by itself when done.`);

    try {
      let data: { success: boolean; error?: string };
      if (window.bridgemind?.browserLogin) {
        // Desktop app: native login window, session captured automatically.
        data = await window.bridgemind.browserLogin(service);
      } else {
        const res = await fetch('/api/auth/browser-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service })
        });
        data = await res.json();
      }

      if (data.success) {
        setStatusMessage(`✔ Logged in to ${service}. Session saved locally.`);
        await fetchAuthStatus();
        if (onAuthUpdated) onAuthUpdated();
      } else {
        setStatusMessage('');
        setErrorMessage(data.error || 'Failed to authenticate via browser');
      }
    } catch (err: any) {
      setStatusMessage('');
      setErrorMessage(err.message || 'Error communicating with Studio Server');
    } finally {
      setLoadingService(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-xl bg-[#0e131f] border border-[#232f48] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#1f293d] flex items-center justify-between bg-[#111726]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Browser Authentication</h3>
              <p className="text-[11px] text-slate-400">
                Log in once via real browser. Zero API keys required.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-[#1a2337] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-4 py-2.5 bg-[#141b2b] border-b border-[#1f293d] flex items-center space-x-2 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Uses OpenCode-style automated browser capture. Tokens are safely stored locally in <code className="text-cyan-300 font-mono">~/.opencode-multi/auth.json</code>.
          </span>
        </div>

        {/* Providers Grid */}
        <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
          {providers.map((p) => {
            const isLoading = loadingService === p.service;

            return (
              <div
                key={p.service}
                className={`p-3.5 rounded-lg border transition-all ${
                  p.isLoggedIn
                    ? 'bg-[#121a2a] border-emerald-800/40'
                    : 'bg-[#121724] border-[#1e283d] hover:border-slate-600'
                } flex items-center justify-between`}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-lg select-none">{p.icon}</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-200">{p.name}</span>
                      {p.isLoggedIn ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-medium flex items-center space-x-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Connected</span>
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Not Authenticated
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                </div>

                <button
                  disabled={isLoading || loadingService !== null}
                  onClick={() => handleStartBrowserLogin(p.service)}
                  className={`ml-4 px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1.5 shrink-0 transition-all ${
                    isLoading
                      ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-700 cursor-not-allowed'
                      : p.isLoggedIn
                      ? 'bg-[#1a2438] hover:bg-[#23314c] text-slate-300 border border-[#2b3a58]'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Logging in...</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{p.isLoggedIn ? 'Re-login' : 'Login Browser'}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Live Feedback / Alerts */}
        {(statusMessage || errorMessage) && (
          <div className="px-4 pb-3">
            {statusMessage && (
              <div className="p-2.5 rounded bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
            {errorMessage && (
              <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2 mt-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-[#111726] border-t border-[#1f293d] flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center space-x-1">
            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
            <span>OpenCode Authentication Harness</span>
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#1a2337] hover:bg-[#232f48] text-slate-200 border border-[#27354f] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
