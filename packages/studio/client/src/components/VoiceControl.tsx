import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Globe, Sparkles, Check, AlertCircle } from 'lucide-react';

interface VoiceControlProps {
  onTranscript: (text: string) => void;
  onExecute: () => void;
  onBroadcast: () => void;
  onInterrupt: () => void;
  onClear: () => void;
  onLaunchSix?: () => void;
  onStartClaudeAll?: () => void;
}

export const VoiceControl: React.FC<VoiceControlProps> = ({
  onTranscript,
  onExecute,
  onBroadcast,
  onInterrupt,
  onClear,
  onLaunchSix,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [lang, setLang] = useState<'th-TH' | 'en-US'>('th-TH');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [detectedAction, setDetectedAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition if supported
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg('Voice recognition not supported in this browser engine');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const text = (finalTranscript || interimTranscript).trim();
      if (text) {
        setLiveTranscript(text);
        onTranscript(text);

        const lower = text.toLowerCase();
        // Detect Thai commands
        if (lower.includes('ส่งทุกตัว') || lower.includes('ส่งทุกคน') || lower.includes('ส่งทั้งหมด')) {
          setDetectedAction('⚡ ส่งคำสั่งให้ทุกตัว (Broadcast)');
          onBroadcast();
        } else if (lower.includes('รัน') || lower.includes('ส่งเลย') || lower.includes('สั่งงาน')) {
          setDetectedAction('▶ สั่งรันคำสั่ง (Run)');
          onExecute();
        } else if (lower.includes('หยุด') || lower.includes('ยกเลิก') || lower.includes('คอนโทรลซี')) {
          setDetectedAction('🛑 หยุดการทำงาน (Ctrl+C)');
          onInterrupt();
        } else if (lower.includes('ล้างหน้าจอ') || lower.includes('เคลียร์')) {
          setDetectedAction('🧹 ล้างหน้าจอ (Clear)');
          onClear();
        } else if (lower.includes('เปิดหกตัว') || lower.includes('เปิด 6 ตัว') || lower.includes('เปิด 6 เซสชัน')) {
          setDetectedAction('🚀 เปิด 6 Agents');
          if (onLaunchSix) onLaunchSix();
        } else if (lower.includes('เริ่มคลอด') || lower.includes('รันคลอด') || lower.includes('เปิดคลอด') || lower.includes('เริ่ม claude')) {
          setDetectedAction('⚡ รัน Claude Code ทั้งหมด');
          if (onStartClaudeAll) onStartClaudeAll();
        }
        // Detect English commands
        else if (lower.includes('broadcast all') || lower.includes('send to all')) {
          setDetectedAction('⚡ Broadcast to All');
          onBroadcast();
        } else if (lower.includes('start claude') || lower.includes('run claude')) {
          setDetectedAction('⚡ Start Claude on All Seats');
          if (onStartClaudeAll) onStartClaudeAll();
        } else if (lower.includes('run') || lower.includes('execute') || lower.includes('send')) {
          setDetectedAction('▶ Execute Command');
          onExecute();
        } else if (lower.includes('stop') || lower.includes('cancel') || lower.includes('interrupt')) {
          setDetectedAction('🛑 Interrupt (Ctrl+C)');
          onInterrupt();
        } else if (lower.includes('clear')) {
          setDetectedAction('🧹 Clear Screen');
          onClear();
        } else if (lower.includes('launch 6') || lower.includes('open 6')) {
          setDetectedAction('🚀 Launch 6 Sessions');
          if (onLaunchSix) onLaunchSix();
        } else {
          setDetectedAction(null);
        }
      }
    };

    rec.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        setErrorMsg(`Voice error: ${event.error}`);
      }
    };

    rec.onend = () => {
      if (isListening) {
        try {
          rec.start();
        } catch {}
      }
    };

    recognitionRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch {}
    };
  }, [lang, isListening]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Voice Speech Recognition is initializing or not available on this system.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
      setLiveTranscript('');
      setDetectedAction(null);
    } else {
      setErrorMsg(null);
      try {
        recognitionRef.current.lang = lang;
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err: any) {
        setErrorMsg(err.message);
      }
    }
  };

  const switchLanguage = (newLang: 'th-TH' | 'en-US') => {
    setLang(newLang);
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          recognitionRef.current.lang = newLang;
          recognitionRef.current.start();
        }, 200);
      } catch {}
    }
  };

  return (
    <div className="flex items-center space-x-1.5">
      {/* Language Switcher Badge */}
      <div className="flex items-center bg-[#141a29] p-0.5 rounded border border-[#222e47] text-[11px] select-none">
        <button
          onClick={() => switchLanguage('th-TH')}
          className={`px-1.5 py-0.5 rounded font-medium transition-all ${
            lang === 'th-TH'
              ? 'bg-cyan-600 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="ภาษาไทย (Thai Speech Recognition)"
        >
          🇹🇭 TH
        </button>
        <button
          onClick={() => switchLanguage('en-US')}
          className={`px-1.5 py-0.5 rounded font-medium transition-all ${
            lang === 'en-US'
              ? 'bg-cyan-600 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="English (US Speech Recognition)"
        >
          🇺🇸 EN
        </button>
      </div>

      {/* Mic Trigger Button */}
      <button
        onClick={toggleListening}
        className={`relative flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
          isListening
            ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse'
            : 'bg-[#162033] hover:bg-[#1f2b45] text-cyan-300 border-cyan-800/60'
        }`}
        title={
          isListening
            ? `กำลังฟังเสียง (${lang === 'th-TH' ? 'ไทย' : 'EN'})... คลิกเพื่อหยุด`
            : `เปิดสั่งงานด้วยเสียง (${lang === 'th-TH' ? 'ไทย' : 'EN'})`
        }
      >
        {isListening ? (
          <>
            <Mic className="w-3.5 h-3.5 text-rose-400 animate-spin" />
            <span className="font-semibold text-rose-300">Listening...</span>
            {/* Audio wave bars */}
            <span className="flex items-center space-x-0.5 ml-1">
              <span className="w-1 h-3 bg-rose-400 rounded-full animate-bounce" />
              <span className="w-1 h-4 bg-rose-300 rounded-full animate-bounce delay-75" />
              <span className="w-1 h-2 bg-rose-400 rounded-full animate-bounce delay-150" />
            </span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-cyan-400" />
            <span>Voice</span>
          </>
        )}
      </button>

      {/* Floating Voice Transcript HUD when active */}
      {isListening && liveTranscript && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#0e1424]/95 border-2 border-cyan-500/70 backdrop-blur-md rounded-xl p-3 shadow-2xl max-w-lg w-full text-center space-y-1.5 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between text-[11px] text-cyan-400 font-mono">
            <span className="flex items-center space-x-1">
              <Volume2 className="w-3.5 h-3.5 animate-pulse" />
              <span>Voice Recognition ({lang === 'th-TH' ? 'ภาษาไทย' : 'English'})</span>
            </span>
            {detectedAction && (
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold animate-pulse">
                {detectedAction}
              </span>
            )}
          </div>
          <p className="text-white text-sm font-medium tracking-wide break-words">
            "{liveTranscript}"
          </p>
          <p className="text-[10px] text-slate-400">
            พูดคำสั่ง: "รัน", "ส่งทุกตัว", "หยุด", "ล้างหน้าจอ", "เปิด 6 ตัว" หรือ Dictate โค้ด
          </p>
        </div>
      )}
    </div>
  );
};
