'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '../../../components/Navbar';
import { getClientSessionCookie, getDevSessionFromQuery } from '../../../lib/auth-session';
import {
  RaidCombatCard,
  RaidBossConfig,
  executeRaidPlayerCardAction,
  executeRaidBossTurn,
  formatBossHpBar,
} from '@cjverse/game-logic';
import { soundEngine } from '../../../lib/sound-engine';

interface FloatingCombatText {
  id: string;
  text: string;
  color: string;
  isCrit?: boolean;
}

export default function BossRaidArenaPage() {
  const params = useParams();
  const router = useRouter();
  const bossId = params?.bossId as string;

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Boss & Player state
  const [boss, setBoss] = useState<RaidBossConfig | null>(null);
  const [currentBossHp, setCurrentBossHp] = useState<number>(500000);
  const [cards, setCards] = useState<RaidCombatCard[]>([]);
  const [turn, setTurn] = useState<number>(1);
  const [activeCardIdx, setActiveCardIdx] = useState<number>(0);
  const [cumulativeDamage, setCumulativeDamage] = useState<number>(0);
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingCombatText[]>([]);

  // Battle status
  const [isBattleOver, setIsBattleOver] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [raidSummary, setRaidSummary] = useState<any | null>(null);
  const [isAutoBattle, setIsAutoBattle] = useState<boolean>(false);

  const autoBattleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sound unlock helper
  const handleSoundUnlock = () => {
    soundEngine.unlock();
  };

  // Spawn floating combat text
  const spawnFloatingText = useCallback((text: string, color = '#ef4444', isCrit = false) => {
    const id = Math.random().toString();
    setFloatingTexts((prev) => [...prev, { id, text, color, isCrit }]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((ft) => ft.id !== id));
    }, 1200);
  }, []);

  // Fetch boss and player lineup
  useEffect(() => {
    async function initArena() {
      try {
        setLoading(true);
        const asQuery = userId ? `?as=${userId}` : '';

        // 1. Fetch boss
        const bossRes = await fetch(`/api/boss?bossId=${bossId}${userId ? `&as=${userId}` : ''}`);
        if (!bossRes.ok) throw new Error('Failed to load World Boss');
        const bossData = await bossRes.json();

        const b = bossData.boss;
        setBoss({
          id: b.id,
          name: b.name,
          element: b.element,
          totalHp: b.totalHp,
          currentHp: b.currentHp,
          atk: 150,
          def: 60,
        });
        setCurrentBossHp(b.currentHp);

        // 2. Fetch player lineup cards
        const userRes = await fetch(`/api/user/collection${asQuery}`);
        if (!userRes.ok) throw new Error('Failed to load player cards');
        const userData = await userRes.json();

        const lineup = userData.lineup;
        const allCards = userData.cards || [];

        const vanguardEntity = allCards.find((c: any) => c.id === lineup?.vanguardCardId);
        const strikerEntity = allCards.find((c: any) => c.id === lineup?.strikerCardId);
        const conduitEntity = allCards.find((c: any) => c.id === lineup?.conduitCardId);

        if (!vanguardEntity || !strikerEntity || !conduitEntity) {
          setError('You must equip all 3 slots (Vanguard, Striker, Conduit) before entering the raid.');
          setLoading(false);
          return;
        }

        const combatCards: RaidCombatCard[] = [
          {
            id: vanguardEntity.id,
            name: `${vanguardEntity.variant.toUpperCase()} ${vanguardEntity.race.toUpperCase()}`,
            role: 'vanguard',
            element: vanguardEntity.element,
            maxHp: Math.max(800, vanguardEntity.powerScore * 4),
            currentHp: Math.max(800, vanguardEntity.powerScore * 4),
            atk: Math.max(100, Math.floor(vanguardEntity.powerScore * 0.9)),
            def: Math.max(80, Math.floor(vanguardEntity.powerScore * 0.8)),
            currentMana: 50,
            maxMana: 100,
            isAlive: true,
          },
          {
            id: strikerEntity.id,
            name: `${strikerEntity.variant.toUpperCase()} ${strikerEntity.race.toUpperCase()}`,
            role: 'striker',
            element: strikerEntity.element,
            maxHp: Math.max(600, vanguardEntity.powerScore * 3),
            currentHp: Math.max(600, vanguardEntity.powerScore * 3),
            atk: Math.max(150, Math.floor(strikerEntity.powerScore * 1.4)),
            def: Math.max(50, Math.floor(strikerEntity.powerScore * 0.5)),
            currentMana: 50,
            maxMana: 100,
            isAlive: true,
          },
          {
            id: conduitEntity.id,
            name: `${conduitEntity.variant.toUpperCase()} ${conduitEntity.race.toUpperCase()}`,
            role: 'conduit',
            element: conduitEntity.element,
            maxHp: Math.max(500, conduitEntity.powerScore * 2.8),
            currentHp: Math.max(500, conduitEntity.powerScore * 2.8),
            atk: Math.max(120, Math.floor(conduitEntity.powerScore * 1.1)),
            def: Math.max(40, Math.floor(conduitEntity.powerScore * 0.4)),
            currentMana: 50,
            maxMana: 100,
            isAlive: true,
          },
        ];

        setCards(combatCards);
        setCombatLogs([`🚨 Raid Arena initialized! Strike down ${b.name}!`]);
      } catch (err: any) {
        setError(err.message || 'Error loading arena');
      } finally {
        setLoading(false);
      }
    }

    if (bossId) {
      initArena();
    }
  }, [bossId, userId]);

  // Submit final damage when raid completes
  const handleRaidConclusion = useCallback(
    async (finalDamage: number, turnsReached: number, teamFainted: boolean) => {
      if (isBattleOver) return;
      setIsBattleOver(true);
      setIsSubmitting(true);

      try {
        const asQuery = userId ? `?as=${userId}` : '';
        const res = await fetch(`/api/boss/submit-damage${asQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bossId,
            damageDealt: finalDamage,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setRaidSummary({
            totalDamageDealt: finalDamage,
            turnsReached,
            teamFainted,
            bossDefeated: data.bossDefeated,
            rewardAwarded: data.rewardAwarded,
            bossRemainingHp: data.boss.currentHp,
          });
        } else {
          setRaidSummary({
            totalDamageDealt: finalDamage,
            turnsReached,
            teamFainted,
            bossDefeated: false,
            rewardAwarded: 25,
            bossRemainingHp: Math.max(0, currentBossHp - finalDamage),
          });
        }
      } catch (err) {
        setRaidSummary({
          totalDamageDealt: finalDamage,
          turnsReached,
          teamFainted,
          bossDefeated: false,
          rewardAwarded: 25,
          bossRemainingHp: Math.max(0, currentBossHp - finalDamage),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [bossId, currentBossHp, isBattleOver, userId]
  );

  // Execute Player Card Action
  const handleExecutePlayerAction = useCallback(
    (actionType: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE') => {
      if (isBattleOver || !boss || cards.length === 0) return;
      handleSoundUnlock();

      const activeCard = cards[activeCardIdx];
      if (!activeCard || !activeCard.isAlive || activeCard.currentHp <= 0) {
        // Advance to next living card
        const nextLivingIdx = cards.findIndex((c, i) => i > activeCardIdx && c.isAlive && c.currentHp > 0);
        if (nextLivingIdx !== -1) {
          setActiveCardIdx(nextLivingIdx);
        }
        return;
      }

      // Play audio effect
      if (actionType === 'ULTIMATE') soundEngine.playUltimate();
      else if (actionType === 'ELEMENTAL_BURST') soundEngine.playBurst();
      else soundEngine.playAttack();

      // 1. Resolve card action against boss
      const act = executeRaidPlayerCardAction(activeCard, boss, actionType);
      const newDmg = cumulativeDamage + act.damage;
      setCumulativeDamage(newDmg);
      setCurrentBossHp((prev) => Math.max(0, prev - act.damage));

      const floatColor = act.isCrit ? '#f59e0b' : act.isWeakness ? '#38bdf8' : '#ef4444';
      spawnFloatingText(`-${act.damage} DMG`, floatColor, act.isCrit);

      setCombatLogs((prev) => [`[Turn ${turn}] ${act.log}`, ...prev.slice(0, 30)]);

      // 2. Check if all cards have acted this turn
      const livingCards = cards.filter((c) => c.isAlive && c.currentHp > 0);
      const currentPosInLiving = livingCards.findIndex((c) => c.id === activeCard.id);

      if (currentPosInLiving < livingCards.length - 1) {
        // Next card in current turn
        const nextCard = livingCards[currentPosInLiving + 1];
        const nextIdx = cards.findIndex((c) => c.id === nextCard.id);
        setActiveCardIdx(nextIdx);
      } else {
        // End of player turn: Boss executes attack!
        const bossResult = executeRaidBossTurn(boss, cards, turn);
        setCombatLogs((prev) => [`[Turn ${turn}] ${bossResult.log}`, ...prev.slice(0, 30)]);

        if (bossResult.actionType.includes('CATACLYSM')) {
          spawnFloatingText('⚡ CATACLYSM AoE!', '#c084fc', true);
        } else {
          spawnFloatingText('⚔️ CLEAVE!', '#f43f5e', false);
        }

        // Check party wipe
        const remainingLiving = cards.filter((c) => c.isAlive && c.currentHp > 0);
        if (remainingLiving.length === 0) {
          handleRaidConclusion(newDmg, turn, true);
          return;
        }

        // Check turn limit
        if (turn >= 10) {
          handleRaidConclusion(newDmg, 10, false);
          return;
        }

        // Advance to next turn
        setTurn((prev) => prev + 1);
        const firstLiving = cards.findIndex((c) => c.isAlive && c.currentHp > 0);
        setActiveCardIdx(firstLiving !== -1 ? firstLiving : 0);
      }
    },
    [
      activeCardIdx,
      boss,
      cards,
      cumulativeDamage,
      handleRaidConclusion,
      isBattleOver,
      spawnFloatingText,
      turn,
    ]
  );

  // Auto-Battle Loop
  useEffect(() => {
    if (!isAutoBattle || isBattleOver) {
      if (autoBattleTimerRef.current) {
        clearInterval(autoBattleTimerRef.current);
        autoBattleTimerRef.current = null;
      }
      return;
    }

    autoBattleTimerRef.current = setInterval(() => {
      const activeCard = cards[activeCardIdx];
      if (!activeCard || !activeCard.isAlive) {
        const nextLivingIdx = cards.findIndex((c) => c.isAlive && c.currentHp > 0);
        if (nextLivingIdx !== -1) setActiveCardIdx(nextLivingIdx);
        return;
      }

      let chosenAction: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE' = 'BASIC_ATTACK';
      if (activeCard.currentMana >= 70) chosenAction = 'ULTIMATE';
      else if (activeCard.currentMana >= 30) chosenAction = 'ELEMENTAL_BURST';

      handleExecutePlayerAction(chosenAction);
    }, 900);

    return () => {
      if (autoBattleTimerRef.current) {
        clearInterval(autoBattleTimerRef.current);
        autoBattleTimerRef.current = null;
      }
    };
  }, [isAutoBattle, isBattleOver, cards, activeCardIdx, handleExecutePlayerAction]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-slate-400 animate-pulse">
          Entering World Boss Raid Arena...
        </div>
      </div>
    );
  }

  if (error || !boss) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-red-400">Raid Arena Access Error</h2>
          <p className="text-sm text-slate-400 max-w-md">{error || 'Boss not found.'}</p>
          <Link
            href={`/boss${userId ? `?as=${userId}` : ''}`}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold text-white transition-all"
          >
            Return to Raid Hub
          </Link>
        </div>
      </div>
    );
  }

  const activeCard = cards[activeCardIdx] || cards[0];
  const hpPercent = Number(((currentBossHp / boss.totalHp) * 100).toFixed(1));

  return (
    <div
      onClick={handleSoundUnlock}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white"
    >
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Top Arena Header: Boss Raid Health Bar */}
        <div className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 flex flex-col gap-3 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-2xl">💀</span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {boss.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {boss.element.toUpperCase()}
              </span>
              {turn > 10 && (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-black uppercase bg-red-600/30 text-red-400 border border-red-500 animate-pulse">
                  🔥 ENRAGED (+300% DMG)
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs sm:text-sm font-bold">
              <span className="text-slate-400">
                Turn <strong className="text-amber-400">{Math.min(10, turn)}</strong> / 10
              </span>
              <span className="text-rose-400 font-mono text-base">
                {currentBossHp.toLocaleString()} / {boss.totalHp.toLocaleString()} ({hpPercent}%)
              </span>
            </div>
          </div>

          {/* Full-width Raid Health Bar */}
          <div className="h-5 w-full bg-slate-950 rounded-full border border-slate-700/80 p-0.5 overflow-hidden shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                hpPercent > 50
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400'
                  : hpPercent > 20
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                  : 'bg-gradient-to-r from-rose-600 to-red-500 animate-pulse'
              }`}
              style={{ width: `${Math.max(1, hpPercent)}%` }}
            />
          </div>
        </div>

        {/* Center Stage & Right Panel Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start">
          {/* Left 2 Cols: Center Stage with Boss Card & Player Units */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Center Stage: Boss Card with Elemental Aura */}
            <div className="h-64 sm:h-72 rounded-3xl bg-gradient-to-b from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/30 p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-[0_0_60px_rgba(147,51,234,0.15)]">
              {/* Dynamic Aura */}
              <div className="absolute inset-0 bg-radial-gradient from-purple-500/10 via-transparent to-transparent animate-pulse pointer-events-none" />

              {/* Floating Combat Damage Numbers */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {floatingTexts.map((ft) => (
                  <div
                    key={ft.id}
                    className="absolute text-2xl sm:text-3xl font-black animate-bounce"
                    style={{
                      color: ft.color,
                      textShadow: `0 0 16px ${ft.color}`,
                      transform: 'translateY(-20px)',
                    }}
                  >
                    {ft.text}
                  </div>
                ))}
              </div>

              {/* Boss Visual Entity */}
              <div className="relative z-10 flex flex-col items-center text-center gap-3">
                <div className="w-24 h-24 rounded-3xl bg-slate-900 border-2 border-purple-500/60 shadow-[0_0_30px_rgba(168,85,247,0.4)] flex items-center justify-center text-5xl">
                  🐙
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                    {boss.name}
                  </h3>
                  <p className="text-xs text-purple-300 font-bold uppercase tracking-wider mt-0.5">
                    Ancient World Threat • {boss.element.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Stage: Player Lineup Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {cards.map((card, idx) => {
                const isActive = idx === activeCardIdx && !isBattleOver;
                const isFainted = !card.isAlive || card.currentHp <= 0;
                const hpPct = Math.round((card.currentHp / card.maxHp) * 100);
                const manaPct = Math.round((card.currentMana / card.maxMana) * 100);

                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      if (!isFainted && !isBattleOver) setActiveCardIdx(idx);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col gap-2.5 ${
                      isFainted
                        ? 'bg-slate-950/60 border-slate-800/60 opacity-50 grayscale'
                        : isActive
                        ? 'bg-indigo-950/40 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.3)] scale-[1.02]'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute top-2 right-2 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 animate-pulse">
                        Active Turn
                      </span>
                    )}

                    <div>
                      <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                        {card.role}
                      </div>
                      <div className="text-sm font-bold text-white truncate">
                        {card.name}
                      </div>
                    </div>

                    {/* Card HP Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>HP</span>
                        <span className="text-slate-200">
                          {card.currentHp} / {card.maxHp}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            hpPct > 50 ? 'bg-emerald-500' : hpPct > 20 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.max(0, hpPct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Card MP Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>MP</span>
                        <span className="text-cyan-300">
                          {card.currentMana} / {card.maxMana}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 rounded-full transition-all"
                          style={{ width: `${Math.max(0, manaPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Bar / Skill Activation Buttons */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Actor:</span>
                <span className="text-sm font-black text-cyan-400">
                  {activeCard?.name || 'Unit'} [{activeCard?.role?.toUpperCase()}]
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleExecutePlayerAction('BASIC_ATTACK')}
                  disabled={isBattleOver || isAutoBattle}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs sm:text-sm font-bold text-white border border-slate-700 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <span>🗡️</span> Strike (+15 MP)
                </button>

                <button
                  onClick={() => handleExecutePlayerAction('ELEMENTAL_BURST')}
                  disabled={isBattleOver || isAutoBattle || activeCard.currentMana < 30}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs sm:text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <span>💥</span> Burst (30 MP)
                </button>

                <button
                  onClick={() => handleExecutePlayerAction('ULTIMATE')}
                  disabled={isBattleOver || isAutoBattle || activeCard.currentMana < 70}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:scale-105 disabled:opacity-50 text-xs sm:text-sm font-black text-white shadow-lg shadow-rose-500/25 transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <span>⚡</span> ULTIMATE (70 MP)
                </button>

                <button
                  onClick={() => setIsAutoBattle((prev) => !prev)}
                  disabled={isBattleOver}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all border ${
                    isAutoBattle
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  🤖 Auto-Battle: {isAutoBattle ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Live Cumulative Damage Tally & Combat Log Stream */}
          <div className="flex flex-col gap-4 w-full">
            {/* Live Total Damage Tally Card */}
            <div className="rounded-3xl bg-gradient-to-b from-rose-950/60 to-slate-900 border border-rose-500/40 p-6 flex flex-col gap-2 shadow-[0_0_35px_rgba(244,63,94,0.15)] text-center">
              <span className="text-xs uppercase font-black tracking-widest text-rose-400">
                Your Cumulative Damage
              </span>
              <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight animate-pulse">
                {cumulativeDamage.toLocaleString()}
              </div>
              <span className="text-xs text-slate-400">
                Contributed to World Boss in this run
              </span>
            </div>

            {/* Combat Log Stream */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col gap-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span>📜</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Raid Combat Log
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Real-time</span>
              </div>

              <div className="h-64 sm:h-80 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
                {combatLogs.map((log, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-300 leading-relaxed"
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Raid Summary Modal Overlay */}
        {raidSummary && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-slate-700 p-6 sm:p-8 flex flex-col gap-5 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
              <div className="text-5xl">
                {raidSummary.bossDefeated ? '🏆' : '💀'}
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">
                  {raidSummary.bossDefeated ? 'World Boss Slain!' : 'Raid Run Concluded'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {raidSummary.teamFainted
                    ? 'Your team bravely succumbed to the titan\'s onslaught.'
                    : 'Your team survived all 10 turns of battle!'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-left">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Damage Contributed:</span>
                  <span className="font-black text-rose-400 text-sm">
                    {raidSummary.totalDamageDealt.toLocaleString()} DMG
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Turns Survived:</span>
                  <span className="font-bold text-slate-200">
                    {raidSummary.turnsReached} / 10 Turns
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Crystal Bounty Awarded:</span>
                  <span className="font-black text-emerald-400 text-sm">
                    +💎 {raidSummary.rewardAwarded} Crystals
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Boss Remaining HP:</span>
                  <span className="font-bold text-slate-300">
                    {raidSummary.bossRemainingHp.toLocaleString()} HP
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={`/boss${userId ? `?as=${userId}` : ''}`}
                  className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white transition-all text-center"
                >
                  View Raid Rankings
                </Link>
                <Link
                  href={`/collection${userId ? `?as=${userId}` : ''}`}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-sm text-slate-200 transition-all text-center"
                >
                  My Collection
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
