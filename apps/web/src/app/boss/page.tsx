'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { getClientSessionCookie, getDevSessionFromQuery } from '../../lib/auth-session';

interface BossData {
  id: string;
  name: string;
  element: string;
  totalHp: number;
  currentHp: number;
  status: string;
  hpPercent: number;
  startsAt: string;
  expiresAt: string | null;
}

interface Contributor {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalDamage: number;
  attemptsCount: number;
}

interface Eligibility {
  canFight: boolean;
  reason?: string;
  attemptsRemaining: number;
  maxAttempts: number;
  resetsInHours?: number;
  hasLineup: boolean;
}

export default function WorldBossPage() {
  const [boss, setBoss] = useState<BossData | null>(null);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine current user
  const [userId, setUserId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const as = sp.get('as') || sp.get('userId');
      if (as) {
        const dev = getDevSessionFromQuery(as);
        if (dev?.isValid && dev.userId) return dev.userId;
      }
      const cookie = getClientSessionCookie();
      if (cookie.isValid && cookie.userId) return cookie.userId;
    }
    return null;
  });

  const fetchBossData = async () => {
    try {
      setLoading(true);
      const asQuery = userId ? `?as=${userId}` : '';
      const res = await fetch(`/api/boss${asQuery}`);
      if (!res.ok) {
        throw new Error(`Failed to load boss data (${res.status})`);
      }
      const data = await res.json();
      setBoss(data.boss);
      setContributors(data.contributors || []);
      setEligibility(data.userEligibility);
    } catch (err: any) {
      setError(err.message || 'Error loading World Boss');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBossData();
  }, [userId]);

  const getElementTheme = (elem?: string) => {
    switch ((elem || '').toLowerCase()) {
      case 'fire':
        return {
          bg: 'from-red-950 via-slate-900 to-black',
          border: 'border-red-500/50',
          glow: 'shadow-[0_0_50px_rgba(239,68,68,0.25)]',
          badge: 'bg-red-500/20 text-red-400 border-red-500/30',
          text: 'text-red-400',
          icon: '🌋',
          weakness: '💧 Water & ❄️ Ice',
        };
      case 'ice':
        return {
          bg: 'from-cyan-950 via-slate-900 to-black',
          border: 'border-cyan-500/50',
          glow: 'shadow-[0_0_50px_rgba(6,182,212,0.25)]',
          badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
          text: 'text-cyan-400',
          icon: '❄️',
          weakness: '🔥 Fire & 💥 Chaos',
        };
      case 'lightning':
        return {
          bg: 'from-amber-950 via-slate-900 to-black',
          border: 'border-amber-500/50',
          glow: 'shadow-[0_0_50px_rgba(245,158,11,0.25)]',
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          text: 'text-amber-400',
          icon: '⚡',
          weakness: '⛰️ Earth & 💎 Crystal',
        };
      case 'void':
      default:
        return {
          bg: 'from-purple-950 via-slate-900 to-black',
          border: 'border-purple-500/50',
          glow: 'shadow-[0_0_50px_rgba(168,85,247,0.25)]',
          badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
          text: 'text-purple-400',
          icon: '🐙',
          weakness: '🔮 Arcane & ✨ Light',
        };
    }
  };

  const theme = getElementTheme(boss?.element);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">💀</span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                Co-op World Boss Raid
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                Server Event
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Rally your 3-card lineup against server-wide titans! Accumulate cumulative damage, survive catastrophic strikes, and earn crystal bounties.
            </p>
          </div>

          <button
            onClick={fetchBossData}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 transition-colors flex items-center gap-2"
          >
            <span>🔄</span> Refresh Status
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-sm">
            ⚠️ {error}
          </div>
        )}

        {loading && !boss ? (
          <div className="flex-1 flex items-center justify-center py-24 text-slate-400 animate-pulse">
            Summoning World Boss coordinates...
          </div>
        ) : boss ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left 2 Cols: Main Boss Stage Card */}
            <div
              className={`lg:col-span-2 rounded-3xl bg-gradient-to-b ${theme.bg} border ${theme.border} ${theme.glow} p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden`}
            >
              {/* Elemental Aura Particle Decor */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-rose-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none" />

              {/* Boss Top Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-center text-3xl shadow-lg">
                    {theme.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${theme.badge}`}>
                        {boss.element.toUpperCase()}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-800/80 text-slate-300 border border-slate-700">
                        STATUS: {boss.status.toUpperCase()}
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                      {boss.name}
                    </h2>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs uppercase font-bold text-slate-400 block">
                    Vulnerabilities
                  </span>
                  <span className="text-sm font-bold text-amber-300">
                    🎯 {theme.weakness}
                  </span>
                </div>
              </div>

              {/* Boss Massive Health Bar */}
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                  <span className="text-slate-300">Raid Boss HP</span>
                  <span className={theme.text}>
                    {boss.currentHp.toLocaleString()} / {boss.totalHp.toLocaleString()} ({boss.hpPercent}%)
                  </span>
                </div>
                <div className="h-6 w-full bg-slate-950/80 rounded-full border border-slate-700/80 p-1 overflow-hidden shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      boss.hpPercent > 50
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                        : boss.hpPercent > 20
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                        : 'bg-gradient-to-r from-rose-600 to-red-500 animate-pulse'
                    }`}
                    style={{ width: `${Math.max(1, boss.hpPercent)}%` }}
                  />
                </div>
              </div>

              {/* User Eligibility & Action Area */}
              <div className="mt-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col gap-1 text-center sm:text-left">
                  <div className="text-xs uppercase tracking-wider font-bold text-slate-400">
                    Your Raid Authorization
                  </div>
                  {eligibility ? (
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <span className="text-sm font-bold text-slate-200">
                        Attempts Remaining:
                      </span>
                      <span
                        className={`text-sm font-black ${
                          eligibility.attemptsRemaining > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {eligibility.attemptsRemaining} / {eligibility.maxAttempts}
                      </span>
                      <span className="text-xs text-slate-400">(12h reset window)</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">
                      Login or specify dev user to inspect raid eligibility.
                    </div>
                  )}

                  {eligibility && !eligibility.canFight && (
                    <p className="text-xs text-rose-400 font-medium mt-1">
                      ⚠️ {eligibility.reason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {!eligibility?.hasLineup ? (
                    <Link
                      href={`/collection${userId ? `?as=${userId}` : ''}`}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-black text-sm text-white shadow-lg transition-all text-center"
                    >
                      Equip 3-Card Lineup
                    </Link>
                  ) : (
                    <Link
                      href={`/boss/${boss.id}${userId ? `?as=${userId}` : ''}`}
                      className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-black text-sm text-white shadow-lg transition-all text-center flex items-center justify-center gap-2 ${
                        boss.status !== 'active' || !eligibility?.canFight
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:scale-105 shadow-rose-500/25 active:scale-95'
                      }`}
                    >
                      <span>⚔️</span> ENTER RAID ARENA
                    </Link>
                  )}
                </div>
              </div>

              {/* Combat Rules Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <span>⚔️</span> 1. Cleave
                  </div>
                  <p className="text-slate-400 mt-1">
                    Heavy physical strike targeting your foremost Vanguard anchor.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                    <span>⚡</span> 2. Cataclysm (AoE)
                  </div>
                  <p className="text-slate-400 mt-1">
                    Elemental storm detonating every 3 turns hitting all 3 party cards.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="font-bold text-rose-400 flex items-center gap-1.5">
                    <span>🔥</span> 3. Enrage (Turn 10+)
                  </div>
                  <p className="text-slate-400 mt-1">
                    At turn 11, boss damage increases by 300% to wipe the raid party.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Col: Top 10 Damage Contributors Leaderboard */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  <h3 className="font-black text-lg text-white">Top Raid Duelists</h3>
                </div>
                <span className="text-xs text-slate-400">Total Damage</span>
              </div>

              {contributors.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No duelists have attacked this boss yet. Be the first to strike!
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {contributors.map((c, idx) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const isTop3 = idx < 3;
                    return (
                      <div
                        key={c.userId}
                        className={`p-3 rounded-xl flex items-center justify-between border transition-all ${
                          isTop3
                            ? 'bg-slate-800/80 border-slate-700'
                            : 'bg-slate-950/50 border-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-black text-sm w-5 text-center">
                            {medals[idx] || `${idx + 1}.`}
                          </span>
                          <div>
                            <div className="font-bold text-xs sm:text-sm text-slate-200">
                              {c.username}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {c.attemptsCount} {c.attemptsCount === 1 ? 'raid attempt' : 'raid attempts'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-xs sm:text-sm text-rose-400">
                            {c.totalDamage.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 block -mt-0.5">DMG</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
