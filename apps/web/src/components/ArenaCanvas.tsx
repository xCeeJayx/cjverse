'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ArenaState } from '../lib/arena-controller';

interface ArenaCanvasProps {
  arenaState: ArenaState;
  onAction: (actionType: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE', targetCardId?: string) => void;
  isAuto: boolean;
  onToggleAuto: () => void;
  currentUserId?: string;
}

export const ArenaCanvas: React.FC<ArenaCanvasProps> = ({
  arenaState,
  onAction,
  isAuto,
  onToggleAuto,
  currentUserId
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // Auto-select lowest HP alive enemy if no target is selected
  useEffect(() => {
    const isP1 = currentUserId ? arenaState.p1.id === currentUserId : true;
    const enemyCards = isP1 ? arenaState.p2.cards : arenaState.p1.cards;
    const aliveEnemies = (enemyCards || []).filter((c: any) => (c.currentHp ?? 1) > 0);

    if (aliveEnemies.length > 0) {
      if (!selectedTargetId || !aliveEnemies.some((c: any) => c.id === selectedTargetId)) {
        // Default to first alive enemy (or vanguard)
        setSelectedTargetId(aliveEnemies[0].id);
      }
    }
  }, [arenaState, currentUserId, selectedTargetId]);

  // Determine which card is active
  const allCards = [...(arenaState.p1.cards || []), ...(arenaState.p2.cards || [])];
  const activeCard = allCards.find((c: any) => c.id === arenaState.activeCardId);
  const isMyTurn = !currentUserId || !activeCard || (
    activeCard.playerId ? activeCard.playerId === currentUserId : (
      arenaState.p1.cards?.some((c: any) => c.id === activeCard.id) && arenaState.p1.id === currentUserId
    )
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw duel stage
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dynamic arena gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0a0f1d');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid accent lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Header: status & countdown
    ctx.textAlign = 'center';
    if (arenaState.status === 'COMPLETED') {
      const winnerName = arenaState.winnerId === arenaState.p1.id
        ? (arenaState.p1.name || 'Player 1')
        : (arenaState.p2.name || 'Player 2');
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`🏆 MATCH COMPLETED — WINNER: ${winnerName.toUpperCase()}`, canvas.width / 2, 38);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`MATCH STATUS: ${arenaState.status}`, canvas.width / 2, 24);

      const timerColor = arenaState.timeRemaining <= 3 ? '#ef4444' : arenaState.timeRemaining <= 7 ? '#eab308' : '#22c55e';
      ctx.fillStyle = timerColor;
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`⏱️ TURN TIMER: ${arenaState.timeRemaining}s`, canvas.width / 2, 48);
    }

    // Active Card Turn Banner
    if (activeCard && arenaState.status === 'IN_PROGRESS') {
      const activeOwner = arenaState.p1.cards?.some((c: any) => c.id === activeCard.id)
        ? (arenaState.p1.name || 'Player 1')
        : (arenaState.p2.name || 'Player 2');
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`Acting: ${activeCard.name || activeCard.role?.toUpperCase() || 'Card'} (${activeOwner})`, canvas.width / 2, 70);
    }

    // Draw P1 Header
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`🛡️ P1: ${arenaState.p1.name || 'Player 1'}`, 40, 95);

    // Draw P2 Header
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`⚔️ P2: ${arenaState.p2.name || 'Player 2'}`, canvas.width - 40, 95);

    // Render 3v3 Cards function
    const renderCard = (card: any, x: number, y: number, isP1: boolean) => {
      const w = 320;
      const h = 95;
      const isDead = (card.currentHp ?? 1) <= 0;
      const isActive = card.id === arenaState.activeCardId;
      const isTarget = card.id === selectedTargetId;

      // Card Background
      ctx.save();
      ctx.fillStyle = isDead ? '#1e293b' : isActive ? '#1e1b4b' : '#0f172a';
      ctx.strokeStyle = isActive ? '#fbbf24' : isTarget ? '#ef4444' : isP1 ? '#0284c7' : '#e11d48';
      ctx.lineWidth = isActive ? 3 : isTarget ? 2.5 : 1.5;

      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.stroke();

      // Card Name & Role Badge
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = isDead ? '#64748b' : '#f8fafc';
      const roleText = (card.role || 'Card').toUpperCase();
      const cardName = card.name || `${card.variant || ''} ${card.race || ''}`.trim() || `Card ${card.id.slice(0, 6)}`;
      ctx.fillText(`${cardName} [${roleText}]`, x + 12, y + 22);

      // Element & Stats info
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#94a3b8';
      const elemText = card.element ? `${card.element.toUpperCase()} (${card.elementTier || 'A'})` : 'Neutral';
      const pwrText = card.powerScore ? `PWR: ${card.powerScore}` : '';
      ctx.fillText(`${elemText} | ATK: ${card.atk ?? 100} | DEF: ${card.def ?? 50} ${pwrText}`, x + 12, y + 40);

      // HP Bar
      const maxHp = card.maxHp || 1000;
      const curHp = Math.max(0, card.currentHp ?? maxHp);
      const hpPct = Math.max(0, Math.min(1, curHp / maxHp));

      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 12, y + 50, w - 24, 12);
      ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(x + 12, y + 50, (w - 24) * hpPct, 12);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`HP: ${curHp} / ${maxHp}`, x + w / 2, y + 60);

      // Mana Bar
      const maxMana = card.maxMana || 100;
      const curMana = Math.max(0, card.currentMana ?? 50);
      const manaPct = Math.max(0, Math.min(1, curMana / maxMana));

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 12, y + 68, w - 24, 8);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x + 12, y + 68, (w - 24) * manaPct, 8);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '9px sans-serif';
      ctx.fillText(`MP: ${curMana} / ${maxMana}`, x + w / 2, y + 75);

      // Badges (Active / Target / Defeated)
      if (isDead) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💀 DEFEATED', x + w / 2, y + h / 2 + 5);
      } else if (isActive) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('⚡ ACTIVE TURN', x + w - 10, y + 20);
      } else if (isTarget) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('🎯 TARGET', x + w - 10, y + 20);
      }

      ctx.restore();
    };

    // Render P1 Cards
    const p1Cards = arenaState.p1.cards || [];
    p1Cards.forEach((c: any, i: number) => {
      renderCard(c, 40, 115 + i * 105, true);
    });

    // Render P2 Cards
    const p2Cards = arenaState.p2.cards || [];
    p2Cards.forEach((c: any, i: number) => {
      renderCard(c, canvas.width - 360, 115 + i * 105, false);
    });

    // Center VS divider
    ctx.textAlign = 'center';
    ctx.font = 'italic bold 28px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillText('VS', canvas.width / 2, 275);
  }, [arenaState, selectedTargetId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check P2 cards (right side) if clicked
    const p2Cards = arenaState.p2.cards || [];
    p2Cards.forEach((c: any, i: number) => {
      const cardX = canvas.width - 360;
      const cardY = 115 + i * 105;
      if (x >= cardX && x <= cardX + 320 && y >= cardY && y <= cardY + 95) {
        if ((c.currentHp ?? 1) > 0) {
          setSelectedTargetId(c.id);
        }
      }
    });

    // Check P1 cards (left side) if clicked
    const p1Cards = arenaState.p1.cards || [];
    p1Cards.forEach((c: any, i: number) => {
      const cardX = 40;
      const cardY = 115 + i * 105;
      if (x >= cardX && x <= cardX + 320 && y >= cardY && y <= cardY + 95) {
        if ((c.currentHp ?? 1) > 0) {
          setSelectedTargetId(c.id);
        }
      }
    });
  };

  const handleActionClick = (type: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE') => {
    onAction(type, selectedTargetId || undefined);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl max-w-5xl w-full">
      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        onClick={handleCanvasClick}
        className="rounded-lg border border-slate-700 bg-slate-950 shadow-inner cursor-pointer"
      />

      <div className="flex flex-wrap items-center justify-center gap-3 w-full">
        <button
          onClick={() => handleActionClick('BASIC_ATTACK')}
          disabled={arenaState.status !== 'IN_PROGRESS'}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-lg transition text-white shadow-md active:scale-95"
        >
          ⚔️ Basic Attack (0 MP)
        </button>
        <button
          onClick={() => handleActionClick('ELEMENTAL_BURST')}
          disabled={arenaState.status !== 'IN_PROGRESS'}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-lg transition text-white shadow-md active:scale-95"
        >
          💥 Elemental Burst (30 MP)
        </button>
        <button
          onClick={() => handleActionClick('ULTIMATE')}
          disabled={arenaState.status !== 'IN_PROGRESS'}
          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-lg transition text-white shadow-md active:scale-95"
        >
          🌟 Ultimate (70 MP)
        </button>

        <button
          onClick={onToggleAuto}
          className={`px-5 py-2.5 font-bold rounded-lg transition text-white shadow-md active:scale-95 ${
            isAuto ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          🤖 Auto: {isAuto ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Combat Log Feed */}
      <div className="w-full bg-slate-950 p-4 rounded-lg border border-slate-800 text-left text-xs font-mono max-h-36 overflow-y-auto">
        <div className="text-slate-400 font-bold mb-1">📜 COMBAT LOG</div>
        {arenaState.combatLog && arenaState.combatLog.length > 0 ? (
          arenaState.combatLog.slice(-5).map((log, idx) => (
            <div key={idx} className="text-slate-300 py-0.5">
              • {log}
            </div>
          ))
        ) : (
          <div className="text-slate-600 italic">Combat logs will appear here when actions resolve.</div>
        )}
      </div>
    </div>
  );
};
