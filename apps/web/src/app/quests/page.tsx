'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { getDevSessionFromQuery, getClientSessionCookie } from '../../lib/auth-session';
import { SoundEngine } from '../../lib/sound-engine';

interface DailyQuestItem {
  id: 'hunt_cards' | 'win_duel' | 'upgrade_card' | string;
  title: string;
  current: number;
  target: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
}

interface QuestsApiResponse {
  streak: number;
  lastDailyClaim: string | null;
  cooldown: {
    canClaim: boolean;
    remainingMs: number;
    remainingHours: number;
    remainingMinutes: number;
    remainingSeconds: number;
  };
  quests: DailyQuestItem[];
  lastResetDate: string;
  crystals: number;
}

const QUEST_METADATA: Record<
  string,
  {
    icon: string;
    description: string;
    actionLabel: string;
    actionHref: string;
    colorTheme: {
      border: string;
      glow: string;
      gradient: string;
      progress: string;
    };
  }
> = {
  hunt_cards: {
    icon: '🎴',
    description: 'Hunt and summon 2 cards in the wilderness or via /hunt command.',
    actionLabel: 'Go Hunting',
    actionHref: '/collection',
    colorTheme: {
      border: 'border-cyan-500/30',
      glow: 'shadow-[0_0_25px_rgba(6,182,212,0.15)]',
      gradient: 'from-cyan-500/10 via-slate-900/60 to-slate-950',
      progress: 'from-cyan-500 to-blue-500',
    },
  },
  win_duel: {
    icon: '⚔️',
    description: 'Enter the Arena and secure victory against a rival duelist.',
    actionLabel: 'Enter Arena',
    actionHref: '/duel',
    colorTheme: {
      border: 'border-rose-500/30',
      glow: 'shadow-[0_0_25px_rgba(244,63,94,0.15)]',
      gradient: 'from-rose-500/10 via-slate-900/60 to-slate-950',
      progress: 'from-rose-500 to-orange-500',
    },
  },
  upgrade_card: {
    icon: '⚡',
    description: 'Infuse crystals to upgrade any card level in your collection.',
    actionLabel: 'Open Binder',
    actionHref: '/collection',
    colorTheme: {
      border: 'border-amber-500/30',
      glow: 'shadow-[0_0_25px_rgba(245,158,11,0.15)]',
      gradient: 'from-amber-500/10 via-slate-900/60 to-slate-950',
      progress: 'from-amber-500 to-yellow-400',
    },
  },
};

function QuestsContent() {
  const searchParams = useSearchParams();
  const asParam = searchParams.get('as');

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<QuestsApiResponse | null>(null);
  const [userCrystals, setUserCrystals] = useState<number>(0);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

  const [isClaimingDaily, setIsClaimingDaily] = useState(false);
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null);
  const [celebrationMessage, setCelebrationMessage] = useState<{
    text: string;
    crystals: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authenticate user check
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (asParam) {
      const dev = getDevSessionFromQuery(asParam);
      if (dev?.isValid && dev.userId) {
        setUserId(dev.userId);
        return;
      }
    }
    const cookie = getClientSessionCookie();
    if (cookie.isValid && cookie.userId) {
      setUserId(cookie.userId);
    }
  }, [asParam]);

  // Fetch Quests data
  const fetchData = async () => {
    try {
      setErrorMessage(null);
      const query = asParam ? `?as=${encodeURIComponent(asParam)}` : '';
      const res = await fetch(`/api/quests${query}`);

      if (!res.ok) {
        if (res.status === 401) {
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to load quest data');
      }

      const questData: QuestsApiResponse = await res.json();
      setData(questData);
      setUserCrystals(questData.crystals);

      if (!questData.cooldown.canClaim) {
        setCountdownSeconds(Math.ceil(questData.cooldown.remainingMs / 1000));
      } else {
        setCountdownSeconds(0);
      }
    } catch (err: unknown) {
      console.error('[Quests] Load error:', err);
      setErrorMessage('Could not load daily rewards. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [asParam]);

  // Live countdown timer ticker
  useEffect(() => {
    if (countdownSeconds <= 0) return;

    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          // Timer finished, refresh data so claim button appears
          fetchData();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownSeconds]);

  // Format countdown seconds into HH:MM:SS
  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, '0')}h ${minutes
      .toString()
      .padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  // Claim Daily Login Reward
  const handleClaimDaily = async () => {
    if (isClaimingDaily || !data?.cooldown.canClaim) return;
    setIsClaimingDaily(true);
    setErrorMessage(null);

    try {
      const query = asParam ? `?as=${encodeURIComponent(asParam)}` : '';
      const res = await fetch(`/api/quests/daily${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setErrorMessage(result.error || result.message || 'Failed to claim daily reward.');
        return;
      }

      try {
        SoundEngine.getInstance().playVictory();
      } catch {}

      setCelebrationMessage({
        text: `Daily Streak Advanced! (Day ${result.streak} 🔥)`,
        crystals: result.crystalsAwarded || 100,
      });

      if (result.newTotalCrystals !== undefined) {
        setUserCrystals(result.newTotalCrystals);
      }

      // Re-fetch to update streak & timer
      await fetchData();
    } catch (err) {
      console.error('[Quests] Claim daily error:', err);
      setErrorMessage('Network error while claiming reward.');
    } finally {
      setIsClaimingDaily(false);
    }
  };

  // Claim Quest Reward
  const handleClaimQuest = async (questId: string) => {
    if (claimingQuestId) return;
    setClaimingQuestId(questId);
    setErrorMessage(null);

    try {
      const query = asParam ? `?as=${encodeURIComponent(asParam)}` : '';
      const res = await fetch(`/api/quests/claim${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setErrorMessage(result.error || 'Failed to claim quest bounty.');
        return;
      }

      try {
        SoundEngine.getInstance().playVictory();
      } catch {}

      setCelebrationMessage({
        text: `Bounty Claimed: ${result.quest?.title || 'Quest Complete'}!`,
        crystals: result.crystalsAwarded || 50,
      });

      if (result.newTotalCrystals !== undefined) {
        setUserCrystals(result.newTotalCrystals);
      }

      // Re-fetch to update quest list
      await fetchData();
    } catch (err) {
      console.error('[Quests] Claim quest error:', err);
      setErrorMessage('Network error claiming bounty.');
    } finally {
      setClaimingQuestId(null);
    }
  };

  const streak = data?.streak || 0;
  // Calculate potential next daily crystals
  const nextStreak = streak === 0 ? 1 : streak + 1;
  const estimatedNextReward = 100 + Math.min(250, nextStreak * 15);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 border border-slate-800/80 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black tracking-wider uppercase mb-3">
                <span className="animate-bounce">🔥</span>
                <span>Daily Rewards & Quest Hub</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                Ignite Your <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">Streak</span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-xl">
                Check in every 20-48 hours to maintain your burning flame and multiply your daily Crystal payout. Complete tactical bounties before 00:00 UTC to earn bonus riches.
              </p>
            </div>

            {/* User Crystal Wallet Status */}
            <div className="flex items-center gap-4 bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/40">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-md shadow-amber-500/30">
                💎
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Crystal Balance
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-300">
                  {userCrystals.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-sm font-semibold flex items-center justify-between animate-fadeIn">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Celebration Toast Modal */}
        {celebrationMessage && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-cyan-500/20 border border-amber-400/50 text-amber-200 text-sm font-bold flex items-center justify-between shadow-xl shadow-amber-500/10 animate-bounce">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <div>{celebrationMessage.text}</div>
                <div className="text-xs text-amber-300/80 font-normal">
                  Added <span className="font-black text-amber-300">+{celebrationMessage.crystals} 💎 Crystals</span> to your vault!
                </div>
              </div>
            </div>
            <button
              onClick={() => setCelebrationMessage(null)}
              className="px-3 py-1 bg-amber-500/30 hover:bg-amber-500/50 rounded-lg text-xs font-black text-white"
            >
              Nice!
            </button>
          </div>
        )}

        {/* Non-authenticated prompt */}
        {!userId && !isLoading && (
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-indigo-500/30 text-center space-y-4">
            <div className="text-4xl">🔐</div>
            <h2 className="text-xl font-bold text-white">Login Required</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Connect your Discord account to track your daily streaks, complete quests, and claim Crystal rewards.
            </p>
            <div>
              <a
                href="/api/auth/discord/login?returnTo=/quests"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-[#5865F2]/25"
              >
                <span>Login with Discord</span>
              </a>
            </div>
          </div>
        )}

        {/* 1. 7-Day Streak Tracker Banner */}
        <section className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-xl">
                🔥
              </div>
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <span>7-Day Login Streak</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold">
                    {streak} {streak === 1 ? 'Day' : 'Days'} Active
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Claim every 20–48 hours. +15 💎 bonus per streak day (up to +250 💎).
                </p>
              </div>
            </div>

            {/* Quick Action Button or Cooldown Display */}
            <div>
              {data?.cooldown.canClaim ? (
                <button
                  type="button"
                  id="claim-daily-btn"
                  disabled={isClaimingDaily}
                  onClick={handleClaimDaily}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 active:scale-95 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-orange-500/25 border border-amber-300/50 flex items-center justify-center gap-2 transition-all cursor-pointer animate-pulse"
                >
                  {isClaimingDaily ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Claiming...</span>
                    </>
                  ) : (
                    <>
                      <span>🔥</span>
                      <span>Claim Daily Reward (+{estimatedNextReward} 💎)</span>
                    </>
                  )}
                </button>
              ) : (
                <div
                  id="daily-cooldown-display"
                  className="px-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-2xl flex items-center gap-3 text-xs"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Next Claim Unlocks In
                    </span>
                    <span className="font-mono font-black text-cyan-400 text-sm">
                      {countdownSeconds > 0 ? formatTimer(countdownSeconds) : 'Ready!'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 7-Day Visual Progression Track */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
            {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
              // Normalized streak cycle (1-7)
              const cycleDay = ((streak - 1) % 7) + 1;
              const isPastCompleted = streak > 0 && dayNum <= cycleDay;
              const isCurrentTarget = dayNum === (streak === 0 ? 1 : cycleDay + 1 > 7 ? 7 : cycleDay);
              const milestoneCrystals = 100 + Math.min(250, dayNum * 15);

              return (
                <div
                  key={dayNum}
                  className={`relative rounded-2xl p-4 flex flex-col items-center justify-between text-center transition-all ${
                    isPastCompleted
                      ? 'bg-gradient-to-b from-orange-500/20 to-slate-900 border-2 border-orange-500/60 shadow-[0_0_20px_rgba(249,115,22,0.2)]'
                      : isCurrentTarget
                      ? 'bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-950 border-2 border-amber-400/80 shadow-[0_0_25px_rgba(251,191,36,0.25)] scale-105 z-10'
                      : 'bg-slate-950/60 border border-slate-800/80 opacity-60'
                  }`}
                >
                  {/* Day Label */}
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Day {dayNum}
                  </span>

                  {/* Flame Icon State */}
                  <div className="my-3 relative">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                        isPastCompleted
                          ? 'bg-orange-500/30 border border-orange-400/50 shadow-inner'
                          : isCurrentTarget
                          ? 'bg-amber-500/20 border border-amber-400/60 animate-pulse'
                          : 'bg-slate-900 border border-slate-800'
                      }`}
                    >
                      {isPastCompleted ? '🔥' : isCurrentTarget ? '✨' : '🔒'}
                    </div>

                    {isPastCompleted && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black flex items-center justify-center shadow">
                        ✓
                      </span>
                    )}
                  </div>

                  {/* Reward Crystals */}
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-amber-300">
                      +{milestoneCrystals} 💎
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold">
                      {dayNum === 7 ? 'Max Multiplier' : `Streak +${dayNum * 15}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. Daily Quests Panel */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <span>Tactical Daily Quests</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold">
                  Refreshes Daily
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Complete all three objectives every 24 hours to accelerate your card binder growth.
              </p>
            </div>

            <div className="text-xs font-bold text-slate-400 flex items-center gap-2 bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800">
              <span>🕒</span>
              <span>UTC Rollover: 00:00 (Midnight)</span>
            </div>
          </div>

          {/* Quests Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoading ? (
              // Loading placeholders
              [1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="rounded-3xl bg-slate-900/40 border border-slate-800 p-6 animate-pulse space-y-4"
                >
                  <div className="w-12 h-12 bg-slate-800 rounded-2xl" />
                  <div className="h-4 bg-slate-800 rounded w-2/3" />
                  <div className="h-3 bg-slate-800 rounded w-full" />
                  <div className="h-10 bg-slate-800 rounded-xl" />
                </div>
              ))
            ) : data?.quests && data.quests.length > 0 ? (
              data.quests.map((quest) => {
                const meta = QUEST_METADATA[quest.id] || {
                  icon: '📜',
                  description: quest.title,
                  actionLabel: 'View',
                  actionHref: '/duel',
                  colorTheme: {
                    border: 'border-slate-700',
                    glow: '',
                    gradient: 'from-slate-900 to-slate-950',
                    progress: 'from-indigo-500 to-cyan-500',
                  },
                };

                const progressPercent = Math.min(
                  100,
                  Math.round((quest.current / quest.target) * 100)
                );
                const isClaimable = quest.completed && !quest.claimed;
                const isClaimed = quest.claimed;

                return (
                  <div
                    key={quest.id}
                    id={`quest-card-${quest.id}`}
                    className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all bg-gradient-to-b ${meta.colorTheme.gradient} border ${meta.colorTheme.border} ${meta.colorTheme.glow} backdrop-blur-xl group hover:scale-[1.02]`}
                  >
                    <div>
                      {/* Top Row: Icon & Crystal Reward */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-950/80 border border-slate-700/60 flex items-center justify-center text-2xl shadow-inner">
                          {meta.icon}
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs font-black text-amber-300">
                          <span>💎</span>
                          <span>+{quest.reward}</span>
                        </div>
                      </div>

                      {/* Quest Title & Description */}
                      <h3 className="text-lg font-black text-white group-hover:text-cyan-300 transition-colors">
                        {quest.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                        {meta.description}
                      </p>

                      {/* Progress Bar Container */}
                      <div className="mt-6 space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-400">Progress</span>
                          <span className={quest.completed ? 'text-emerald-400' : 'text-slate-200'}>
                            {quest.current} / {quest.target} ({progressPercent}%)
                          </span>
                        </div>

                        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${meta.colorTheme.progress} transition-all duration-500 shadow-sm`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Area */}
                    <div className="mt-6 pt-4 border-t border-slate-800/80">
                      {isClaimed ? (
                        <div className="w-full py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2">
                          <span>✓</span>
                          <span>Reward Claimed</span>
                        </div>
                      ) : isClaimable ? (
                        <button
                          type="button"
                          id={`claim-quest-btn-${quest.id}`}
                          disabled={claimingQuestId === quest.id}
                          onClick={() => handleClaimQuest(quest.id)}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 border border-emerald-300/40 flex items-center justify-center gap-2 transition-all cursor-pointer animate-pulse"
                        >
                          {claimingQuestId === quest.id ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                              <span>Claiming...</span>
                            </>
                          ) : (
                            <>
                              <span>🎁</span>
                              <span>Claim {quest.reward} Crystals</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <Link
                          href={meta.actionHref}
                          className="w-full py-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <span>{meta.actionLabel}</span>
                          <span>→</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-3 text-center py-12 text-slate-500 text-sm">
                No active quests found.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function QuestsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <div className="animate-spin text-3xl">📜</div>
        </div>
      }
    >
      <QuestsContent />
    </Suspense>
  );
}
