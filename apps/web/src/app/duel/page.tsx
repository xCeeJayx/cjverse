'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';

function ArenaLobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const asParam = searchParams?.get('as');

  const [roomIdInput, setRoomIdInput] = useState('');
  const [isLaunchingBot, setIsLaunchingBot] = useState(false);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomIdInput.trim();
    if (!clean) return;
    const asSuffix = asParam ? `?as=${encodeURIComponent(asParam)}` : '';
    router.push(`/duel/${clean}${asSuffix}`);
  };

  const handleLaunchBotMatch = async () => {
    if (isLaunchingBot) return;
    setIsLaunchingBot(true);

    try {
      let query = '';
      if (asParam) {
        query = `?as=${encodeURIComponent(asParam)}`;
      }

      const res = await fetch(`/api/duel/practice${query}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.arenaUrl) {
        router.push(data.arenaUrl);
      } else if (data.roomId) {
        router.push(`/duel/${data.roomId}${query}`);
      }
    } catch (err) {
      console.error('[Arena Lobby] Launch practice error:', err);
      const fallbackRoomId = 'bot-' + Math.random().toString(36).substring(2, 8);
      router.push(`/duel/${fallbackRoomId}`);
    } finally {
      setIsLaunchingBot(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-arena-grid bg-arena-radial text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-4xl w-full mx-auto px-4 py-12 flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/40 flex items-center justify-center text-4xl shadow-[0_0_40px_rgba(99,102,241,0.25)] mb-6">
          ⚔️
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 uppercase tracking-tight mb-3">
          Skirmish Arena
        </h1>

        <p className="text-slate-400 text-sm sm:text-base max-w-lg mb-8 leading-relaxed">
          Enter real-time authoritative 3v3 card battles. Challenge human rivals or hone your strategy against the Bot AI Trainer.
        </p>

        {/* Quick Launch & Room Input Card */}
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl mb-8">
          {/* Quick Practice Bot Duel */}
          <button
            type="button"
            disabled={isLaunchingBot}
            onClick={handleLaunchBotMatch}
            className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-98 text-white font-black rounded-2xl shadow-xl shadow-emerald-900/30 border border-emerald-400/40 transition-all uppercase tracking-wider text-sm flex items-center justify-center gap-2 mb-5"
          >
            {isLaunchingBot ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Entering Arena...</span>
              </>
            ) : (
              <>
                <span>⚔️</span>
                <span>Practice Duel (vs Bot)</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              or enter room
            </span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Join Existing Room Form */}
          <form onSubmit={handleJoinRoom} className="flex gap-2">
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              placeholder="Enter Room ID (e.g. duel-892)"
              className="flex-1 px-4 py-3 bg-slate-950/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              type="submit"
              disabled={!roomIdInput.trim()}
              className="py-3 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition-all"
            >
              Join
            </button>
          </form>
        </div>

        {/* Deckbuilder Callout */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Need to modify your 3v3 team?</span>
          <Link
            href="/collection"
            className="text-cyan-400 font-bold hover:underline flex items-center gap-1"
          >
            <span>Open Card Binder & Deckbuilder</span>
            <span>→</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function ArenaLobbyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <div className="animate-spin text-3xl">⚔️</div>
        </div>
      }
    >
      <ArenaLobbyContent />
    </Suspense>
  );
}
