'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArenaState } from '../lib/arena-controller';
import { soundEngine } from '../lib/sound-engine';

export interface ArenaCanvasProps {
  arenaState: ArenaState;
  onAction?: (actionType: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE', targetCardId?: string) => void;
  isAuto?: boolean;
  onToggleAuto?: () => void;
  currentUserId?: string;
  selectedTargetId?: string | null;
  onSelectTarget?: (cardId: string) => void;
}

interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  startY: number;
  startTime: number;
  duration: number;
  color: string;
  fontSize: number;
  isCrit?: boolean;
}

interface AnimatedBar {
  hp: number;
  mana: number;
}

export const ArenaCanvas: React.FC<ArenaCanvasProps> = ({
  arenaState,
  currentUserId,
  selectedTargetId: externalSelectedTargetId,
  onSelectTarget,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Local target selection state if not externally controlled
  const [internalTargetId, setInternalTargetId] = useState<string | null>(null);
  const activeTargetId = externalSelectedTargetId !== undefined ? externalSelectedTargetId : internalTargetId;

  const setTargetId = useCallback(
    (id: string) => {
      if (onSelectTarget) {
        onSelectTarget(id);
      } else {
        setInternalTargetId(id);
      }
    },
    [onSelectTarget]
  );

  // Floating combat numbers list
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // Smooth lerp animated bars: cardId -> { hp, mana }
  const animatedBarsRef = useRef<Record<string, AnimatedBar>>({});

  // Track previous action to spawn floating combat texts
  const prevActionRef = useRef<any>(null);

  // Auto-select lowest HP alive enemy if none is selected
  useEffect(() => {
    const isP1 = currentUserId ? arenaState.p1.id === currentUserId : true;
    const enemyCards = isP1 ? arenaState.p2.cards : arenaState.p1.cards;
    const aliveEnemies = (enemyCards || []).filter((c: any) => (c.currentHp ?? 1) > 0);

    if (aliveEnemies.length > 0) {
      if (!activeTargetId || !aliveEnemies.some((c: any) => c.id === activeTargetId)) {
        setTargetId(aliveEnemies[0].id);
      }
    }
  }, [arenaState, currentUserId, activeTargetId, setTargetId]);

  // Detect new combat action and spawn floating numbers
  useEffect(() => {
    const action = arenaState.lastAction;
    if (!action || action === prevActionRef.current) return;
    prevActionRef.current = action;

    const targetCardId = action.targetCardId;
    if (!targetCardId) return;

    // Locate target card coordinates
    const p1Cards = arenaState.p1.cards || [];
    const p2Cards = arenaState.p2.cards || [];
    const p1Idx = p1Cards.findIndex((c: any) => c.id === targetCardId);
    const p2Idx = p2Cards.findIndex((c: any) => c.id === targetCardId);

    let targetX = 400;
    let targetY = 225;

    if (p1Idx !== -1) {
      targetX = 40 + 160;
      targetY = 115 + p1Idx * 105 + 20;
    } else if (p2Idx !== -1) {
      targetX = 800 - 360 + 160;
      targetY = 115 + p2Idx * 105 + 20;
    }

    const now = performance.now();
    const damage = action.damage ?? 0;
    const isCrit = Boolean(action.isCrit);
    const log = (action.combatLog || '').toLowerCase();

    // Spawn damage floating number
    floatingTextsRef.current.push({
      id: Math.random().toString(),
      text: `-${damage}`,
      x: targetX,
      y: targetY,
      startY: targetY,
      startTime: now,
      duration: 800,
      color: isCrit ? '#f59e0b' : '#ef4444',
      fontSize: isCrit ? 24 : 18,
      isCrit,
    });

    // Check for Divine Shield absorption
    if ((action.shieldAbsorbed && action.shieldAbsorbed > 0) || log.includes('shield absorbed')) {
      floatingTextsRef.current.push({
        id: Math.random().toString(),
        text: '🛡️ BLOCKED!',
        x: targetX,
        y: targetY - 26,
        startY: targetY - 26,
        startTime: now,
        duration: 900,
        color: '#c084fc',
        fontSize: 16,
        isCrit: true,
      });
    }

    // Check for status effect inflicted alerts
    if (action.statusApplied || log.includes('afflicted') || log.includes('frozen') || log.includes('burn')) {
      const eff = action.statusApplied;
      const effType = (typeof eff === 'string' ? eff : eff?.type || '').toLowerCase();

      let alertText = '';
      let alertColor = '#38bdf8';

      if (effType === 'freeze' || log.includes('frozen') || log.includes('freeze')) {
        alertText = '❄️ FROZEN!';
        alertColor = '#38bdf8'; // Cyan
      } else if (effType === 'burn' || log.includes('burn')) {
        alertText = '🔥 BURNED!';
        alertColor = '#ef4444'; // Crimson
      } else if (effType === 'shock' || log.includes('shock')) {
        alertText = '⚡ SHOCKED!';
        alertColor = '#eab308'; // Yellow
      } else if (effType === 'bleed' || log.includes('bleed')) {
        alertText = '🩸 BLEEDING!';
        alertColor = '#f43f5e'; // Rose
      } else if (effType === 'divine_shield' || log.includes('shield')) {
        alertText = '🛡️ SHIELD UP!';
        alertColor = '#c084fc';
      } else if (effType === 'void_siphon' || log.includes('siphon')) {
        alertText = '🌀 SIPHONED!';
        alertColor = '#a855f7';
      }

      if (alertText) {
        floatingTextsRef.current.push({
          id: Math.random().toString(),
          text: alertText,
          x: targetX,
          y: targetY - 48,
          startY: targetY - 48,
          startTime: now + 60,
          duration: 950,
          color: alertColor,
          fontSize: 16,
          isCrit: true,
        });
      }
    }

    // Check for elemental advantage or critical text
    if (isCrit || log.includes('effective') || log.includes('advantage')) {
      floatingTextsRef.current.push({
        id: Math.random().toString(),
        text: 'EFFECTIVE! x1.5',
        x: targetX,
        y: targetY - 24,
        startY: targetY - 24,
        startTime: now,
        duration: 800,
        color: '#ffd700',
        fontSize: 14,
        isCrit: true,
      });
    }

    // Check for Shadow Resonance Lifesteal
    if (action.lifestealHealed && action.lifestealHealed > 0) {
      const actorId = action.actorCardId;
      const p1ActIdx = p1Cards.findIndex((c: any) => c.id === actorId);
      const p2ActIdx = p2Cards.findIndex((c: any) => c.id === actorId);
      let actorX = 400;
      let actorY = 225;
      if (p1ActIdx !== -1) {
        actorX = 40 + 160;
        actorY = 115 + p1ActIdx * 105 + 20;
      } else if (p2ActIdx !== -1) {
        actorX = 800 - 360 + 160;
        actorY = 115 + p2ActIdx * 105 + 20;
      }

      floatingTextsRef.current.push({
        id: Math.random().toString(),
        text: `+${action.lifestealHealed} HP`,
        x: actorX,
        y: actorY - 24,
        startY: actorY - 24,
        startTime: now + 80,
        duration: 850,
        color: '#10b981',
        fontSize: 14,
        isCrit: false,
      });
    }

    // Play corresponding procedural combat sound effect
    const actionType = action.actionType || (log.includes('ultimate') ? 'ULTIMATE' : log.includes('burst') ? 'ELEMENTAL_BURST' : 'BASIC_ATTACK');
    if (actionType === 'ULTIMATE') {
      soundEngine.playUltimate();
    } else if (actionType === 'ELEMENTAL_BURST') {
      soundEngine.playBurst();
    } else {
      soundEngine.playAttack();
    }
  }, [arenaState.lastAction, arenaState.p1.cards, arenaState.p2.cards]);

  // Main Canvas Render & Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Dynamic Arena Background Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#0a0f1d');
      grad.addColorStop(0.5, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle Grid Overlay
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.03)';
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

      // 2. Stage Header (Match Status & Clock)
      ctx.textAlign = 'center';
      if (arenaState.status === 'COMPLETED') {
        const winnerName =
          arenaState.winnerId === arenaState.p1.id
            ? arenaState.p1.name || 'Player 1'
            : arenaState.p2.name || 'Player 2';
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText(`🏆 MATCH COMPLETED — WINNER: ${winnerName.toUpperCase()}`, canvas.width / 2, 38);
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText(`MATCH STATUS: ${arenaState.status}`, canvas.width / 2, 24);

        const timerColor =
          arenaState.timeRemaining <= 3 ? '#ef4444' : arenaState.timeRemaining <= 7 ? '#eab308' : '#22c55e';
        ctx.fillStyle = timerColor;
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText(`⏱️ ${arenaState.timeRemaining}s`, canvas.width / 2, 48);
      }

      // Active Card Turn Sub-banner
      const allCards = [...(arenaState.p1.cards || []), ...(arenaState.p2.cards || [])];
      const activeCard = allCards.find((c: any) => c.id === arenaState.activeCardId);
      if (activeCard && arenaState.status === 'IN_PROGRESS') {
        const activeOwner = arenaState.p1.cards?.some((c: any) => c.id === activeCard.id)
          ? arenaState.p1.name || 'Player 1'
          : arenaState.p2.name || 'Player 2';
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText(
          `⚡ Active Turn: ${activeCard.name || activeCard.role?.toUpperCase() || 'Card'} (${activeOwner})`,
          canvas.width / 2,
          70
        );
      }

      // Team Headers
      ctx.textAlign = 'left';
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`🛡️ P1: ${arenaState.p1.name || 'Player 1'}`, 40, 95);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`⚔️ P2: ${arenaState.p2.name || 'Player 2'}`, canvas.width - 40, 95);

      // Active Resonance Passives Display (Top Corners)
      const p1Resonance = arenaState.p1Resonance || (arenaState.p1 as any)?.resonance || [];
      const p2Resonance = arenaState.p2Resonance || (arenaState.p2 as any)?.resonance || [];

      // P1 Resonance Banner (Top-Left)
      if (p1Resonance && p1Resonance.length > 0) {
        let p1Rx = 40;
        for (const buff of p1Resonance) {
          const badgeText = buff.badge || buff.name || 'Resonance';
          ctx.save();
          ctx.font = 'bold 10px system-ui, sans-serif';
          const tw = ctx.measureText(badgeText).width + 14;

          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 8;
          ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(p1Rx, 48, tw, 18, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'left';
          ctx.fillText(badgeText, p1Rx + 7, 61);
          ctx.restore();

          p1Rx += tw + 6;
        }
      }

      // P2 Resonance Banner (Top-Right)
      if (p2Resonance && p2Resonance.length > 0) {
        let p2Rx = canvas.width - 40;
        for (const buff of p2Resonance) {
          const badgeText = buff.badge || buff.name || 'Resonance';
          ctx.save();
          ctx.font = 'bold 10px system-ui, sans-serif';
          const tw = ctx.measureText(badgeText).width + 14;
          const startX = p2Rx - tw;

          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 8;
          ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(startX, 48, tw, 18, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f43f5e';
          ctx.textAlign = 'left';
          ctx.fillText(badgeText, startX + 7, 61);
          ctx.restore();

          p2Rx -= (tw + 6);
        }
      }

      // 3. Card Renderer with Smooth Interpolation & Spotlight
      const renderCard = (card: any, x: number, y: number, isP1: boolean) => {
        const w = 320;
        const h = 98;
        const isDead = (card.currentHp ?? 1) <= 0;
        const isActive = card.id === arenaState.activeCardId;
        const isTarget = card.id === activeTargetId;

        // Linear interpolation for smooth HP & Mana bars
        if (!animatedBarsRef.current[card.id]) {
          animatedBarsRef.current[card.id] = {
            hp: card.currentHp ?? card.maxHp ?? 1000,
            mana: card.currentMana ?? 50,
          };
        }
        const animated = animatedBarsRef.current[card.id];
        const targetHp = Math.max(0, card.currentHp ?? 1000);
        const targetMana = Math.max(0, card.currentMana ?? 50);

        // Lerp step: 15% delta towards target per frame
        animated.hp += (targetHp - animated.hp) * 0.15;
        animated.mana += (targetMana - animated.mana) * 0.15;

        // Active Turn Spotlight: Pulsating Neon Aura
        if (isActive && !isDead) {
          const pulse = (Math.sin(time / 200) + 1) / 2; // 0 to 1
          ctx.save();
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 10 + pulse * 14;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 11);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();

        // Card Container Background & Border
        ctx.fillStyle = isDead ? '#1e293b' : isActive ? '#1e1b4b' : '#0f172a';
        ctx.strokeStyle = isActive ? '#fbbf24' : isTarget ? '#ef4444' : isP1 ? '#0284c7' : '#e11d48';
        ctx.lineWidth = isActive ? 3 : isTarget ? 2.5 : 1.5;

        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 8);
        ctx.fill();
        ctx.stroke();

        // Card Name & Role Badge
        ctx.textAlign = 'left';
        ctx.font = 'bold 13px system-ui, sans-serif';
        const roleText = (card.role || 'Card').toUpperCase();
        const cardIdClean = (card.id || '').replace(/#/g, '');
        const cardName = card.name || `${card.variant || ''} ${card.race || ''}`.trim() || `Card ${cardIdClean}`;
        ctx.fillStyle = isDead ? '#64748b' : '#f8fafc';
        ctx.fillText(`${cardName} [${roleText}]`, x + 10, y + 18);

        // Element, ID & Stats Info
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillStyle = '#94a3b8';
        const elemText = card.element ? `${card.element.toUpperCase()} (${card.elementTier || 'A'})` : 'Neutral';
        const pwrText = card.powerScore ? `PWR: ${card.powerScore}` : '';
        const idText = cardIdClean ? `ID: ${cardIdClean}` : '';
        ctx.fillText(`${elemText} | ${idText} | ATK: ${card.atk ?? 100} | DEF: ${card.def ?? 50} ${pwrText}`, x + 10, y + 33);

        // Smooth Animated HP Bar
        const maxHp = card.maxHp || 1000;
        const curHpDisplay = Math.round(animated.hp);
        const hpPct = Math.max(0, Math.min(1, animated.hp / maxHp));

        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 10, y + 40, w - 20, 10);
        ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';
        ctx.fillRect(x + 10, y + 40, (w - 20) * hpPct, 10);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`HP: ${curHpDisplay} / ${maxHp}`, x + w / 2, y + 48);

        // Smooth Animated Mana Bar
        const maxMana = card.maxMana || 100;
        const curManaDisplay = Math.round(animated.mana);
        const manaPct = Math.max(0, Math.min(1, animated.mana / maxMana));

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 10, y + 54, w - 20, 8);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x + 10, y + 54, (w - 20) * manaPct, 8);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '8px system-ui, sans-serif';
        ctx.fillText(`MP: ${curManaDisplay} / ${maxMana}`, x + w / 2, y + 61);

        // Status Effect Badges (Glowing icons & remaining turn counters)
        if (!isDead && card.statusEffects && card.statusEffects.length > 0) {
          let badgeX = x + 10;
          const badgeY = y + 68;

          for (const eff of card.statusEffects) {
            const effType = (eff.type || '').toLowerCase();
            let icon = eff.icon || '✨';
            let color = '#38bdf8';
            let bg = 'rgba(56, 189, 248, 0.2)';

            if (effType === 'burn') {
              icon = '🔥';
              color = '#ef4444';
              bg = 'rgba(239, 68, 68, 0.25)';
            } else if (effType === 'freeze') {
              icon = '❄️';
              color = '#38bdf8';
              bg = 'rgba(56, 189, 248, 0.25)';
            } else if (effType === 'shock') {
              icon = '⚡';
              color = '#eab308';
              bg = 'rgba(234, 179, 8, 0.25)';
            } else if (effType === 'bleed') {
              icon = '🩸';
              color = '#f43f5e';
              bg = 'rgba(244, 63, 94, 0.25)';
            } else if (effType === 'divine_shield') {
              icon = '🛡️';
              color = '#a855f7';
              bg = 'rgba(168, 85, 247, 0.25)';
            } else if (effType === 'void_siphon') {
              icon = '🌀';
              color = '#8b5cf6';
              bg = 'rgba(139, 92, 246, 0.25)';
            }

            const label =
              eff.type === 'bleed' && eff.potency && eff.potency > 1
                ? `${icon} x${eff.potency}`
                : `${icon} ${eff.duration ?? 1}T`;

            ctx.save();
            ctx.font = 'bold 9px system-ui, sans-serif';
            const textWidth = ctx.measureText(label).width;
            const badgeW = Math.max(36, textWidth + 8);
            const badgeH = 15;

            ctx.shadowColor = color;
            ctx.shadowBlur = 6;
            ctx.fillStyle = bg;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(label, badgeX + badgeW / 2, badgeY + 11);
            ctx.restore();

            badgeX += badgeW + 6;
            if (badgeX > x + w - 45) break;
          }
        }

        // Target / Active / Defeated Badges
        if (isDead) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 16px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('💀 DEFEATED', x + w / 2, y + h / 2 + 5);
        } else if (isActive) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 10px system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('⚡ ACTIVE TURN', x + w - 10, y + 18);
        } else if (isTarget) {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 10px system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('🎯 TARGET', x + w - 10, y + 18);
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

      // Center VS Divider
      ctx.textAlign = 'center';
      ctx.font = 'italic bold 28px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillText('VS', canvas.width / 2, 275);

      // 4. Render Floating Combat Numbers with 800ms Upward Drift & Fade Out
      const now = performance.now();
      floatingTextsRef.current = floatingTextsRef.current.filter((ft) => {
        const elapsed = now - ft.startTime;
        if (elapsed >= ft.duration) return false;

        const progress = elapsed / ft.duration; // 0 to 1
        const alpha = Math.max(0, 1 - progress);
        const yDrift = ft.startY - progress * 45;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${ft.fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'center';

        // Glow drop shadow
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = ft.isCrit ? 16 : 8;
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, yDrift);
        ctx.restore();

        return true;
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [arenaState, activeTargetId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    soundEngine.unlock();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check P2 cards (right side)
    const p2Cards = arenaState.p2.cards || [];
    p2Cards.forEach((c: any, i: number) => {
      const cardX = canvas.width - 360;
      const cardY = 115 + i * 105;
      if (x >= cardX && x <= cardX + 320 && y >= cardY && y <= cardY + 98) {
        if ((c.currentHp ?? 1) > 0) {
          setTargetId(c.id);
        }
      }
    });

    // Check P1 cards (left side)
    const p1Cards = arenaState.p1.cards || [];
    p1Cards.forEach((c: any, i: number) => {
      const cardX = 40;
      const cardY = 115 + i * 105;
      if (x >= cardX && x <= cardX + 320 && y >= cardY && y <= cardY + 98) {
        if ((c.currentHp ?? 1) > 0) {
          setTargetId(c.id);
        }
      }
    });
  };

  return (
    <div className="relative w-full h-full max-h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        onClick={handleCanvasClick}
        className="rounded-2xl border border-slate-800 bg-slate-950 shadow-[0_0_40px_rgba(0,0,0,0.8)] cursor-crosshair max-w-full max-h-full object-contain"
        style={{ aspectRatio: '16/9' }}
      />
    </div>
  );
};
