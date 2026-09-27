import React from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 bg-arena-grid bg-arena-radial text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-500/40 text-xs font-bold text-indigo-300 uppercase tracking-widest mb-6 shadow-md shadow-indigo-950/50">
          <span>⚡ Real-Time Authoritative Card Skirmish</span>
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-white mb-6">
          Collect.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500">
            Deckbuild.
          </span>{' '}
          Dominate.
        </h1>

        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mb-12 leading-relaxed">
          CJVerse combines tactical 3v3 team deckbuilding with fast-paced real-time skirmish arena combat. Collect cards across 7 fantasy races, 5 rarity variants, and elemental tiers.
        </p>

        {/* Action Gateway Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-12">
          {/* Card Binder & Deckbuilder Gateway */}
          <Link
            href="/collection"
            className="group relative flex flex-col justify-between p-8 bg-slate-900/80 hover:bg-slate-900/95 border border-slate-800 hover:border-cyan-500/50 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-[0_0_35px_rgba(6,182,212,0.2)] text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-colors" />
            <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-3xl mb-6 group-hover:scale-105 transition-transform">
              🎴
            </div>
            <div>
              <h2 className="text-2xl font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-wide">
                Collection & Team
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                Inspect your visual card binder with 3D tilt sheen FX. Build your 3v3 active lineup across Vanguard, Striker, and Conduit slots.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <span>Enter Binder</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>

          {/* Skirmish Arena Gateway */}
          <Link
            href="/duel"
            className="group relative flex flex-col justify-between p-8 bg-slate-900/80 hover:bg-slate-900/95 border border-slate-800 hover:border-amber-500/50 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-[0_0_35px_rgba(251,191,36,0.2)] text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/20 transition-colors" />
            <div className="w-14 h-14 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-3xl mb-6 group-hover:scale-105 transition-transform">
              ⚔️
            </div>
            <div>
              <h2 className="text-2xl font-black text-white group-hover:text-amber-400 transition-colors uppercase tracking-wide">
                Skirmish Arena
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                Step onto the battle canvas. Execute Basic Attacks, Elemental Bursts, and Ultimate strikes in real-time authoritative turn-based combat.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <span>Enter Arena</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
