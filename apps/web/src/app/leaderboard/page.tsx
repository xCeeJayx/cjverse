'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { getDevSessionFromQuery, getClientSessionCookie } from '../../lib/auth-session';

interface RankedPlayer {
  rank: number;
  id: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  wins: number;
  losses: number;
  winRate: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  tierInfo: {
    color: string;
    badgeBg: string;
    badgeText: string;
    borderColor: string;
  };
  crystals: number;
}

interface RecentMatch {
  id: string;
  player1: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  player2: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  winnerId: string | null;
  isPlayer1Winner: boolean;
  summary: {
    winnerDelta?: number;
    loserDelta?: number;
    crystalsWon?: number;
    cardsUsed?: { p1?: string[]; p2?: string[] };
    turnsCount?: number;
    completedAt?: string;
  } | null;
  combatLogsCount: number;
  createdAt: string;
}

const TIER_BADGES: Record<
  string,
  { label: string; bg: string; text: string; border: string; glow: string }
> = {
  Diamond: {
    label: 'DIAMOND',
    bg: 'bg-cyan-950/80',
    text: 'text-cyan-300',
    border: 'border-cyan-400',
    glow: 'shadow-[0_0_15px_rgba(34,211,238,0.35)]',
  },
  Gold: {
    label: 'GOLD',
    bg: 'bg-amber-950/80',
    text: 'text-amber-300',
    border: 'border-amber-400',
    glow: 'shadow-[0_0_15px_rgba(251,191,36,0.35)]',
  },
  Silver: {
    label: 'SILVER',
    bg: 'bg-slate-800',
    text: 'text-slate-200',
    border: 'border-slate-400',
    glow: 'shadow-[0_0_10px_rgba(226,232,240,0.2)]',
  },
  Bronze: {
    label: 'BRONZE',
    bg: 'bg-stone-900',
    text: 'text-amber-600',
    border: 'border-amber-700',
    glow: 'shadow-none',
  },
};

function formatRankMedal(rank: number): React.ReactNode {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return <span className="font-mono text-xs font-bold text-slate-400">#{rank}</span>;
}

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const asParam = searchParams?.get('as');

  const [activeTab, setActiveTab] = useState<'rankings' | 'matches'>('rankings');
  const [rankings, setRankings] = useState<RankedPlayer[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Authenticated user session for row highlighting
  const currentUserId = (() => {
    if (asParam) {
      const dev = getDevSessionFromQuery(asParam);
      if (dev?.isValid && dev.userId) return dev.userId;
    }
    const cookie = getClientSessionCookie();
    if (cookie.isValid && cookie.userId) return cookie.userId;
    return null;
  })();

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
          const data = await res.json();
          if (data.rankings) setRankings(data.rankings);
          if (data.recentMatches) setRecentMatches(data.recentMatches);
        }
      } catch (err) {
        console.warn('[Leaderboard] Fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 bg-arena-grid bg-arena-radial text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
        {/* Header Hero Banner */}
        <section className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-3">
              <span>🏆 Competitive Season 1</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 uppercase tracking-tight">
              Global Leaderboards
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl">
              Track top-ranked duelists, Elo MMR standings, win streaks, and recent authoritative skirmish match history.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center p-1.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl shrink-0 self-start md:self-auto">
            <button
              type="button"
              id="tab-rankings"
              onClick={() => setActiveTab('rankings')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                activeTab === 'rankings'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 shadow-lg shadow-amber-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span>🏅</span>
              <span>Rankings (Top 50)</span>
            </button>

            <button
              type="button"
              id="tab-recent-matches"
              onClick={() => setActiveTab('matches')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                activeTab === 'matches'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span>⚔️</span>
              <span>Recent Matches</span>
            </button>
          </div>
        </section>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl animate-spin mb-3">
              🏆
            </div>
            <div className="text-sm font-bold text-slate-300 animate-pulse">
              Hydrating Leaderboards & Match Archives...
            </div>
          </div>
        ) : activeTab === 'rankings' ? (
          /* TAB 1: Rankings Table */
          <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-4 px-6 text-center w-16">Rank</th>
                    <th className="py-4 px-6">Duelist</th>
                    <th className="py-4 px-6 text-center">Rank Tier</th>
                    <th className="py-4 px-6 text-right">Elo Rating (MMR)</th>
                    <th className="py-4 px-6 text-center">Record (W - L)</th>
                    <th className="py-4 px-6 text-right">Win Rate</th>
                    <th className="py-4 px-6 text-right">Crystals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {rankings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                        No duelists registered on the leaderboard yet.
                      </td>
                    </tr>
                  ) : (
                    rankings.map((player) => {
                      const isMe = currentUserId === player.id;
                      const tierBadge =
                        TIER_BADGES[player.tier] || TIER_BADGES.Bronze;

                      return (
                        <tr
                          key={player.id}
                          className={`transition-colors duration-150 ${
                            isMe
                              ? 'bg-cyan-950/30 hover:bg-cyan-950/40 ring-1 ring-inset ring-cyan-500/50'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          {/* Rank */}
                          <td className="py-4 px-6 text-center">
                            {formatRankMedal(player.rank)}
                          </td>

                          {/* Duelist Avatar & Username */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {player.avatarUrl ? (
                                <img
                                  src={player.avatarUrl}
                                  alt={player.username}
                                  className="w-9 h-9 rounded-full border border-slate-700 object-cover shadow-sm"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white shadow-sm">
                                  {player.username[0]?.toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">
                                    {player.username}
                                  </span>
                                  {isMe && (
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500 text-slate-950">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[10px] text-slate-500">
                                  ID: {player.id}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Rank Tier Badge */}
                          <td className="py-4 px-6 text-center">
                            <span
                              className={`inline-block text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border} ${tierBadge.glow}`}
                            >
                              {tierBadge.label}
                            </span>
                          </td>

                          {/* Elo Rating */}
                          <td className="py-4 px-6 text-right font-black text-base text-amber-300 tracking-tight">
                            ⚡ {player.rating.toLocaleString()}
                          </td>

                          {/* Record W - L */}
                          <td className="py-4 px-6 text-center font-mono text-xs text-slate-300">
                            <span className="text-emerald-400 font-bold">
                              {player.wins}W
                            </span>
                            <span className="text-slate-500 mx-1">-</span>
                            <span className="text-rose-400 font-bold">
                              {player.losses}L
                            </span>
                          </td>

                          {/* Win Rate % */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${player.winRate}%` }}
                                />
                              </div>
                              <span className="font-bold text-xs text-slate-200">
                                {player.winRate}%
                              </span>
                            </div>
                          </td>

                          {/* Crystals */}
                          <td className="py-4 px-6 text-right font-bold text-xs text-amber-400">
                            💎 {player.crystals.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TAB 2: Recent Matches */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {recentMatches.length === 0 ? (
              <div className="col-span-2 p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800">
                <span className="text-4xl mb-3 block">⚔️</span>
                <h3 className="text-lg font-bold text-white">No completed matches recorded yet</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Launch a practice bot duel or challenge a friend to generate match history!
                </p>
              </div>
            ) : (
              recentMatches.map((match) => {
                const isP1Winner = match.isPlayer1Winner;
                const winner = isP1Winner ? match.player1 : match.player2;
                const loser = isP1Winner ? match.player2 : match.player1;

                const crystalsWon = match.summary?.crystalsWon ?? 50;
                const winnerDelta = match.summary?.winnerDelta ?? 16;
                const loserDelta = match.summary?.loserDelta ?? 16;

                return (
                  <div
                    key={match.id}
                    className="p-5 bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-slate-700 rounded-2xl shadow-xl transition-all"
                  >
                    {/* Match Card Header */}
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          #{match.id}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                          Completed
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(match.createdAt).toLocaleDateString()}{' '}
                        {new Date(match.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Combatant Face-Off */}
                    <div className="flex items-center justify-between gap-4 mb-4">
                      {/* Winner */}
                      <div className="flex-1 flex items-center gap-3">
                        <div className="relative">
                          {winner.avatarUrl ? (
                            <img
                              src={winner.avatarUrl}
                              alt={winner.username}
                              className="w-10 h-10 rounded-full border-2 border-amber-400 object-cover shadow-md"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 border-2 border-amber-400 flex items-center justify-center font-bold text-xs text-white">
                              {winner.username[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="absolute -top-1.5 -right-1.5 text-xs">👑</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-white truncate">
                            {winner.username}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                            <span>VICTORY</span>
                            <span>(+{winnerDelta} MMR)</span>
                          </div>
                        </div>
                      </div>

                      <span className="text-slate-600 font-black italic text-xs">VS</span>

                      {/* Loser */}
                      <div className="flex-1 flex items-center justify-end gap-3 text-right">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-slate-300 truncate">
                            {loser.username}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-rose-400">
                            <span>DEFEAT</span>
                            <span>(-{loserDelta} MMR)</span>
                          </div>
                        </div>
                        <div className="relative">
                          {loser.avatarUrl ? (
                            <img
                              src={loser.avatarUrl}
                              alt={loser.username}
                              className="w-10 h-10 rounded-full border border-slate-700 object-cover opacity-75"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-400">
                              {loser.username[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Match Card Footer */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span>Turns: {match.summary?.turnsCount || 6}</span>
                        <span>•</span>
                        <span className="font-bold text-amber-400">
                          +{crystalsWon} Crystals
                        </span>
                      </div>

                      <a
                        href={`/duel/${match.id}`}
                        className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
                      >
                        <span>View Arena</span>
                        <span>→</span>
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <div className="animate-spin text-3xl">🏆</div>
        </div>
      }
    >
      <LeaderboardContent />
    </Suspense>
  );
}
