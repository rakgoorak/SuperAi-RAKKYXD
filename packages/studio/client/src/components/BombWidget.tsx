import React, { useState, useEffect } from 'react';
import { Sparkles, Moon, Sun, Bell, Settings, Flame } from 'lucide-react';

export const BombWidget: React.FC = () => {
  const [secondsLeft, setSecondsLeft] = useState(6847); // 1h 54m 07s

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 7200));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="p-3 bg-[#0a0d14] border-t border-[#1a2337] select-none flex flex-col items-center">
      {/* Unity Game Dev Pill Badge */}
      <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#1b1912] border border-[#d4af37]/60 text-[#ffd166] text-[11px] font-semibold tracking-wider uppercase mb-2 shadow-sm shadow-amber-500/10">
        <span className="w-2 h-2 rounded-full bg-[#ffd166] animate-ping inline-block" />
        <span>UNITY GAME DEV</span>
      </div>

      {/* 3D Bomb with Burning Fuse & Digital LED Display */}
      <div className="relative w-36 h-36 flex flex-col items-center justify-center">
        {/* Burning Fuse & Sparks Animation */}
        <div className="absolute top-1 right-7 flex items-center">
          {/* Fuse rope */}
          <svg width="32" height="24" viewBox="0 0 32 24" className="overflow-visible">
            <path
              d="M 2 22 Q 16 2, 28 4"
              stroke="#8c6239"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          {/* Animated Sparks */}
          <div className="relative -top-2 -left-1">
            <Flame className="w-5 h-5 text-amber-400 fill-amber-300 animate-bounce drop-shadow-[0_0_10px_#f59e0b]" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-200 rounded-full animate-ping" />
            <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 bg-orange-400 rounded-full animate-ping delay-75" />
          </div>
        </div>

        {/* Bomb Sphere */}
        <div className="relative w-28 h-28 rounded-full bg-gradient-to-b from-[#252836] via-[#14161f] to-[#0a0b10] border-2 border-[#2b334a] shadow-[0_12px_28px_rgba(0,0,0,0.8),inset_0_4px_12px_rgba(255,255,255,0.12)] flex items-center justify-center">
          {/* Golden Cap */}
          <div className="absolute -top-2.5 w-8 h-3.5 rounded-t-md bg-gradient-to-r from-[#d4af37] via-[#fff1a8] to-[#b8860b] border border-[#d4af37] shadow-sm" />

          {/* Bomb Highlight reflection */}
          <div className="absolute top-3 left-4 w-6 h-3 rounded-full bg-white/20 rotate-[-30deg] blur-[1px]" />

          {/* LED Digital Clock Face */}
          <div className="w-20 h-9 rounded-md bg-[#050608] border-2 border-[#1e2333] flex items-center justify-center shadow-inner">
            <span className="font-mono text-base font-black text-rose-500 tracking-wider drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]">
              {formatTime(secondsLeft)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Controls Bar (Profile, Dark Mode, Settings) */}
      <div className="w-full pt-2 flex items-center justify-between text-slate-400 text-xs px-1">
        {/* Profile Circle */}
        <div className="flex items-center space-x-1.5">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px] shadow-sm">
            M
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="p-1 hover:text-slate-200 hover:bg-[#141a29] rounded" title="Toggle Mode">
            <Moon className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:text-slate-200 hover:bg-[#141a29] rounded" title="Notifications">
            <Bell className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:text-slate-200 hover:bg-[#141a29] rounded" title="Settings">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
