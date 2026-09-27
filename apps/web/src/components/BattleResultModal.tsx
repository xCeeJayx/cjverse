'use client';

import React, { useMemo } from 'react';

export interface BattleResultModalProps {
  isOpen: boolean;
  isWinner: boolean;
  crystalsAwarded?: number;
  winnerName?: string;
  ratingDelta?: number;
  newRating?: number;
  onRematch: () => void;
  onReturnToDiscord?: () => void;
}

export const BattleResultModal: React.FC<BattleResultModalProps> = ({
  isOpen,
  isWinner,
  crystalsAwarded = 50,
  winnerName,
  ratingDelta,
  newRating,
  onRematch,
  onReturnToDiscord,
}) => {
  if (!isOpen) return null;

  // Generate deterministic particles for victory confetti
  const particles = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${(i * 3.33 + (i % 5) * 2)}%`,
      delay: `${(i % 10) * 0.3}s`,
      duration: `${2.5 + (i % 4) * 0.5}s`,
      size: `${6 + (i % 6) * 2}px`,
      color: ['#f59e0b', '#fbbf24', '#38bdf8', '#a855f7', '#ec4899', '#10b981'][i % 6],
    }));
  }, []);

  const handleDiscordClick = () => {
    if (onReturnToDiscord) {
      onReturnToDiscord();
    } else if (typeof window !== 'undefined') {
      window.location.href = 'https://discord.com/app';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      {/* Victory Confetti / Sparkle Layer */}
      {isWinner && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-sm animate-confetti"
              style={{
                left: p.left,
                top: '-10px',
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                animationDelay: p.delay,
                animationDuration: p.duration,
                boxShadow: `0 0 8px ${p.color}`,
              }}
            />
          ))}
        </div>
      )}

      {/* Modal Container */}
      <div
        className={`relative max-w-lg w-full p-8 rounded-3xl border-2 shadow-2xl text-center transform transition-all overflow-hidden ${
          isWinner
            ? 'bg-gradient-to-b from-amber-950/90 via-slate-900/95 to-slate-950 border-amber-500/60 shadow-[0_0_50px_rgba(251,191,36,0.25)]'
            : 'bg-gradient-to-b from-rose-950/90 via-slate-900/95 to-slate-950 border-rose-500/60 shadow-[0_0_50px_rgba(244,63,94,0.25)]'
        }`}
      >
        {/* Glow Accent */}
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl pointer-events-none ${
            isWinner ? 'bg-amber-500/20' : 'bg-rose-500/20'
          }`}
        />

        {/* Banner Emblem */}
        <div className="relative mb-4">
          <div className="text-6xl mb-2 filter drop-shadow-lg animate-bounce">
            {isWinner ? '👑' : '💀'}
          </div>

          {/* Laurel / Shield Subtitle */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase ${
              isWinner
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            {isWinner ? '🌿 CHAMPION OF THE ARENA 🌿' : '🛡️ VALIANT COMBATANT 🛡️'}
          </div>
        </div>

        {/* Result Headline */}
        <h2
          className={`text-5xl font-black tracking-wider uppercase mb-3 ${
            isWinner
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 drop-shadow-[0_4px_12px_rgba(251,191,36,0.6)]'
              : 'text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-red-500 to-rose-600 drop-shadow-[0_4px_12px_rgba(244,63,94,0.6)]'
          }`}
        >
          {isWinner ? 'VICTORY' : 'DEFEAT'}
        </h2>

        {/* Body Message */}
        <p className="text-slate-300 text-sm leading-relaxed mb-6 max-w-sm mx-auto">
          {isWinner
            ? 'Glorious combat! Your active lineup triumphed over your opponent in the skirmish arena!'
            : 'All your combatants were defeated in battle! Regroup your lineup, forge card upgrades, and challenge again.'}
        </p>

        {/* Reward & Rating Settlement Card */}
        <div className="mb-6 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 grid grid-cols-2 gap-3 shadow-inner text-center">
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-2xl mb-1">💎</span>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Crystals</div>
            <div className={`text-base font-black ${isWinner ? 'text-emerald-400' : 'text-slate-400'}`}>
              {isWinner ? `+${crystalsAwarded}` : '+0'}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-2xl mb-1">⚡</span>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">MMR Rating</div>
            <div className={`text-base font-black ${isWinner ? 'text-emerald-400' : 'text-rose-400'}`}>
              {ratingDelta !== undefined
                ? isWinner
                  ? `+${ratingDelta}`
                  : `-${ratingDelta}`
                : isWinner
                ? '+16'
                : '-16'}{' '}
              MMR
            </div>
            {newRating !== undefined && (
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">({newRating} Rating)</div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            id="btn-rematch"
            onClick={onRematch}
            className={`w-full py-3.5 px-6 font-black rounded-xl text-white shadow-xl transition active:scale-95 flex items-center justify-center gap-2.5 text-base tracking-wide ${
              isWinner
                ? 'bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 hover:from-amber-500 hover:to-yellow-400 shadow-amber-500/30'
                : 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 shadow-rose-600/30'
            }`}
          >
            ⚔️ Rematch in this Arena
          </button>

          <a
            id="btn-view-leaderboard"
            href="/leaderboard"
            className="w-full py-2.5 px-5 font-bold rounded-xl text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 transition text-xs flex items-center justify-center gap-2"
          >
            🏆 View Global Leaderboard
          </a>

          <a
            id="btn-view-collection"
            href="/collection"
            className="w-full py-2.5 px-5 font-bold rounded-xl text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 transition text-xs flex items-center justify-center gap-2"
          >
            🎴 Manage Lineup & Collection
          </a>

          <button
            id="btn-return-discord"
            onClick={handleDiscordClick}
            className="w-full py-2.5 px-5 font-bold rounded-xl text-slate-300 hover:text-white bg-[#5865F2]/20 hover:bg-[#5865F2]/40 border border-[#5865F2]/40 transition text-xs flex items-center justify-center gap-2"
          >
            💬 Return to Discord
          </button>
        </div>
      </div>
    </div>
  );
};
