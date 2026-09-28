'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { PackOpeningModal } from '../../components/PackOpeningModal';
import { getDevSessionFromQuery, getClientSessionCookie } from '../../lib/auth-session';
import { BoosterPackType, BoosterPackConfig, GeneratedCard } from '@cjverse/game-logic';

function ShopContent() {
  const searchParams = useSearchParams();
  const asParam = searchParams.get('as');

  const [isLoading, setIsLoading] = useState(true);
  const [packs, setPacks] = useState<BoosterPackConfig[]>([]);
  const [userCrystals, setUserCrystals] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pack opening modal state
  const [isOpeningPack, setIsOpeningPack] = useState(false);
  const [activePackType, setActivePackType] = useState<BoosterPackType>('standard');
  const [pulledCards, setPulledCards] = useState<GeneratedCard[]>([]);
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);

  // Authenticate user check
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

  // Load packs and crystal balance
  const fetchShopData = async () => {
    try {
      setErrorMessage(null);
      const query = asParam ? `?as=${encodeURIComponent(asParam)}` : '';
      const res = await fetch(`/api/packs${query}`);

      if (!res.ok) {
        throw new Error('Failed to load booster pack shop data');
      }

      const data = await res.json();
      if (data.packs) {
        setPacks(data.packs);
      }
      if (data.userCrystals !== undefined) {
        setUserCrystals(data.userCrystals);
      }
    } catch (err) {
      console.error('[Shop] Failed to load data:', err);
      setErrorMessage('Could not load shop packs. Please try refreshing.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShopData();
  }, [asParam]);

  // Handle purchasing and opening a pack
  const handleOpenPack = async (packType: BoosterPackType) => {
    if (isOpeningPack) return;
    setIsOpeningPack(true);
    setErrorMessage(null);
    setActivePackType(packType);

    try {
      const query = asParam ? `?as=${encodeURIComponent(asParam)}` : '';
      const res = await fetch(`/api/packs/open${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packType }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to purchase booster pack.');
        return;
      }

      setPulledCards(data.cards || []);
      if (data.remainingCrystals !== undefined) {
        setUserCrystals(data.remainingCrystals);
      }

      // Open the interactive modal scene
      setIsOpeningModalOpen(true);
    } catch (err) {
      console.error('[Shop] Error purchasing pack:', err);
      setErrorMessage('Network error while opening booster pack.');
    } finally {
      setIsOpeningPack(false);
    }
  };

  const activePackConfig =
    packs.find((p) => p.id === activePackType) || { cost: 150 };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 border border-slate-800/80 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black tracking-wider uppercase mb-3">
                <span className="animate-spin text-sm">🏪</span>
                <span>Booster Pack Emporium</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                Crack Booster <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">Packs</span>
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-xl">
                Infuse Crystals to summon legendary cards, discover rare elementals, and bolster your 3v3 Arena squad with high-tier variants.
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

        {/* Non-authenticated prompt */}
        {!userId && !isLoading && (
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-indigo-500/30 text-center space-y-4">
            <div className="text-4xl">🔐</div>
            <h2 className="text-xl font-bold text-white">Login Required</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Sign in with Discord to access your Crystal vault and buy booster packs.
            </p>
            <div>
              <a
                href="/api/auth/discord/login?returnTo=/shop"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-[#5865F2]/25"
              >
                <span>Login with Discord</span>
              </a>
            </div>
          </div>
        )}

        {/* Booster Packs Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span>Available Booster Packs</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                3 Editions
              </span>
            </h2>
            <span className="text-xs font-bold text-slate-400">
              Immediate Web Reveal & Collection Sync
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {isLoading ? (
              [1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="rounded-3xl bg-slate-900/40 border border-slate-800 p-8 h-96 animate-pulse"
                />
              ))
            ) : (
              packs.map((pack) => {
                const canAfford = userCrystals >= pack.cost;
                const isPackOpening = isOpeningPack && activePackType === pack.id;

                const borderGlow =
                  pack.id === 'ascendant'
                    ? 'border-amber-500/40 hover:border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.15)]'
                    : pack.id === 'elemental'
                    ? 'border-purple-500/40 hover:border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.15)]'
                    : 'border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.15)]';

                return (
                  <div
                    key={pack.id}
                    id={`shop-pack-${pack.id}`}
                    className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 border-2 ${borderGlow} backdrop-blur-xl group hover:scale-[1.02]`}
                  >
                    <div>
                      {/* Top Header Badge & Cost */}
                      <div className="flex items-center justify-between mb-6">
                        <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300">
                          {pack.badge}
                        </span>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs font-black text-amber-300">
                          <span>💎</span>
                          <span>{pack.cost}</span>
                        </div>
                      </div>

                      {/* 3D Foil Thumbnail Emblem */}
                      <div className="w-full flex justify-center my-4">
                        <div
                          className={`w-32 h-44 rounded-2xl p-1 bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900 border-2 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2 ${
                            pack.id === 'ascendant'
                              ? 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.3)]'
                              : pack.id === 'elemental'
                              ? 'border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.3)]'
                              : 'border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.3)]'
                          }`}
                        >
                          <div className="w-full h-full rounded-xl bg-slate-950 flex flex-col items-center justify-between p-3 border border-slate-800/80">
                            <span className="text-[9px] font-black uppercase text-slate-500">
                              {pack.cardCount} Cards
                            </span>
                            <div className="text-4xl">
                              {pack.id === 'ascendant'
                                ? '👑'
                                : pack.id === 'elemental'
                                ? '🔮'
                                : '⚡'}
                            </div>
                            <span className="text-[10px] font-black text-amber-400">
                              💎 {pack.cost}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pack Title & Description */}
                      <h3 className="text-xl font-black text-white mt-4 group-hover:text-cyan-300 transition-colors">
                        {pack.name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                        {pack.description}
                      </p>

                      {/* Drop Rate Highlights */}
                      <div className="mt-4 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-left space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Rarity Guarantee
                        </div>
                        <div className="text-xs font-bold text-slate-200">
                          {pack.guaranteedDescription}
                        </div>
                      </div>
                    </div>

                    {/* Buy & Open Button */}
                    <div className="mt-8 pt-4 border-t border-slate-800/80">
                      <button
                        type="button"
                        id={`buy-pack-btn-${pack.id}`}
                        disabled={!canAfford || isOpeningPack || !userId}
                        onClick={() => handleOpenPack(pack.id)}
                        className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                          canAfford && userId
                            ? pack.id === 'ascendant'
                              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 shadow-orange-500/25 border border-amber-300/50 cursor-pointer animate-pulse'
                              : pack.id === 'elemental'
                              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-purple-500/25 border border-purple-400/40 cursor-pointer'
                              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/25 border border-cyan-400/40 cursor-pointer'
                            : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isPackOpening ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            <span>Summoning Cards...</span>
                          </>
                        ) : !userId ? (
                          <span>Login to Purchase</span>
                        ) : canAfford ? (
                          <>
                            <span>⚡</span>
                            <span>Open Pack ({pack.cost} 💎)</span>
                          </>
                        ) : (
                          <span>Need {(pack.cost - userCrystals).toLocaleString()} more 💎</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* Interactive Pack Opening Modal Scene */}
      <PackOpeningModal
        isOpen={isOpeningModalOpen}
        onClose={() => setIsOpeningModalOpen(false)}
        packType={activePackType}
        cards={pulledCards}
        cost={activePackConfig.cost}
        userCrystals={userCrystals}
        onOpenAnother={() => handleOpenPack(activePackType)}
        isOpeningAnother={isOpeningPack}
      />
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <div className="animate-spin text-3xl">🏪</div>
        </div>
      }
    >
      <ShopContent />
    </Suspense>
  );
}
