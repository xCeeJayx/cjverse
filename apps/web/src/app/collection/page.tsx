'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { LineupBuilder, LineupSlotType } from '../../components/LineupBuilder';
import { CardRecord, UserActiveLineup } from '@cjverse/db';
import { calculateStats, getEvolutionStageName } from '@cjverse/game-logic';
import { getDevSessionFromQuery, getClientSessionCookie } from '../../lib/auth-session';

// 3D Tilt Card Component with Holographic Sheen
interface CardTileProps {
  card: CardRecord;
  isEquipped: LineupSlotType | null;
  onOpenActions: (card: CardRecord) => void;
  onViewStats: (card: CardRecord) => void;
  onEquipDirect: (card: CardRecord, slot: LineupSlotType) => void;
  isUpdating: boolean;
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
  Normal: {
    border: 'border-slate-700 hover:border-slate-500',
    glow: 'hover:shadow-[0_0_20px_rgba(100,116,139,0.25)]',
    badgeBg: 'bg-slate-800 text-slate-300 border-slate-600',
    badgeText: 'text-slate-300',
    foilOverlay: 'from-slate-400/5 to-slate-200/10',
  },
  Silver: {
    border: 'border-slate-400/80 hover:border-slate-200',
    glow: 'hover:shadow-[0_0_25px_rgba(226,232,240,0.35)]',
    badgeBg: 'bg-slate-700 text-slate-100 border-slate-400',
    badgeText: 'text-slate-100',
    foilOverlay: 'from-slate-200/15 via-white/10 to-slate-400/15',
  },
  Gold: {
    border: 'border-amber-500/80 hover:border-amber-300',
    glow: 'hover:shadow-[0_0_30px_rgba(251,191,36,0.45)]',
    badgeBg: 'bg-amber-950 text-amber-300 border-amber-500',
    badgeText: 'text-amber-400',
    foilOverlay: 'from-amber-400/20 via-yellow-200/15 to-amber-600/20',
  },
  Diamond: {
    border: 'border-cyan-400 hover:border-cyan-200',
    glow: 'hover:shadow-[0_0_35px_rgba(34,211,238,0.5)]',
    badgeBg: 'bg-cyan-950 text-cyan-300 border-cyan-400',
    badgeText: 'text-cyan-300',
    foilOverlay: 'from-cyan-400/25 via-sky-200/20 to-blue-500/25',
  },
  Rainbow: {
    border: 'border-fuchsia-400 hover:border-pink-300',
    glow: 'hover:shadow-[0_0_40px_rgba(244,114,182,0.6)]',
    badgeBg: 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-400',
    badgeText: 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-300 via-green-300 via-cyan-400 to-fuchsia-400 font-black',
    foilOverlay: 'from-red-500/20 via-green-400/20 via-cyan-400/20 to-fuchsia-500/20',
  },
};

const ELEMENT_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
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

function CardTile({
  card,
  isEquipped,
  onOpenActions,
  onViewStats,
  onEquipDirect,
  isUpdating,
}: CardTileProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0, sheenX: 50, sheenY: 50, isHovered: false });

  const variantStyle = VARIANT_COLORS[card.variant] || VARIANT_COLORS.Normal;
  const elementStyle = ELEMENT_STYLES[card.element] || {
    bg: 'bg-slate-800 border-slate-600',
    text: 'text-slate-300',
    icon: '⚡',
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    // Subtle 3D perspective tilt
    setTilt({
      x: -(y * 14),
      y: x * 14,
      sheenX: (x + 0.5) * 100,
      sheenY: (y + 0.5) * 100,
      isHovered: true,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, sheenX: 50, sheenY: 50, isHovered: false });
  };

  return (
    <div
      className="relative select-none group"
      style={{ perspective: '1000px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        onClick={() => onOpenActions(card)}
        style={{
          transform: tilt.isHovered
            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.025, 1.025, 1.025)`
            : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
          transition: tilt.isHovered ? 'transform 0.08s ease-out' : 'transform 0.35s ease-out',
        }}
        className={`relative flex flex-col justify-between h-[360px] rounded-2xl p-4 bg-slate-900/90 backdrop-blur-md border ${variantStyle.border} ${variantStyle.glow} cursor-pointer transition-shadow duration-300 overflow-hidden shadow-xl`}
      >
        {/* Holographic Sheen Overlay */}
        {tilt.isHovered && (
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl mix-blend-color-dodge transition-opacity duration-200 opacity-60 z-20"
            style={{
              background: `radial-gradient(circle at ${tilt.sheenX}% ${tilt.sheenY}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 50%, transparent 80%)`,
            }}
          />
        )}

        {/* Shimmer Ambient Gradient */}
        <div
          className={`absolute inset-0 bg-gradient-to-tr ${variantStyle.foilOverlay} opacity-30 pointer-events-none`}
        />

        {/* Card Header: 6-char ID, Variant, and Equipped Tag */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-cyan-500/30">
              {card.id}
            </span>
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${variantStyle.badgeBg}`}
            >
              {card.variant}
            </span>
          </div>

          {isEquipped && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-500/50 shadow-sm flex items-center gap-1">
              <span>●</span>
              <span>{isEquipped}</span>
            </span>
          )}
        </div>

        {/* Card Center: Race Illustration & Elemental Visual */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-3">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700/80 flex items-center justify-center text-4xl shadow-inner relative group-hover:scale-105 transition-transform duration-200">
            <span className="filter drop-shadow-md">{elementStyle.icon}</span>
            <span className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300">
              {card.race}
            </span>
          </div>

          <h3 className="text-base font-black text-white mt-3 tracking-wide uppercase">
            {card.variant} {card.race}
          </h3>

          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${elementStyle.bg} ${elementStyle.text}`}
            >
              {elementStyle.icon} {card.element} ({card.elementTier})
            </span>
          </div>
        </div>

        {/* Card Footer: Level, Stage, Power Score */}
        <div className="relative z-10 pt-3 border-t border-slate-800/90 flex items-end justify-between">
          <div>
            <div className="text-[10px] font-semibold text-slate-400">
              Lv. {card.level} • Stage {card.evolutionStage}
            </div>
            <div className="text-[10px] text-slate-500 capitalize">
              {getEvolutionStageName(card.evolutionStage)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Power</div>
            <div className="text-base font-black text-amber-300 tracking-tight flex items-center justify-end gap-1">
              <span>⚡</span>
              <span>{card.powerScore.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hover Quick Action Buttons bar */}
      <div className="mt-2 grid grid-cols-2 gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenActions(card);
          }}
          className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg border border-slate-700 transition-all flex items-center justify-center gap-1"
        >
          <span>⚡</span>
          <span>Equip</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewStats(card);
          }}
          className="py-1 px-2 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 text-[11px] font-bold rounded-lg border border-indigo-500/40 transition-all flex items-center justify-center gap-1"
        >
          <span>📊</span>
          <span>Stats</span>
        </button>
      </div>
    </div>
  );
}

// Detailed Stats Modal Component
interface StatsModalProps {
  card: CardRecord | null;
  onClose: () => void;
  onEquip: (cardId: string, slot: LineupSlotType) => void;
  currentLineup: UserActiveLineup;
  isUpdating: boolean;
}

function StatsModal({
  card,
  onClose,
  onEquip,
  currentLineup,
  isUpdating,
}: StatsModalProps) {
  if (!card) return null;

  const stats = calculateStats({
    id: card.id,
    race: card.race as any,
    variant: card.variant as any,
    element: card.element as any,
    elementTier: card.elementTier as any,
    evolutionStage: card.evolutionStage,
    level: card.level,
    powerScore: card.powerScore,
    seed: card.seed,
  });

  const variantStyle = VARIANT_COLORS[card.variant] || VARIANT_COLORS.Normal;
  const elementStyle = ELEMENT_STYLES[card.element] || {
    bg: 'bg-slate-800 border-slate-600',
    text: 'text-slate-300',
    icon: '⚡',
  };

  const getEquippedSlot = (): LineupSlotType | null => {
    if (currentLineup.vanguardCardId === card.id) return 'vanguard';
    if (currentLineup.strikerCardId === card.id) return 'striker';
    if (currentLineup.conduitCardId === card.id) return 'conduit';
    return null;
  };

  const equippedSlot = getEquippedSlot();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/40 flex items-center justify-center text-3xl">
            {elementStyle.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                {card.id}
              </span>
              <span
                className={`text-xs font-black uppercase px-2 py-0.5 rounded border ${variantStyle.badgeBg}`}
              >
                {card.variant}
              </span>
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-wide mt-1">
              {card.race}
            </h2>
          </div>
        </div>

        {/* Card Properties Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase">Element</span>
            <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5 mt-0.5">
              <span>{elementStyle.icon}</span>
              <span>{card.element}</span>
              <span className="text-xs text-slate-400">({card.elementTier})</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase">Evolution Stage</span>
            <div className="text-sm font-bold text-cyan-300 mt-0.5">
              Stage {card.evolutionStage} • {getEvolutionStageName(card.evolutionStage)}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase">Current Level</span>
            <div className="text-sm font-bold text-slate-200 mt-0.5">Level {card.level}</div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-amber-400 uppercase">Power Score</span>
            <div className="text-base font-black text-amber-300 mt-0.5 flex items-center gap-1">
              <span>⚡</span>
              <span>{card.powerScore.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Calculated Combat Stats */}
        <div className="mb-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
            Authoritative Combat Stats
          </h3>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/20 text-center">
              <div className="text-[10px] font-bold text-emerald-400 uppercase">Max HP</div>
              <div className="text-lg font-black text-emerald-300">{stats.maxHp}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-rose-500/20 text-center">
              <div className="text-[10px] font-bold text-rose-400 uppercase">Attack (ATK)</div>
              <div className="text-lg font-black text-rose-300">{stats.atk}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-blue-500/20 text-center">
              <div className="text-[10px] font-bold text-blue-400 uppercase">Defense (DEF)</div>
              <div className="text-lg font-black text-blue-300">{stats.def}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-amber-500/20 text-center">
              <div className="text-[10px] font-bold text-amber-400 uppercase">Speed (SPD)</div>
              <div className="text-lg font-black text-amber-300">{stats.spd}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-purple-500/20 text-center col-span-2">
              <div className="text-[10px] font-bold text-purple-400 uppercase">Max Mana</div>
              <div className="text-lg font-black text-purple-300">{stats.maxMana}</div>
            </div>
          </div>
        </div>

        {/* Quick Assign Buttons */}
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">
            Assign to Battle Lineup
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onEquip(card.id, 'vanguard')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                equippedSlot === 'vanguard'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/30'
                  : 'bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40'
              }`}
            >
              <span>🛡️</span>
              <span>{equippedSlot === 'vanguard' ? 'Vanguard (Active)' : 'Vanguard'}</span>
            </button>

            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onEquip(card.id, 'striker')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                equippedSlot === 'striker'
                  ? 'bg-rose-500 text-white font-black shadow-lg shadow-rose-500/30'
                  : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40'
              }`}
            >
              <span>⚔️</span>
              <span>{equippedSlot === 'striker' ? 'Striker (Active)' : 'Striker'}</span>
            </button>

            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onEquip(card.id, 'conduit')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                equippedSlot === 'conduit'
                  ? 'bg-purple-500 text-white font-black shadow-lg shadow-purple-500/30'
                  : 'bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-500/40'
              }`}
            >
              <span>🔮</span>
              <span>{equippedSlot === 'conduit' ? 'Conduit (Active)' : 'Conduit'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Quick Action Drawer / Menu Component
interface QuickActionMenuProps {
  card: CardRecord | null;
  onClose: () => void;
  onEquip: (cardId: string, slot: LineupSlotType) => void;
  onViewStats: (card: CardRecord) => void;
  currentLineup: UserActiveLineup;
  isUpdating: boolean;
}

function QuickActionMenu({
  card,
  onClose,
  onEquip,
  onViewStats,
  currentLineup,
  isUpdating,
}: QuickActionMenuProps) {
  if (!card) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-w-xs w-full bg-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div>
            <span className="font-mono text-xs font-bold text-cyan-400 bg-slate-800 px-1.5 py-0.5 rounded">
              {card.id}
            </span>
            <div className="text-sm font-black text-white mt-1 uppercase">
              {card.variant} {card.race}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Assign Card Slot:
        </p>

        <div className="flex flex-col gap-2 mb-4">
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => {
              onEquip(card.id, 'vanguard');
              onClose();
            }}
            className="w-full py-2 px-3 bg-cyan-950/40 hover:bg-cyan-900/60 active:scale-98 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            <span className="text-base">🛡️</span>
            <span>Set as Vanguard (Defense)</span>
          </button>

          <button
            type="button"
            disabled={isUpdating}
            onClick={() => {
              onEquip(card.id, 'striker');
              onClose();
            }}
            className="w-full py-2 px-3 bg-rose-950/40 hover:bg-rose-900/60 active:scale-98 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            <span className="text-base">⚔️</span>
            <span>Set as Striker (Attack)</span>
          </button>

          <button
            type="button"
            disabled={isUpdating}
            onClick={() => {
              onEquip(card.id, 'conduit');
              onClose();
            }}
            className="w-full py-2 px-3 bg-purple-950/40 hover:bg-purple-900/60 active:scale-98 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            <span className="text-base">🔮</span>
            <span>Set as Conduit (Mana & Burst)</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onViewStats(card);
          }}
          className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
        >
          <span>📊</span>
          <span>View Detailed Stats</span>
        </button>
      </div>
    </div>
  );
}

function CollectionContent() {
  const searchParams = useSearchParams();
  const asParam = searchParams?.get('as');

  const [cards, setCards] = useState<CardRecord[]>([]);
  const [lineup, setLineup] = useState<UserActiveLineup>({
    vanguardCardId: null,
    strikerCardId: null,
    conduitCardId: null,
  });
  const [user, setUser] = useState<{
    id?: string;
    username?: string;
    avatarUrl?: string | null;
    crystals?: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingSlot, setIsUpdatingSlot] = useState<LineupSlotType | null>(null);
  const [selectedSlotForAssignment, setSelectedSlotForAssignment] = useState<LineupSlotType | null>(
    null
  );

  // Filters & Sort States
  const [selectedElement, setSelectedElement] = useState<string>('All');
  const [selectedVariant, setSelectedVariant] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'power' | 'level' | 'newest'>('power');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [actionMenuCard, setActionMenuCard] = useState<CardRecord | null>(null);
  const [statsModalCard, setStatsModalCard] = useState<CardRecord | null>(null);

  // Fetch Collection from /api/user/collection
  const fetchCollection = async () => {
    setIsLoading(true);
    try {
      let queryParam = '';
      if (asParam) {
        queryParam = `?as=${encodeURIComponent(asParam)}`;
      }

      const res = await fetch(`/api/user/collection${queryParam}`);
      if (!res.ok) {
        throw new Error(`Failed to load collection: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.cards) setCards(data.cards);
      if (data.lineup) setLineup(data.lineup);
      if (data.user) setUser(data.user);
    } catch (err) {
      console.warn('[Collection Page] Fetch collection error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollection();
  }, [asParam]);

  // Handle slot assignment
  const handleAssignCard = async (cardId: string, slot: LineupSlotType) => {
    setIsUpdatingSlot(slot);

    // Optimistic UI update
    setLineup((prev) => {
      const next = { ...prev };
      if (next.vanguardCardId === cardId) next.vanguardCardId = null;
      if (next.strikerCardId === cardId) next.strikerCardId = null;
      if (next.conduitCardId === cardId) next.conduitCardId = null;

      if (slot === 'vanguard') next.vanguardCardId = cardId;
      else if (slot === 'striker') next.strikerCardId = cardId;
      else if (slot === 'conduit') next.conduitCardId = cardId;

      return next;
    });

    try {
      let queryParam = '';
      if (asParam) {
        queryParam = `?as=${encodeURIComponent(asParam)}`;
      }

      const res = await fetch(`/api/user/lineup${queryParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, cardId }),
      });

      if (!res.ok) {
        throw new Error('Failed to update lineup');
      }

      const data = await res.json();
      if (data.lineup) {
        setLineup(data.lineup);
      }
    } catch (err) {
      console.error('[Collection Page] Error equipping slot:', err);
      // Revert with fresh fetch
      fetchCollection();
    } finally {
      setIsUpdatingSlot(null);
      setSelectedSlotForAssignment(null);
    }
  };

  // Handle slot unequip
  const handleUnequip = async (slot: LineupSlotType) => {
    setIsUpdatingSlot(slot);

    // Optimistic update
    setLineup((prev) => {
      const next = { ...prev };
      if (slot === 'vanguard') next.vanguardCardId = null;
      else if (slot === 'striker') next.strikerCardId = null;
      else if (slot === 'conduit') next.conduitCardId = null;
      return next;
    });

    try {
      let queryParam = '';
      if (asParam) {
        queryParam = `?as=${encodeURIComponent(asParam)}`;
      }

      const res = await fetch(`/api/user/lineup${queryParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, cardId: null }),
      });

      if (!res.ok) {
        throw new Error('Failed to unequip slot');
      }

      const data = await res.json();
      if (data.lineup) {
        setLineup(data.lineup);
      }
    } catch (err) {
      console.error('[Collection Page] Error unequipping slot:', err);
      fetchCollection();
    } finally {
      setIsUpdatingSlot(null);
    }
  };

  // Card click behavior: if a slot is currently selected in LineupBuilder, assign to that slot!
  const handleCardClick = (card: CardRecord) => {
    if (selectedSlotForAssignment) {
      handleAssignCard(card.id, selectedSlotForAssignment);
    } else {
      setActionMenuCard(card);
    }
  };

  // Filter & Sort Logic
  const filteredCards = useMemo(() => {
    return cards
      .filter((c) => {
        if (selectedElement !== 'All' && c.element !== selectedElement) {
          return false;
        }
        if (selectedVariant !== 'All' && c.variant !== selectedVariant) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchId = c.id.toLowerCase().includes(q);
          const matchRace = c.race.toLowerCase().includes(q);
          const matchElement = c.element.toLowerCase().includes(q);
          const matchVariant = c.variant.toLowerCase().includes(q);
          return matchId || matchRace || matchElement || matchVariant;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'power') {
          return b.powerScore - a.powerScore;
        }
        if (sortBy === 'level') {
          return b.level - a.level;
        }
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
      });
  }, [cards, selectedElement, selectedVariant, sortBy, searchQuery]);

  const availableElements = [
    'All',
    'Fire',
    'Ice',
    'Lightning',
    'Earth',
    'Arcane',
    'Shadow',
    'Void',
    'Blood',
    'Light',
    'Time',
    'Cosmic',
    'Chaos',
  ];

  const availableVariants = ['All', 'Normal', 'Silver', 'Gold', 'Diamond', 'Rainbow'];

  return (
    <div className="min-h-screen bg-slate-950 bg-arena-grid bg-arena-radial text-slate-100 flex flex-col">
      <Navbar initialUser={user} />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Lineup Builder Bar */}
        <LineupBuilder
          lineup={lineup}
          cards={cards}
          onUnequip={handleUnequip}
          onSlotSelect={(slot) => setSelectedSlotForAssignment(slot)}
          selectedSlot={selectedSlotForAssignment}
          isUpdatingSlot={isUpdatingSlot}
        />

        {/* Collection Grid Controls Header */}
        <section className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 uppercase tracking-wide">
                Visual Card Binder Grid
              </h1>
              <p className="text-slate-400 text-xs mt-1">
                Showing {filteredCards.length} of {cards.length} cards collected across races and variants.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, race, element..."
                className="w-full px-4 py-2 pl-9 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <span className="absolute left-3 top-2.5 text-xs text-slate-500">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filtering & Sorting Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
            {/* Filter by Element */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Element:
              </span>
              <div className="flex items-center gap-1.5 flex-nowrap">
                {availableElements.slice(0, 8).map((elem) => (
                  <button
                    key={elem}
                    type="button"
                    onClick={() => setSelectedElement(elem)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      selectedElement === elem
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {elem}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Variant & Sort */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Variant Select */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Variant:
                </span>
                <select
                  value={selectedVariant}
                  onChange={(e) => setSelectedVariant(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950/90 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                >
                  {availableVariants.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By Select */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-950/90 border border-slate-700 rounded-xl text-xs font-bold text-amber-400 focus:outline-none focus:border-cyan-500"
                >
                  <option value="power">⚡ Power Score (High to Low)</option>
                  <option value="level">🎖️ Level (High to Low)</option>
                  <option value="newest">🕒 Newest Discovered</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Binder Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-2xl animate-spin mb-3">
              🎴
            </div>
            <div className="text-sm font-bold text-slate-300 animate-pulse">
              Loading Card Binder...
            </div>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800">
            <span className="text-4xl mb-3 block">🎴</span>
            <h3 className="text-lg font-bold text-white">No cards matched your filter</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Try adjusting your element or variant filters, or use the Discord bot command{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-400">/hunt</code> to find
              new cards!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredCards.map((card) => {
              const isEquippedSlot =
                lineup.vanguardCardId === card.id
                  ? 'vanguard'
                  : lineup.strikerCardId === card.id
                  ? 'striker'
                  : lineup.conduitCardId === card.id
                  ? 'conduit'
                  : null;

              return (
                <CardTile
                  key={card.id}
                  card={card}
                  isEquipped={isEquippedSlot}
                  onOpenActions={() => handleCardClick(card)}
                  onViewStats={() => setStatsModalCard(card)}
                  onEquipDirect={(c, slot) => handleAssignCard(c.id, slot)}
                  isUpdating={isUpdatingSlot !== null}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Quick Action Drawer / Menu */}
      <QuickActionMenu
        card={actionMenuCard}
        onClose={() => setActionMenuCard(null)}
        onEquip={handleAssignCard}
        onViewStats={(c) => {
          setActionMenuCard(null);
          setStatsModalCard(c);
        }}
        currentLineup={lineup}
        isUpdating={isUpdatingSlot !== null}
      />

      {/* Detailed Stats Modal */}
      <StatsModal
        card={statsModalCard}
        onClose={() => setStatsModalCard(null)}
        onEquip={handleAssignCard}
        currentLineup={lineup}
        isUpdating={isUpdatingSlot !== null}
      />
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <div className="animate-spin text-3xl">🎴</div>
        </div>
      }
    >
      <CollectionContent />
    </Suspense>
  );
}
