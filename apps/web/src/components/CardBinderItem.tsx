'use client';

import React, { useState } from 'react';
import { CardRecord } from '@cjverse/db';
import { LineupSlotType } from './LineupBuilder';

export interface CardBinderItemProps {
  card: CardRecord;
  isEquipped: LineupSlotType | null;
  onOpenActions: (card: CardRecord) => void;
  onViewStats: (card: CardRecord) => void;
  onEquipDirect?: (card: CardRecord, slot: LineupSlotType) => void;
  isUpdating?: boolean;
}

export function CardBinderItem({
  card,
  isEquipped,
  onOpenActions,
  onViewStats,
}: CardBinderItemProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0, sheenX: 50, sheenY: 50, isHovered: false });
  const [imageError, setImageError] = useState(false);

  const cleanId = (card.id || '').replace(/#/g, '');

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
    <div className="relative select-none group flex flex-col items-center">
      {/* 3D Perspective Card Container */}
      <div
        className="w-full relative"
        style={{ perspective: '1000px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div
          onClick={() => onOpenActions(card)}
          style={{
            transform: tilt.isHovered
              ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.03, 1.03, 1.03)`
              : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
            transition: tilt.isHovered ? 'transform 0.08s ease-out' : 'transform 0.35s ease-out',
          }}
          className="relative w-full aspect-[600/850] rounded-2xl overflow-hidden cursor-pointer shadow-xl hover:shadow-2xl transition-shadow duration-300 bg-slate-950"
        >
          {/* Holographic Sheen Overlay */}
          {tilt.isHovered && (
            <div
              className="absolute inset-0 pointer-events-none rounded-2xl mix-blend-color-dodge transition-opacity duration-200 opacity-60 z-20"
              style={{
                background: `radial-gradient(circle at ${tilt.sheenX}% ${tilt.sheenY}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 50%, transparent 80%)`,
              }}
            />
          )}

          {/* Equipped Status Indicator */}
          {isEquipped && (
            <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 shadow-lg backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>● {isEquipped}</span>
            </div>
          )}

          {/* The Physical Card Image */}
          {!imageError ? (
            <img
              src={`/api/cards/${cleanId}/image`}
              alt={`${card.race} ${card.variant}`}
              loading="lazy"
              className="w-full h-full object-cover rounded-2xl"
              onError={() => setImageError(true)}
            />
          ) : (
            /* Subtle Loading / Fallback Skeleton */
            <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 rounded-2xl flex flex-col items-center justify-center p-4 text-center">
              <span className="text-4xl mb-2">🎴</span>
              <span className="text-sm font-black uppercase text-white tracking-wide">
                {card.variant} {card.race}
              </span>
              <span className="text-xs font-mono text-cyan-400 mt-1">{cleanId}</span>
              <span className="text-[11px] text-slate-400 mt-2">
                Lv. {card.level} • ⚡ {card.powerScore}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Clean Action Buttons Docked Directly Under the Card */}
      <div className="flex gap-2 mt-2 w-full">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenActions(card);
          }}
          className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition-all border border-slate-700 hover:border-indigo-500 shadow"
        >
          {isEquipped ? 'Change Slot' : '+ Equip'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewStats(card);
          }}
          className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all border border-slate-800"
        >
          Stats
        </button>
      </div>
    </div>
  );
}
