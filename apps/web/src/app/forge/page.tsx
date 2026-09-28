'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { SoundEngine } from '../../lib/sound-engine';
import { getDevSessionFromQuery, getClientSessionCookie } from '../../lib/auth-session';
import {
  SALVAGE_VALUES,
  calculateSalvageYield,
  FUSION_TIER_UPGRADES,
  Variant,
} from '@cjverse/game-logic';

interface UserCard {
  id: string;
  race: string;
  variant: string;
  element: string;
  elementTier: string;
  evolutionStage: number;
  level: number;
  powerScore: number;
  seed: number;
}

interface UserLineup {
  vanguardCardId: string | null;
  strikerCardId: string | null;
  conduitCardId: string | null;
}

const VARIANT_COLORS: Record<
  string,
  {
    border: string;
    glow: string;
    badgeBg: string;
    badgeText: string;
    foilOverlay: string;
  }
> = {
  normal: {
    border: 'border-slate-700 hover:border-slate-500',
    glow: 'shadow-[0_0_15px_rgba(100,116,139,0.2)]',
    badgeBg: 'bg-slate-800 text-slate-300 border-slate-600',
    badgeText: 'text-slate-300',
    foilOverlay: 'from-slate-400/5 to-slate-200/10',
  },
  silver: {
    border: 'border-slate-300/80 hover:border-slate-100',
    glow: 'shadow-[0_0_20px_rgba(226,232,240,0.35)]',
    badgeBg: 'bg-slate-700 text-slate-100 border-slate-300',
    badgeText: 'text-slate-100',
    foilOverlay: 'from-slate-200/20 via-white/10 to-slate-400/20',
  },
  gold: {
    border: 'border-amber-400 hover:border-amber-200',
    glow: 'shadow-[0_0_25px_rgba(251,191,36,0.45)]',
    badgeBg: 'bg-amber-950 text-amber-300 border-amber-500',
    badgeText: 'text-amber-400',
    foilOverlay: 'from-amber-400/25 via-yellow-200/15 to-amber-600/25',
  },
  diamond: {
    border: 'border-cyan-400 hover:border-cyan-200',
    glow: 'shadow-[0_0_30px_rgba(34,211,238,0.5)]',
    badgeBg: 'bg-cyan-950 text-cyan-300 border-cyan-400',
    badgeText: 'text-cyan-300',
    foilOverlay: 'from-cyan-400/30 via-sky-200/20 to-blue-500/30',
  },
  rainbow: {
    border: 'border-fuchsia-400 hover:border-pink-300',
    glow: 'shadow-[0_0_35px_rgba(244,114,182,0.6)]',
    badgeBg: 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-400',
    badgeText: 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-300 via-green-300 via-cyan-400 to-fuchsia-400 font-black',
    foilOverlay: 'from-red-500/20 via-green-400/20 via-cyan-400/20 to-fuchsia-500/20',
  },
};

const ELEMENT_ICONS: Record<string, string> = {
  fire: '🔥',
  ice: '❄️',
  water: '💧',
  lightning: '⚡',
  earth: '🌿',
  arcane: '🔮',
  shadow: '🌑',
  void: '🌌',
  blood: '🩸',
  light: '✨',
  time: '⏳',
  cosmic: '🌠',
  chaos: '💥',
};

function ForgeContent() {
  const searchParams = useSearchParams();
  const asParam = searchParams.get('as') || searchParams.get('userId');

  const [activeTab, setActiveTab] = useState<'fuse' | 'salvage'>('fuse');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('Duels Master');
  const [arcaneDust, setArcaneDust] = useState<number>(0);
  const [crystals, setCrystals] = useState<number>(0);
  const [cards, setCards] = useState<UserCard[]>([]);
  const [lineup, setLineup] = useState<UserLineup>({
    vanguardCardId: null,
    strikerCardId: null,
    conduitCardId: null,
  });

  // Fusion Altar Slots (exact 3 slots)
  const [altarSlots, setAltarSlots] = useState<(UserCard | null)[]>([null, null, null]);
  const [isSlottingPedestalIdx, setIsSlottingPedestalIdx] = useState<number | null>(null);
  const [isFusing, setIsFusing] = useState(false);
  const [fusedCardResult, setFusedCardResult] = useState<UserCard | null>(null);

  // Salvage Multi-Selection
  const [selectedSalvageIds, setSelectedSalvageIds] = useState<Set<string>>(new Set());
  const [salvageFilterRarity, setSalvageFilterRarity] = useState<string>('all');
  const [isDismantling, setIsDismantling] = useState(false);
  const [showSalvageConfirm, setShowSalvageConfirm] = useState(false);

  const soundEngine = SoundEngine.getInstance();

  const handleSoundUnlock = () => {
    soundEngine.ensureContext();
  };

  // Equipped card ID set
  const equippedCardIds = useMemo(() => {
    return new Set(
      [lineup.vanguardCardId, lineup.strikerCardId, lineup.conduitCardId].filter(
        Boolean
      ) as string[]
    );
  }, [lineup]);

  // Load user data & collection
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      let effectiveUserId: string | null = null;
      if (asParam) {
        const dev = getDevSessionFromQuery(asParam);
        if (dev?.isValid && dev.userId) {
          effectiveUserId = dev.userId;
        }
      }

      if (!effectiveUserId) {
        const cookie = getClientSessionCookie();
        if (cookie?.isValid && cookie.userId) {
          effectiveUserId = cookie.userId;
        }
      }

      setUserId(effectiveUserId);

      const asQuery = effectiveUserId ? `?as=${effectiveUserId}` : '';
      const [colRes, forgeRes] = await Promise.all([
        fetch(`/api/user/collection${asQuery}`),
        fetch(`/api/forge${asQuery}`),
      ]);

      if (!colRes.ok) {
        throw new Error('Failed to load card collection');
      }

      const colData = await colRes.json();
      setCards(colData.cards || []);
      setLineup(colData.lineup || { vanguardCardId: null, strikerCardId: null, conduitCardId: null });

      if (colData.user) {
        setUsername(colData.user.username);
        setCrystals(colData.user.crystals || 0);
        setArcaneDust(colData.user.arcaneDust || 0);
      }

      if (forgeRes.ok) {
        const forgeData = await forgeRes.json();
        if (forgeData.authenticated) {
          setArcaneDust(forgeData.arcaneDust || 0);
          setCrystals(forgeData.crystals || 0);
        }
      }
    } catch (err: any) {
      console.error('[Forge Load Error]:', err);
      setError(err.message || 'Failed to load forge data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [asParam]);

  // Available cards for fusion / salvage (not equipped)
  const unequippedCards = useMemo(() => {
    return cards.filter((c) => !equippedCardIds.has(c.id));
  }, [cards, equippedCardIds]);

  // Fusion: First slotted variant restricts other pedestals
  const requiredFusionVariant = useMemo(() => {
    const firstSlotted = altarSlots.find((c) => c !== null);
    return firstSlotted ? firstSlotted.variant.toLowerCase() : null;
  }, [altarSlots]);

  // Target variant from fusion
  const nextFusionTier = useMemo(() => {
    if (!requiredFusionVariant) return null;
    return FUSION_TIER_UPGRADES[requiredFusionVariant] || null;
  }, [requiredFusionVariant]);

  // Check if all 3 pedestals are filled with matching cards
  const canSynthesize = useMemo(() => {
    if (altarSlots.some((s) => s === null)) return false;
    const v0 = altarSlots[0]?.variant.toLowerCase();
    const v1 = altarSlots[1]?.variant.toLowerCase();
    const v2 = altarSlots[2]?.variant.toLowerCase();
    return v0 === v1 && v1 === v2 && Boolean(FUSION_TIER_UPGRADES[v0 || '']);
  }, [altarSlots]);

  // Slotted card IDs
  const slottedIds = useMemo(() => {
    return new Set(altarSlots.filter((c): c is UserCard => c !== null).map((c) => c.id));
  }, [altarSlots]);

  // Drawer cards for pedestal slotting
  const drawerEligibleCards = useMemo(() => {
    return unequippedCards.filter((c) => {
      if (slottedIds.has(c.id)) return false;
      if (requiredFusionVariant && c.variant.toLowerCase() !== requiredFusionVariant) {
        return false;
      }
      // Cannot fuse Diamond or higher
      if (!FUSION_TIER_UPGRADES[c.variant.toLowerCase()]) {
        return false;
      }
      return true;
    });
  }, [unequippedCards, slottedIds, requiredFusionVariant]);

  // Handle Slotting Card
  const handleSlotCard = (card: UserCard) => {
    handleSoundUnlock();
    if (isSlottingPedestalIdx === null) return;

    soundEngine.playCardFlip();
    const newSlots = [...altarSlots];
    newSlots[isSlottingPedestalIdx] = card;
    setAltarSlots(newSlots);
    setIsSlottingPedestalIdx(null);
  };

  // Handle Unslotting Card
  const handleUnslotCard = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    handleSoundUnlock();
    soundEngine.playCardFlip();
    const newSlots = [...altarSlots];
    newSlots[idx] = null;
    setAltarSlots(newSlots);
  };

  // Execute Fusion
  const handleExecuteFusion = async () => {
    if (!canSynthesize || isFusing) return;
    handleSoundUnlock();
    setIsFusing(true);
    soundEngine.playUltimate();

    try {
      const cardIds = altarSlots.map((c) => c!.id);
      const asQuery = userId ? `?as=${userId}` : '';
      const res = await fetch(`/api/forge/fuse${asQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIds }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fusion failed');
      }

      const result = await res.json();
      soundEngine.playVictory();
      setFusedCardResult(result.fusedCard);
      setAltarSlots([null, null, null]);
      await loadData();
    } catch (err: any) {
      soundEngine.playDefeat();
      alert(`Fusion Failed: ${err.message}`);
    } finally {
      setIsFusing(false);
    }
  };

  // Salvage Selection Calculations
  const selectedSalvageCards = useMemo(() => {
    return unequippedCards.filter((c) => selectedSalvageIds.has(c.id));
  }, [unequippedCards, selectedSalvageIds]);

  const salvageYield = useMemo(() => {
    return calculateSalvageYield(selectedSalvageCards);
  }, [selectedSalvageCards]);

  // Toggle single card in salvage view
  const toggleSalvageCard = (cardId: string) => {
    handleSoundUnlock();
    setSelectedSalvageIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  // Quick Select by Rarity
  const selectAllByRarity = (rarity: string) => {
    handleSoundUnlock();
    const matching = unequippedCards.filter((c) => c.variant.toLowerCase() === rarity.toLowerCase());
    setSelectedSalvageIds((prev) => {
      const next = new Set(prev);
      matching.forEach((c) => next.add(c.id));
      return next;
    });
  };

  // Clear Selection
  const clearSalvageSelection = () => {
    setSelectedSalvageIds(new Set());
  };

  // Execute Batch Dismantle
  const handleExecuteSalvage = async () => {
    if (selectedSalvageIds.size === 0 || isDismantling) return;
    handleSoundUnlock();
    setIsDismantling(true);
    soundEngine.playBurst();

    try {
      const cardIds = Array.from(selectedSalvageIds);
      const asQuery = userId ? `?as=${userId}` : '';
      const res = await fetch(`/api/forge/salvage${asQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIds }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to dismantle cards');
      }

      const result = await res.json();
      soundEngine.playVictory();
      setShowSalvageConfirm(false);
      setSelectedSalvageIds(new Set());
      await loadData();
    } catch (err: any) {
      soundEngine.playDefeat();
      alert(`Dismantle Failed: ${err.message}`);
    } finally {
      setIsDismantling(false);
    }
  };

  // Filtered unequipped cards for Disenchant Grid
  const filteredSalvageCards = useMemo(() => {
    if (salvageFilterRarity === 'all') return unequippedCards;
    return unequippedCards.filter((c) => c.variant.toLowerCase() === salvageFilterRarity.toLowerCase());
  }, [unequippedCards, salvageFilterRarity]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-slate-400 animate-pulse text-sm">
          Awakening the Arcane Forge...
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-950 text-white flex flex-col ${isFusing ? 'animate-pulse' : ''}`}>
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Header & Balance Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-500/20 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-purple-500/25 flex items-center justify-center text-3xl">
              ⚒️
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Arcane Forge
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                  Synthesizer & Crucible
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Fuse identical cards into higher tiers or dismantle unwanted units for Arcane Dust & Crystals.
              </p>
            </div>
          </div>

          {/* User Essence Balances */}
          <div className="flex items-center gap-4 bg-slate-950/80 px-5 py-3 rounded-xl border border-slate-800 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔮</span>
              <div>
                <div className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Arcane Dust</div>
                <div className="text-sm font-black text-white">{arcaneDust.toLocaleString()}</div>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="flex items-center gap-2">
              <span className="text-xl">💎</span>
              <div>
                <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Crystals</div>
                <div className="text-sm font-black text-white">{crystals.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => {
              handleSoundUnlock();
              setActiveTab('fuse');
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'fuse'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <span>⚗️</span>
            <span>The Altar of Fusion</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleSoundUnlock();
              setActiveTab('salvage');
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'salvage'
                ? 'bg-amber-600/30 text-amber-200 border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <span>🔥</span>
            <span>Disenchant / Salvage</span>
            {selectedSalvageIds.size > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black">
                {selectedSalvageIds.size}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: THE ALTAR OF FUSION */}
        {activeTab === 'fuse' && (
          <div className="flex flex-col items-center gap-8 py-6">
            <div className="text-center max-w-xl">
              <h2 className="text-lg font-black text-white">Three-Fold Crucible Synthesis</h2>
              <p className="text-xs text-slate-400 mt-1">
                Select 3 cards of the exact same variant tier. The crucible synthesizes them into the next rarity tier with a{' '}
                <span className="text-amber-400 font-bold">+10% Power Score bonus</span> and inherited elemental dominance!
              </p>
            </div>

            {/* 3 Pedestals + Center Crucible */}
            <div className="relative w-full max-w-4xl py-6 flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-10">
              {/* Connecting Runic Ring */}
              <div
                className={`absolute inset-0 m-auto w-72 h-72 sm:w-96 sm:h-96 rounded-full border-2 border-dashed ${
                  canSynthesize
                    ? 'border-purple-400 animate-spin shadow-[0_0_50px_rgba(192,132,252,0.4)]'
                    : 'border-slate-800'
                } pointer-events-none transition-all duration-700`}
                style={{ animationDuration: '30s' }}
              />

              {/* Pedestals 1, 2, 3 */}
              {[0, 1, 2].map((idx) => {
                const slotted = altarSlots[idx];
                const variantKey = slotted?.variant.toLowerCase() || 'normal';
                const style = VARIANT_COLORS[variantKey] || VARIANT_COLORS.normal;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      handleSoundUnlock();
                      setIsSlottingPedestalIdx(idx);
                    }}
                    className={`relative z-10 w-60 h-80 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 border-2 ${
                      slotted
                        ? `${style.border} ${style.glow} bg-slate-900/90`
                        : 'border-purple-500/30 hover:border-purple-400 bg-slate-950/80 hover:bg-purple-950/20 border-dashed'
                    }`}
                  >
                    {slotted ? (
                      <div className="relative w-full h-full p-4 flex flex-col justify-between">
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={(e) => handleUnslotCard(idx, e)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-950/80 text-red-400 hover:bg-red-900 border border-red-500/50 flex items-center justify-center text-xs font-black z-20 transition-all"
                        >
                          ✕
                        </button>

                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-md border ${style.badgeBg}`}>
                            {slotted.variant}
                          </span>
                          <span className="text-sm">
                            {ELEMENT_ICONS[slotted.element.toLowerCase()] || '✨'}
                          </span>
                        </div>

                        <div className="my-auto text-center">
                          <div className="text-4xl my-2">🎴</div>
                          <div className="text-sm font-black text-white tracking-wide uppercase">
                            {slotted.variant} {slotted.race}
                          </div>
                          <div className="text-[11px] text-slate-400">#{slotted.id}</div>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="text-slate-400">Power:</span>
                          <span className="font-bold text-amber-400">⚡ {slotted.powerScore}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 p-4 text-center">
                        <div className="w-14 h-14 rounded-full bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-2xl text-purple-300 shadow-inner group-hover:scale-110 transition-transform">
                          +
                        </div>
                        <div>
                          <div className="text-xs font-black text-purple-300 uppercase tracking-wider">
                            Pedestal {idx + 1}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {requiredFusionVariant ? `Slot ${requiredFusionVariant} card` : 'Click to slot offering'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Synthesize Button */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                id="synthesize-button"
                disabled={!canSynthesize || isFusing}
                onClick={handleExecuteFusion}
                className={`relative px-10 py-4 rounded-2xl font-black text-base uppercase tracking-wider transition-all duration-300 ${
                  canSynthesize
                    ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 text-white shadow-[0_0_35px_rgba(168,85,247,0.5)] hover:scale-105 active:scale-95 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                }`}
              >
                {isFusing ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">🌀</span> Synthesizing Artifact...
                  </span>
                ) : canSynthesize ? (
                  `⚡ Synthesize ${nextFusionTier?.toUpperCase() || ''} Card`
                ) : (
                  'Slot 3 Identical Cards'
                )}
              </button>

              {nextFusionTier && (
                <div className="text-xs text-purple-300 font-bold animate-pulse">
                  🔮 Resulting Tier: {nextFusionTier.toUpperCase()} (+10% Power Bonus)
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DISENCHANT / SALVAGE */}
        {activeTab === 'salvage' && (
          <div className="flex flex-col gap-6 py-4">
            {/* Filter and Quick Selection Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Filter Rarity:</span>
                {['all', 'normal', 'silver', 'gold', 'diamond'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      handleSoundUnlock();
                      setSalvageFilterRarity(r);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                      salvageFilterRarity === r
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectAllByRarity('normal')}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700"
                >
                  Select All Normal
                </button>
                <button
                  type="button"
                  onClick={() => selectAllByRarity('silver')}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700"
                >
                  Select All Silver
                </button>
                {selectedSalvageIds.size > 0 && (
                  <button
                    type="button"
                    onClick={clearSalvageSelection}
                    className="px-3 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 text-xs font-bold text-red-300 border border-red-500/40"
                  >
                    Clear ({selectedSalvageIds.size})
                  </button>
                )}
              </div>
            </div>

            {/* Grid of Unequipped Cards */}
            {filteredSalvageCards.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                No unequipped cards found matching this filter.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredSalvageCards.map((card) => {
                  const isSelected = selectedSalvageIds.has(card.id);
                  const variantKey = card.variant.toLowerCase();
                  const style = VARIANT_COLORS[variantKey] || VARIANT_COLORS.normal;
                  const salvageVal = SALVAGE_VALUES[variantKey as Variant] || SALVAGE_VALUES.normal;

                  return (
                    <div
                      key={card.id}
                      onClick={() => toggleSalvageCard(card.id)}
                      className={`relative rounded-xl p-3 flex flex-col justify-between cursor-pointer border-2 transition-all duration-200 select-none ${
                        isSelected
                          ? 'border-amber-400 bg-amber-950/30 shadow-[0_0_20px_rgba(245,158,11,0.3)] scale-[1.02]'
                          : `${style.border} bg-slate-900/60 hover:bg-slate-800/80`
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${style.badgeBg}`}>
                          {card.variant}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs font-black transition-all ${
                            isSelected
                              ? 'bg-amber-500 border-amber-400 text-slate-950'
                              : 'border-slate-600 bg-slate-800'
                          }`}
                        >
                          {isSelected && '✓'}
                        </div>
                      </div>

                      <div className="my-3 text-center">
                        <div className="text-3xl my-1">
                          {ELEMENT_ICONS[card.element.toLowerCase()] || '🎴'}
                        </div>
                        <div className="text-xs font-black text-white uppercase tracking-wider">
                          {card.variant} {card.race}
                        </div>
                        <div className="text-[10px] text-slate-400">#{card.id}</div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1 text-[11px]">
                        <div className="flex justify-between text-slate-400">
                          <span>Yield:</span>
                          <span className="text-purple-300 font-bold">
                            🔮 +{salvageVal.arcaneDust} | 💎 +{salvageVal.crystals}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Floating Bar */}
            {selectedSalvageIds.size > 0 && (
              <div className="sticky bottom-6 z-40 max-w-3xl w-full mx-auto p-4 rounded-2xl bg-slate-900/95 border border-amber-500/40 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">🔥</div>
                  <div>
                    <div className="text-sm font-black text-white">
                      {selectedSalvageIds.size} {selectedSalvageIds.size === 1 ? 'Card' : 'Cards'} Selected
                    </div>
                    <div className="text-xs text-amber-300 flex items-center gap-3">
                      <span>🔮 +{salvageYield.arcaneDust} Arcane Dust</span>
                      <span>💎 +{salvageYield.crystals} Crystals</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={clearSalvageSelection}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSalvageConfirm(true)}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/25"
                  >
                    Dismantle Selected
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* DRAWER / MODAL: SELECT CARD TO SLOT INTO ALTAR */}
      {isSlottingPedestalIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-purple-500/40 rounded-2xl p-6 flex flex-col max-h-[85vh] shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>⚗️</span> Select Card for Pedestal {isSlottingPedestalIdx + 1}
              </h3>
              <button
                type="button"
                onClick={() => setIsSlottingPedestalIdx(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div className="py-3 text-xs text-slate-400">
              {requiredFusionVariant
                ? `Only ${requiredFusionVariant.toUpperCase()} unequipped cards can be slotted to match offerings.`
                : 'Select any unequipped card (Normal, Silver, or Gold) to begin the ritual.'}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {drawerEligibleCards.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                  No eligible unequipped cards available.
                </div>
              ) : (
                drawerEligibleCards.map((card) => {
                  const variantKey = card.variant.toLowerCase();
                  const style = VARIANT_COLORS[variantKey] || VARIANT_COLORS.normal;

                  return (
                    <div
                      key={card.id}
                      onClick={() => handleSlotCard(card)}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 ${style.border} ${style.glow} bg-slate-950/80`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${style.badgeBg}`}>
                          {card.variant}
                        </span>
                        <span>{ELEMENT_ICONS[card.element.toLowerCase()] || '✨'}</span>
                      </div>
                      <div className="text-center my-2">
                        <div className="text-2xl">🎴</div>
                        <div className="text-xs font-black text-white truncate mt-1">
                          {card.variant} {card.race}
                        </div>
                        <div className="text-[10px] text-slate-400">#{card.id}</div>
                      </div>
                      <div className="text-[10px] text-right font-bold text-amber-400">
                        ⚡ {card.powerScore}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DISMANTLE SELECTED */}
      {showSalvageConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
            <div className="text-3xl text-center">🔥</div>
            <h3 className="text-lg font-black text-white text-center">Confirm Disenchantment</h3>
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Are you sure you want to permanently dismantle{' '}
              <span className="text-white font-bold">{selectedSalvageIds.size} cards</span>? This action is irreversible
              and dissolves the cards into raw essence.
            </p>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-around text-center">
              <div>
                <div className="text-xs text-slate-500 font-bold">Arcane Dust</div>
                <div className="text-base font-black text-purple-400">+{salvageYield.arcaneDust}</div>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <div className="text-xs text-slate-500 font-bold">Crystals</div>
                <div className="text-base font-black text-cyan-400">+{salvageYield.crystals}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDismantling}
                onClick={() => setShowSalvageConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDismantling}
                onClick={handleExecuteSalvage}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-red-500/25"
              >
                {isDismantling ? 'Dismantling...' : 'Confirm Dismantle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FUSED CARD REVEAL */}
      {fusedCardResult && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-gradient-to-b from-slate-900 via-slate-950 to-purple-950/80 border-2 border-amber-400 rounded-3xl p-6 flex flex-col items-center text-center gap-4 shadow-[0_0_50px_rgba(251,191,36,0.5)] animate-bounce-short">
            <div className="text-xs uppercase font-black tracking-widest text-amber-300 bg-amber-950/80 px-4 py-1 rounded-full border border-amber-500/50">
              ⚡ Arcane Synthesis Successful!
            </div>

            <div className="relative w-48 h-64 rounded-2xl bg-slate-900 border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.3)] p-4 flex flex-col justify-between my-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-amber-300 uppercase">{fusedCardResult.variant}</span>
                <span>{ELEMENT_ICONS[fusedCardResult.element.toLowerCase()] || '✨'}</span>
              </div>

              <div className="my-auto">
                <div className="text-5xl my-2">🎴</div>
                <div className="text-base font-black text-white uppercase tracking-wider">
                  {fusedCardResult.variant} {fusedCardResult.race}
                </div>
                <div className="text-xs text-slate-400">#{fusedCardResult.id}</div>
              </div>

              <div className="text-xs font-black text-amber-400 bg-amber-950/60 py-1 rounded-lg border border-amber-500/30">
                ⚡ Power: {fusedCardResult.powerScore}
              </div>
            </div>

            <div className="text-xs text-purple-200">
              Inherited Dominant Element: <span className="font-bold uppercase text-white">{fusedCardResult.element}</span> (+10% Fusion Stat Bonus applied!)
            </div>

            <button
              type="button"
              onClick={() => setFusedCardResult(null)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/30"
            >
              Claim to Inventory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ForgePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          Loading Arcane Forge...
        </div>
      }
    >
      <ForgeContent />
    </Suspense>
  );
}
