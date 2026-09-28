'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BoosterPackType, BOOSTER_PACKS, GeneratedCard } from '@cjverse/game-logic';
import { SoundEngine } from '../lib/sound-engine';

export interface PackOpeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  packType: BoosterPackType;
  cards: GeneratedCard[];
  cost: number;
  userCrystals: number;
  onOpenAnother: () => void;
  isOpeningAnother?: boolean;
}

export function PackOpeningModal({
  isOpen,
  onClose,
  packType,
  cards,
  cost,
  userCrystals,
  onOpenAnother,
  isOpeningAnother = false,
}: PackOpeningModalProps) {
  const [stage, setStage] = useState<'sealed' | 'revealing' | 'summary'>('sealed');
  const [isTearing, setIsTearing] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  const packConfig = BOOSTER_PACKS[packType] || BOOSTER_PACKS.standard;

  // Reset state when modal opens or cards change
  useEffect(() => {
    if (isOpen) {
      setStage('sealed');
      setIsTearing(false);
      setFlippedCards({});
    }
  }, [isOpen, cards]);

  if (!isOpen) return null;

  const handleTearPack = () => {
    if (isTearing) return;
    setIsTearing(true);

    try {
      SoundEngine.getInstance().playPackTear();
    } catch {}

    setTimeout(() => {
      setIsTearing(false);
      setStage('revealing');
    }, 700);
  };

  const handleFlipCard = (cardId: string, variant: string) => {
    if (flippedCards[cardId]) return;

    setFlippedCards((prev) => ({ ...prev, [cardId]: true }));

    try {
      SoundEngine.getInstance().playCardFlip();
      if (['gold', 'diamond', 'rainbow'].includes(variant.toLowerCase())) {
        setTimeout(() => {
          try {
            SoundEngine.getInstance().playRareReveal();
          } catch {}
        }, 150);
      }
    } catch {}
  };

  const handleRevealAll = () => {
    const allRevealed: Record<string, boolean> = {};
    let hasRare = false;
    for (const card of cards) {
      allRevealed[card.id] = true;
      if (['gold', 'diamond', 'rainbow'].includes(card.variant.toLowerCase())) {
        hasRare = true;
      }
    }
    setFlippedCards(allRevealed);

    try {
      SoundEngine.getInstance().playCardFlip();
      if (hasRare) {
        setTimeout(() => {
          try {
            SoundEngine.getInstance().playRareReveal();
          } catch {}
        }, 150);
      }
    } catch {}
  };

  const allFlipped =
    cards.length > 0 && cards.every((c) => flippedCards[c.id]);

  const getRarityGlowClass = (variant: string) => {
    switch (variant.toLowerCase()) {
      case 'diamond':
      case 'rainbow':
        return 'border-fuchsia-400 shadow-[0_0_40px_rgba(217,70,239,0.7)] animate-pulse';
      case 'gold':
        return 'border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.65)] animate-pulse';
      case 'silver':
        return 'border-cyan-300 shadow-[0_0_30px_rgba(6,182,212,0.55)]';
      case 'normal':
      default:
        return 'border-slate-700 shadow-[0_0_20px_rgba(15,23,42,0.5)]';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-2xl animate-fadeIn">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="w-[600px] h-[600px] bg-gradient-to-r from-indigo-500/15 via-cyan-500/15 to-purple-500/15 rounded-full blur-[140px]" />
      </div>

      <div className="relative w-full max-w-5xl rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-10 shadow-2xl flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <span className="text-sm font-black text-white tracking-wider uppercase">
              {packConfig.name}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30">
              {cards.length} Cards
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ----------------- STAGE 1: THE SEALED PACK ----------------- */}
        {stage === 'sealed' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-8 animate-fadeIn">
            {/* 3D Booster Foil Pack */}
            <div
              id="sealed-booster-pack"
              onClick={handleTearPack}
              className={`group relative w-64 h-96 rounded-2xl cursor-pointer transition-all duration-500 transform hover:scale-105 hover:-rotate-1 select-none ${
                isTearing
                  ? 'scale-110 brightness-150 animate-ping'
                  : 'shadow-[0_0_50px_rgba(6,182,212,0.35)]'
              }`}
            >
              {/* Outer Foil Shimmer Texture */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 border-2 border-cyan-400/60 p-1 overflow-hidden">
                {/* Holographic Sheen overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/20 to-purple-400/25 opacity-70 group-hover:opacity-100 transition-opacity" />

                {/* Foil Pack Artwork Container */}
                <div className="w-full h-full rounded-xl bg-slate-950 flex flex-col items-center justify-between p-6 relative z-10 border border-slate-800">
                  {/* Top Seal Stamp */}
                  <div className="w-full text-center border-b border-cyan-500/30 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                      {packConfig.badge}
                    </span>
                  </div>

                  {/* Center Foil Emblem */}
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-rose-500 p-0.5 shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform">
                      <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-4xl">
                        {packType === 'ascendant'
                          ? '👑'
                          : packType === 'elemental'
                          ? '🔮'
                          : '⚡'}
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-white group-hover:text-cyan-300 transition-colors">
                      {packConfig.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 max-w-[180px] leading-tight">
                      {packConfig.guaranteedDescription}
                    </p>
                  </div>

                  {/* Bottom Tear Grip */}
                  <div className="w-full text-center border-t border-cyan-500/30 pt-2">
                    <span className="text-[11px] font-black text-amber-300">
                      💎 {packConfig.cost} Crystals
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Instruction Prompt */}
            <div className="flex flex-col items-center space-y-2">
              <button
                type="button"
                id="tear-pack-btn"
                onClick={handleTearPack}
                disabled={isTearing}
                className="px-8 py-3.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 active:scale-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-cyan-500/25 border border-cyan-400/40 flex items-center gap-2.5 transition-all animate-pulse"
              >
                <span>⚡</span>
                <span>Click to Tear Pack</span>
              </button>
              <span className="text-xs text-slate-400">
                Pucker the foil and crack open your cards!
              </span>
            </div>
          </div>
        )}

        {/* ----------------- STAGE 2: CARD FLIP REVEAL ----------------- */}
        {stage === 'revealing' && (
          <div className="py-8 w-full flex flex-col items-center space-y-8 animate-fadeIn">
            <div className="flex items-center justify-between w-full max-w-4xl px-2">
              <span className="text-xs font-bold text-slate-400">
                Tap each card to reveal its identity and rarity!
              </span>
              {!allFlipped && (
                <button
                  type="button"
                  id="reveal-all-btn"
                  onClick={handleRevealAll}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-400 hover:text-white rounded-xl border border-slate-700 transition-colors"
                >
                  Reveal All
                </button>
              )}
            </div>

            {/* Cards Showcase Grid */}
            <div className="flex flex-wrap items-center justify-center gap-6 max-w-4xl">
              {cards.map((card) => {
                const isFlipped = !!flippedCards[card.id];

                return (
                  <div
                    key={card.id}
                    id={`reveal-card-${card.id}`}
                    onClick={() => handleFlipCard(card.id, card.variant)}
                    style={{ perspective: '1000px' }}
                    className="w-48 h-72 cursor-pointer select-none group"
                  >
                    <div
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}
                      className="relative w-full h-full transition-transform duration-700"
                    >
                      {/* CARD BACK (Face-Down) */}
                      <div
                        style={{ backfaceVisibility: 'hidden' }}
                        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 border-2 border-indigo-500/50 p-3 flex flex-col items-center justify-between shadow-xl group-hover:scale-105 group-hover:border-cyan-400 transition-all"
                      >
                        <div className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">
                          CJVERSE
                        </div>

                        <div className="w-16 h-16 rounded-2xl bg-indigo-900/40 border border-indigo-400/40 flex items-center justify-center text-3xl shadow-inner group-hover:rotate-6 transition-transform">
                          🎴
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-cyan-400 tracking-wider animate-pulse">
                          <span>✨</span>
                          <span>Tap to Reveal</span>
                        </div>
                      </div>

                      {/* CARD FRONT (Face-Up) */}
                      <div
                        style={{
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                        }}
                        className={`absolute inset-0 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 p-3.5 flex flex-col justify-between transition-all ${getRarityGlowClass(
                          card.variant
                        )}`}
                      >
                        {/* Header: ID & Variant badge */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-black text-cyan-400 bg-slate-950/80 px-2 py-0.5 rounded-md border border-cyan-500/30">
                            {card.id.replace(/#/g, '')}
                          </span>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              card.variant === 'diamond'
                                ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40'
                                : card.variant === 'gold'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : card.variant === 'silver'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {card.variant}
                          </span>
                        </div>

                        {/* Creature & Element Art Spot */}
                        <div className="my-auto flex flex-col items-center space-y-2">
                          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700/80 flex items-center justify-center text-3xl shadow-inner">
                            {card.race === 'dragon'
                              ? '🐉'
                              : card.race === 'elf'
                              ? '🧝'
                              : card.race === 'dwarf'
                              ? '⚒️'
                              : card.race === 'orc'
                              ? '👹'
                              : '🧙'}
                          </div>
                          <div className="text-center">
                            <h4 className="text-sm font-black text-white capitalize">
                              {card.race}
                            </h4>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {card.element} ({card.elementTier})
                            </div>
                          </div>
                        </div>

                        {/* Footer: Level & Power score */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-400">
                            Lv.{card.level}
                          </span>
                          <span className="font-black text-amber-300 flex items-center gap-1">
                            <span>⚡</span>
                            <span>{card.powerScore}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 flex items-center gap-4">
              {allFlipped ? (
                <button
                  type="button"
                  id="view-summary-btn"
                  onClick={() => setStage('summary')}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all cursor-pointer animate-bounce"
                >
                  View Pack Summary 🎉
                </button>
              ) : (
                <span className="text-xs text-slate-400">
                  {Object.keys(flippedCards).length} of {cards.length} cards revealed
                </span>
              )}
            </div>
          </div>
        )}

        {/* ----------------- STAGE 3: SUMMARY ----------------- */}
        {stage === 'summary' && (
          <div className="py-6 w-full flex flex-col items-center space-y-8 animate-fadeIn">
            <div>
              <h3 className="text-2xl font-black text-white">
                Pack Cracking Complete! 🎉
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                All {cards.length} cards have been securely deposited into your vault.
              </p>
            </div>

            {/* Compact Mini Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-3xl">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 flex flex-col justify-between text-left space-y-2"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono font-bold text-cyan-400">
                      {card.id.replace(/#/g, '')}
                    </span>
                    <span className="font-bold text-slate-300 text-[10px] uppercase">
                      {card.variant}
                    </span>
                  </div>
                  <div>
                    <div className="font-black text-white text-sm capitalize">
                      {card.race}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {card.element} ({card.elementTier})
                    </div>
                  </div>
                  <div className="flex justify-between text-xs font-bold pt-1 border-t border-slate-800">
                    <span className="text-slate-500">Lv.{card.level}</span>
                    <span className="text-amber-300">⚡ {card.powerScore}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Link
                href="/collection"
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/25 transition-all"
              >
                Send to Collection 🎴
              </Link>

              <button
                type="button"
                id="open-another-btn"
                disabled={userCrystals < cost || isOpeningAnother}
                onClick={onOpenAnother}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50"
              >
                {isOpeningAnother
                  ? 'Opening...'
                  : `Open Another (${cost} 💎)`}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
