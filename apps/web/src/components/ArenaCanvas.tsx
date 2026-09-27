'use client';

import React, { useRef, useEffect } from 'react';
import { ArenaState } from '../lib/arena-controller';

interface ArenaCanvasProps {
  arenaState: ArenaState;
  onAction: (actionType: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE') => void;
  isAuto: boolean;
  onToggleAuto: () => void;
}

export const ArenaCanvas: React.FC<ArenaCanvasProps> = ({
  arenaState,
  onAction,
  isAuto,
  onToggleAuto
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw duel stage
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header: status & countdown
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`STATUS: ${arenaState.status} | TURN TIMER: ${arenaState.timeRemaining}s`, canvas.width / 2, 40);

    // Draw P1 Lineup (Left)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`P1: ${arenaState.p1.name || 'Player 1'}`, 60, 100);

    // Draw P2 Lineup (Right)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f43f5e';
    ctx.fillText(`P2: ${arenaState.p2.name || 'Player 2'}`, canvas.width - 60, 100);
  }, [arenaState]);

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl">
      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        className="rounded-lg border border-slate-700 bg-slate-950 shadow-inner"
      />

      <div className="flex items-center gap-4 mt-2">
        <button
          onClick={() => onAction('BASIC_ATTACK')}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 font-bold rounded-lg transition"
        >
          Basic Attack (0 MP)
        </button>
        <button
          onClick={() => onAction('ELEMENTAL_BURST')}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 font-bold rounded-lg transition"
        >
          Elemental Burst (30 MP)
        </button>
        <button
          onClick={() => onAction('ULTIMATE')}
          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 font-bold rounded-lg transition"
        >
          Ultimate (70 MP)
        </button>

        <button
          onClick={onToggleAuto}
          className={`px-5 py-2.5 font-bold rounded-lg transition ${
            isAuto ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          Auto: {isAuto ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
};
