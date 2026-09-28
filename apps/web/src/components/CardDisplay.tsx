'use client';

import React, { useState, useRef } from 'react';
import { CardRecord } from '@cjverse/db';

export interface CardDisplayProps {
  card: Partial<CardRecord> & { id: string; variant?: string; race?: string; element?: string };
  size?: 'sm' | 'md' | 'lg';
  showFoilEffect?: boolean;
  className?: string;
  onClick?: () => void;
}

const FOIL_OVERLAYS: Record<string, string> = {
  normal: 'bg-gradient-to-tr from-transparent via-slate-400/5 to-transparent',
  silver: 'bg-gradient-to-tr from-transparent via-cyan-200/20 to-transparent animate-pulse',
  gold: 'bg-gradient-to-tr from-transparent via-amber-300/30 to-transparent',
  diamond: 'bg-gradient-to-tr from-cyan-400/25 via-white/30 to-blue-500/25',
  rainbow: 'bg-gradient-to-r from-red-500/20 via-yellow-400/20 via-cyan-400/20 to-fuchsia-500/20',
};

export function CardDisplay({
  card,
  size = 'md',
  showFoilEffect = true,
  className = '',
  onClick,
}: CardDisplayProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const variantKey = (card.variant || 'normal').toLowerCase();
  const foilClass = FOIL_OVERLAYS[variantKey] || FOIL_OVERLAYS.normal;

  const sizeClasses = {
    sm: 'w-36 h-[204px]',
    md: 'w-56 h-[317px]',
    lg: 'w-72 h-[408px]',
  }[size];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !showFoilEffect) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;

    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const imageSrc = `/api/cards/${card.id}/image`;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: tilt.x === 0 && tilt.y === 0 ? 'transform 0.4s ease-out' : 'none',
      }}
      className={`relative ${sizeClasses} rounded-2xl overflow-hidden cursor-pointer select-none group shadow-2xl transition-shadow ${className}`}
    >
      {/* Dynamic Rendered Image */}
      {!imageError ? (
        <img
          src={imageSrc}
          alt={`#${card.id} ${card.variant || ''} ${card.race || ''}`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="w-full h-full bg-slate-900 border border-slate-700 flex flex-col items-center justify-center p-3 text-center">
          <div className="text-3xl mb-1">🎴</div>
          <div className="text-xs font-black uppercase text-white">
            {card.variant} {card.race}
          </div>
          <div className="text-[10px] text-slate-400">#{card.id}</div>
        </div>
      )}

      {/* Holographic Foil Shine Overlay */}
      {showFoilEffect && (
        <div
          className={`absolute inset-0 pointer-events-none mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${foilClass}`}
          style={{
            backgroundPosition: `${50 + tilt.y * 2}% ${50 + tilt.x * 2}%`,
          }}
        />
      )}

      {/* Gloss Reflection Flare */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-2xl" />
    </div>
  );
}
