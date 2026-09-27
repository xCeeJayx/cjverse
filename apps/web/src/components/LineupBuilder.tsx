'use client';

import React from 'react';
import { CardRecord, UserActiveLineup } from '@cjverse/db';

export type LineupSlotType = 'vanguard' | 'striker' | 'conduit';

export interface LineupBuilderProps {
  lineup: UserActiveLineup;
  cards: CardRecord[];
  onUnequip: (slot: LineupSlotType) => Promise<void> | void;
  onSlotSelect?: (slot: LineupSlotType) => void;
  selectedSlot?: LineupSlotType | null;
  isUpdatingSlot?: LineupSlotType | null;
}

const SLOT_CONFIG: Record<
  LineupSlotType,
  {
    name: string;
    role: string;
    icon: React.ReactNode;
    color: string;
    borderGlow: string;
    badgeBg: string;
  }
> = {
  vanguard: {
    name: 'Vanguard',
    role: 'Defensive Anchor',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    color: 'text-cyan-400',
    borderGlow: 'hover:border-cyan-400/70 border-cyan-500/30',
    badgeBg: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40',
  },
  striker: {
    name: 'Striker',
    role: 'High Offensive Power',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
        <path d="M13 19l6 2 2-6-4.5-4.5" />
        <path d="M9.5 6.5L21 18v3h-3L6.5 9.5" />
      </svg>
    ),
    color: 'text-rose-400',
    borderGlow: 'hover:border-rose-400/70 border-rose-500/30',
    badgeBg: 'bg-rose-950/60 text-rose-300 border-rose-500/40',
  },
  conduit: {
    name: 'Conduit',
    role: 'Mana & Burst Engine',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 9 9" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    color: 'text-purple-400',
    borderGlow: 'hover:border-purple-400/70 border-purple-500/30',
    badgeBg: 'bg-purple-950/60 text-purple-300 border-purple-500/40',
  },
};

const VARIANT_STYLES: Record<string, { border: string; glow: string; text: string }> = {
  Normal: {
    border: 'border-slate-600',
    glow: 'shadow-none',
    text: 'text-slate-400',
  },
  Silver: {
    border: 'border-slate-300',
    glow: 'shadow-[0_0_15px_rgba(203,213,225,0.3)]',
    text: 'text-slate-200',
  },
  Gold: {
    border: 'border-amber-400',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.35)]',
    text: 'text-amber-400',
  },
  Diamond: {
    border: 'border-cyan-400',
    glow: 'shadow-[0_0_25px_rgba(34,211,238,0.4)]',
    text: 'text-cyan-300',
  },
  Rainbow: {
    border: 'border-fuchsia-400',
    glow: 'shadow-[0_0_30px_rgba(232,121,249,0.5)]',
    text: 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-300 via-green-300 via-cyan-400 to-fuchsia-400 font-extrabold',
  },
};

const ELEMENT_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Fire: { bg: 'bg-red-950/80 border-red-500/50', text: 'text-red-400', icon: '🔥' },
  Ice: { bg: 'bg-cyan-950/80 border-cyan-500/50', text: 'text-cyan-300', icon: '❄️' },
  Lightning: { bg: 'bg-amber-950/80 border-amber-500/50', text: 'text-amber-300', icon: '⚡' },
  Earth: { bg: 'bg-stone-900 border-stone-500/50', text: 'text-emerald-400', icon: '🌿' },
  Arcane: { bg: 'bg-indigo-950/80 border-indigo-500/50', text: 'text-indigo-300', icon: '🔮' },
  Shadow: { bg: 'bg-purple-950/80 border-purple-500/50', text: 'text-purple-300', icon: '🌑' },
  Void: { bg: 'bg-zinc-950 border-purple-500/60', text: 'text-purple-200', icon: '🌌' },
  Blood: { bg: 'bg-rose-950/80 border-rose-600/50', text: 'text-rose-400', icon: '🩸' },
  Light: { bg: 'bg-yellow-950/80 border-yellow-400/50', text: 'text-yellow-300', icon: '✨' },
  Time: { bg: 'bg-amber-950/80 border-yellow-500/50', text: 'text-amber-200', icon: '⏳' },
  Cosmic: { bg: 'bg-blue-950/80 border-sky-400/50', text: 'text-sky-300', icon: '🌠' },
  Chaos: { bg: 'bg-red-950/80 border-fuchsia-500/50', text: 'text-fuchsia-300', icon: '💥' },
};

export function LineupBuilder({
  lineup,
  cards,
  onUnequip,
  onSlotSelect,
  selectedSlot,
  isUpdatingSlot,
}: LineupBuilderProps) {
  const slots: LineupSlotType[] = ['vanguard', 'striker', 'conduit'];

  const getCardForSlot = (slot: LineupSlotType): CardRecord | undefined => {
    let cardId: string | null = null;
    if (slot === 'vanguard') cardId = lineup.vanguardCardId;
    else if (slot === 'striker') cardId = lineup.strikerCardId;
    else if (slot === 'conduit') cardId = lineup.conduitCardId;

    if (!cardId) return undefined;
    return cards.find((c) => c.id === cardId);
  };

  return (
    <section className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-rose-400 uppercase tracking-wider">
              Battle Lineup (3v3 Deckbuilder)
            </h2>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Equip 3 active cards for authoritative Skirmish Arena duels. Click any card in your binder to assign.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700">
            {slots.filter((s) => Boolean(getCardForSlot(s))).length} / 3 Assigned
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {slots.map((slot) => {
          const config = SLOT_CONFIG[slot];
          const equippedCard = getCardForSlot(slot);
          const isSelected = selectedSlot === slot;
          const isBusy = isUpdatingSlot === slot;

          const variantStyle = equippedCard
            ? VARIANT_STYLES[equippedCard.variant] || VARIANT_STYLES.Normal
            : VARIANT_STYLES.Normal;

          const elementStyle = equippedCard
            ? ELEMENT_COLORS[equippedCard.element] || {
                bg: 'bg-slate-800 border-slate-600',
                text: 'text-slate-300',
                icon: '⚡',
              }
            : null;

          return (
            <div
              key={slot}
              id={`lineup-slot-${slot}`}
              onClick={() => {
                if (!equippedCard && onSlotSelect) {
                  onSlotSelect(slot);
                }
              }}
              className={`relative flex flex-col justify-between min-h-[220px] rounded-2xl p-5 transition-all duration-300 ${
                equippedCard
                  ? `bg-gradient-to-b from-slate-900/95 to-slate-950/95 border ${variantStyle.border} ${variantStyle.glow}`
                  : `border-2 border-dashed ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-2 ring-cyan-500/50'
                        : `${config.borderGlow} bg-slate-950/40 hover:bg-slate-900/40`
                    } cursor-pointer`
              }`}
            >
              {/* Slot Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 ${config.color}`}>
                    {config.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
                      {config.name}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-400">{config.role}</p>
                  </div>
                </div>

                {equippedCard ? (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${elementStyle?.bg} ${elementStyle?.text}`}
                  >
                    {elementStyle?.icon} {equippedCard.element}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                    Empty
                  </span>
                )}
              </div>

              {/* Slot Body */}
              {equippedCard ? (
                <div className="flex-1 flex flex-col justify-center py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-cyan-300 bg-slate-800/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
                          {equippedCard.id}
                        </span>
                        <span className={`text-xs font-extrabold uppercase ${variantStyle.text}`}>
                          {equippedCard.variant}
                        </span>
                      </div>

                      <div className="text-base font-black text-white truncate tracking-wide">
                        {equippedCard.race}
                      </div>

                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Lv. {equippedCard.level}</span>
                        <span>•</span>
                        <span>Stage {equippedCard.evolutionStage}</span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                        Power
                      </div>
                      <div className="text-lg font-black text-amber-300 tracking-tight flex items-center gap-1">
                        <span>⚡</span>
                        <span>{equippedCard.powerScore.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                  <div className="w-10 h-10 rounded-full border border-dashed border-slate-600 flex items-center justify-center text-slate-400 text-lg mb-2">
                    +
                  </div>
                  <p className="text-xs font-semibold text-slate-300">
                    {isSelected ? 'Ready: Select a card from your binder below' : 'Click a card below to assign'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Defend, strike, and channel spells
                  </p>
                </div>
              )}

              {/* Slot Footer / Action */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                {equippedCard ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnequip(slot);
                    }}
                    className="w-full py-1.5 px-3 bg-rose-950/40 hover:bg-rose-900/60 active:scale-98 text-rose-300 hover:text-white border border-rose-500/40 hover:border-rose-400 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5"
                  >
                    {isBusy ? (
                      <span className="inline-block w-3 h-3 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        <span>Unequip</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-full text-center text-[11px] text-cyan-400/80 font-medium italic">
                    {isSelected ? 'Target Slot Selected' : 'Ready for assignment'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
