'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArenaCanvas } from '../../../components/ArenaCanvas';
import { BattleResultModal } from '../../../components/BattleResultModal';
import { ArenaController, ArenaState } from '../../../lib/arena-controller';
import {
  getDevSessionFromQuery,
  getClientSessionCookie,
  createMockSessionToken,
  SessionValidationResult,
} from '../../../lib/auth-session';

function getLogEntryColor(log: string): string {
  const lower = log.toLowerCase();
  if (lower.includes('crit') || lower.includes('effective') || lower.includes('burst') || lower.includes('ultimate')) {
    return 'text-amber-400 font-semibold';
  }
  if (lower.includes('dmg') || lower.includes('damage') || lower.includes('defeated') || lower.includes('fell')) {
    return 'text-rose-400';
  }
  if (lower.includes('heal') || lower.includes('regen') || lower.includes('buff') || lower.includes('shield')) {
    return 'text-emerald-400';
  }
  if (lower.includes('turn') || lower.includes('clock') || lower.includes('match') || lower.includes('initiative')) {
    return 'text-slate-400 italic';
  }
  return 'text-slate-300';
}

function DuelRoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = (params?.roomId as string) || '';
  const asParam = searchParams.get('as');

  const [controller] = useState(() => new ArenaController());
  const [state, setState] = useState<ArenaState>(() => controller.getState());
  const [isAuto, setIsAuto] = useState<boolean>(() => controller.isAutoBattleEnabled());
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // Active user session state (supports Discord cookie or Dev bypass ?as=)
  const [session, setSession] = useState<SessionValidationResult | null>(() => {
    // 1. Query override ?as= (dev mode or local testing)
    const fromQuery = getDevSessionFromQuery(asParam);
    if (fromQuery?.isValid) return fromQuery;

    // 2. Cookie session
    const fromCookie = getClientSessionCookie();
    if (fromCookie?.isValid) return fromCookie;

    return null;
  });

  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('DISCONNECTED');
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll combat log to latest event
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.combatLog]);

  // Update session if ?as= changes dynamically
  useEffect(() => {
    if (asParam) {
      const dev = getDevSessionFromQuery(asParam);
      if (dev?.isValid) {
        setSession(dev);
      }
    }
  }, [asParam]);

  // Connect to WebSocket Game Server when session & roomId are ready
  useEffect(() => {
    if (!roomId || !session?.userId) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setConnectionStatus('CONNECTING');

    ws.onopen = () => {
      setConnectionStatus('CONNECTED');
      // Send JOIN_ROOM handshake
      const token = createMockSessionToken(session.userId!, session.username || 'Duelist');
      ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          roomId,
          userId: session.userId,
          payload: {
            roomId,
            userId: session.userId,
            token,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        controller.handleMessage(msg);
        setState({ ...controller.getState() });
      } catch (err) {
        console.error('[Web Arena] Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('DISCONNECTED');
    };

    ws.onerror = (err) => {
      console.warn('[Web Arena] WebSocket connection error:', err);
      setConnectionStatus('DISCONNECTED');
    };

    return () => {
      ws.close();
    };
  }, [roomId, session?.userId, controller]);

  const handleAction = (type: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE') => {
    const targetId = selectedTargetId || 'target-id';

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Local fallback for offline testing
      controller.executeAction(type, targetId);
      return;
    }

    const payload = {
      actionType: type,
      targetCardId: targetId,
    };

    // Emit PLAYER_ACTION to the WebSocket game server
    wsRef.current.send(
      JSON.stringify({
        type: 'PLAYER_ACTION',
        roomId,
        action: type,
        targetCardId: targetId,
        payload,
      })
    );
  };

  const handleToggleAuto = () => {
    const updated = controller.toggleAutoBattle();
    setIsAuto(updated);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'TOGGLE_AUTO',
          payload: { enabled: updated },
        })
      );
    }
  };

  const handleRematch = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Determine active card and available actions
  const allCards = useMemo(() => {
    return [...(state.p1?.cards || []), ...(state.p2?.cards || [])];
  }, [state.p1, state.p2]);

  const activeCard = useMemo(() => {
    return allCards.find((c: any) => c.id === state.activeCardId);
  }, [allCards, state.activeCardId]);

  const isUserP2 = useMemo(() => {
    if (!session?.userId) return false;
    return session.userId === state.p2?.id || session.userId === 'dev-player-2' || session.userId === 'p2';
  }, [session?.userId, state.p2?.id]);

  const myCards = isUserP2 ? state.p2?.cards : state.p1?.cards;

  const isMyCardActive = Boolean(
    activeCard &&
    (
      (activeCard.playerId && activeCard.playerId === session?.userId) ||
      (myCards && myCards.some((c: any) => c.id === activeCard.id))
    )
  );

  const isMyTurn = state.status === 'IN_PROGRESS' && isMyCardActive;
  const activeMana = activeCard?.currentMana ?? 0;

  const canBasicAttack = isMyTurn;
  const canElementalBurst = isMyTurn && activeMana >= 30;
  const canUltimate = isMyTurn && activeMana >= 70;

  const isWinner = Boolean(
    state.winnerId &&
    (
      (session?.userId && state.winnerId === session.userId) ||
      (session?.userId === 'dev-player-1' && state.winnerId === state.p1?.id) ||
      (session?.userId === 'dev-player-2' && state.winnerId === state.p2?.id) ||
      (!session?.userId && state.winnerId === state.p1?.id)
    )
  );

  // If no session is active and no ?as= query is supplied, show the Dev Authentication Bypass Selector
  if (!session?.userId) {
    return (
      <main className="min-h-screen bg-slate-950 bg-arena-grid bg-arena-radial flex flex-col items-center justify-center p-6 text-white">
        <div className="max-w-md w-full p-8 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl text-center">
          <div className="text-5xl mb-3 animate-pulse">⚔️</div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 mb-2">
            CJVerse Arena
          </h1>
          <p className="text-slate-400 text-sm mb-6">
            Room: <span className="font-mono text-cyan-400 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">{roomId}</span>
          </p>

          <p className="text-slate-300 text-sm mb-6">
            Select an active fighter persona to enter the battle arena without Discord OAuth:
          </p>

          <div className="flex flex-col gap-3.5">
            <button
              onClick={() => {
                const s: SessionValidationResult = {
                  isValid: true,
                  userId: 'dev-player-1',
                  username: 'Challenger (P1)',
                };
                setSession(s);
              }}
              className="w-full py-4 px-5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 font-black rounded-xl shadow-lg shadow-blue-500/25 transition active:scale-98 flex items-center justify-center gap-2"
            >
              🛡️ Play as Challenger (Player 1)
            </button>

            <button
              onClick={() => {
                const s: SessionValidationResult = {
                  isValid: true,
                  userId: 'dev-player-2',
                  username: 'Opponent (P2)',
                };
                setSession(s);
              }}
              className="w-full py-4 px-5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 font-black rounded-xl shadow-lg shadow-rose-500/25 transition active:scale-98 flex items-center justify-center gap-2"
            >
              ⚔️ Play as Opponent (Player 2)
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-500">
            Dev Quick-Link: Append <code className="text-indigo-300 bg-slate-800/80 px-1 py-0.5 rounded">?as=p1</code> or{' '}
            <code className="text-indigo-300 bg-slate-800/80 px-1 py-0.5 rounded">?as=p2</code> to URL.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 bg-arena-grid bg-arena-radial flex flex-col items-center p-4 md:p-6 text-white select-none">
      {/* 1. Custom Header: Room details, Player badges & Connection indicator */}
      <header className="w-full max-w-5xl mb-4 glass-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-xl font-black">
            ⚔️
          </div>
          <div>
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 leading-tight">
              CJVERSE SKIRMISH ARENA
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Room:</span>
              <span className="font-mono text-cyan-400 font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
                #{roomId}
              </span>
            </div>
          </div>
        </div>

        {/* Player Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-blue-950/60 border border-blue-500/30 px-3 py-1.5 rounded-xl shadow-sm">
            <span className="text-sm">🛡️</span>
            <div className="text-left">
              <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Challenger</div>
              <div className="text-xs font-black text-blue-100">{state.p1?.name || 'Player 1'}</div>
            </div>
          </div>

          <span className="text-slate-600 font-black italic text-xs">VS</span>

          <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-500/30 px-3 py-1.5 rounded-xl shadow-sm">
            <span className="text-sm">⚔️</span>
            <div className="text-left">
              <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Opponent</div>
              <div className="text-xs font-black text-rose-100">{state.p2?.name || 'Player 2'}</div>
            </div>
          </div>
        </div>

        {/* Connection Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Role</div>
            <div className="text-xs font-black text-emerald-400">{session.username || session.userId}</div>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border transition-all ${
              connectionStatus === 'CONNECTED'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : connectionStatus === 'CONNECTING'
                ? 'bg-yellow-950/60 text-yellow-300 border-yellow-500/40'
                : 'bg-rose-950/60 text-rose-300 border-rose-500/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-400 animate-pulse'
                  : connectionStatus === 'CONNECTING'
                  ? 'bg-yellow-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <span>{connectionStatus === 'CONNECTED' ? '● CONNECTED' : connectionStatus}</span>
          </div>
        </div>
      </header>

      {/* PvP Waiting Banner */}
      {state.status === 'WAITING' &&
        !(
          state.p2?.id &&
          (state.p2.id.toUpperCase().includes('BOT') || state.p2.id.toLowerCase().startsWith('bot'))
        ) && (
          <div className="w-full max-w-5xl mb-4 p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl flex items-center justify-between flex-wrap gap-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2.5 text-amber-300 font-bold text-sm">
              <span className="text-xl animate-spin">⏳</span>
              <span>Waiting for Player 2 to join the skirmish...</span>
            </div>
            <a
              href={
                typeof window !== 'undefined'
                  ? `${window.location.origin}/duel/${roomId}?as=${state.p2?.id || 'dev-player-2'}`
                  : `/duel/${roomId}?as=p2`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl transition shadow-lg text-sm active:scale-95"
            >
              🔗 Open Player 2 view in a new window ↗
            </a>
          </div>
        )}

      {/* 2. Interactive Canvas Arena Stage with Visual FX */}
      <ArenaCanvas
        arenaState={state}
        currentUserId={session.userId}
        selectedTargetId={selectedTargetId}
        onSelectTarget={setSelectedTargetId}
      />

      {/* 3. Modernized Action Bar */}
      <section className="w-full max-w-5xl mt-4 glass-panel rounded-2xl p-4 flex flex-col items-center gap-3 shadow-2xl">
        {/* Turn Status Badge */}
        {state.status === 'IN_PROGRESS' && (
          <div className="text-xs font-bold tracking-wide">
            {isMyCardActive ? (
              <span className="text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-4 py-1.5 rounded-full inline-flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>YOUR TURN — Active: <strong className="text-white">{activeCard?.name || 'Your Card'}</strong> (MP: {activeMana})</span>
              </span>
            ) : (
              <span className="text-amber-300 bg-amber-950/80 border border-amber-500/50 px-4 py-1.5 rounded-full inline-flex items-center gap-2">
                <span>⏳ OPPONENT'S TURN — Waiting for <strong className="text-white">{activeCard?.name || 'Opponent'}</strong>...</span>
              </span>
            )}
          </div>
        )}

        {/* Action Button Row */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 w-full">
          {/* Basic Attack: Silver metallic with hover glow */}
          <button
            id="action-basic-attack"
            onClick={() => handleAction('BASIC_ATTACK')}
            disabled={!canBasicAttack}
            className="btn-basic-attack disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3 font-extrabold rounded-xl text-slate-100 flex items-center gap-2 text-sm uppercase tracking-wide active:scale-95 shadow-md"
          >
            <span>⚔️</span>
            <span>Basic Attack</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-600/50">0 MP</span>
          </button>

          {/* Elemental Burst: Indigo/cyan energetic glow */}
          <button
            id="action-elemental-burst"
            onClick={() => handleAction('ELEMENTAL_BURST')}
            disabled={!canElementalBurst}
            className="btn-elemental-burst disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3 font-extrabold rounded-xl text-white flex items-center gap-2 text-sm uppercase tracking-wide active:scale-95 shadow-md"
          >
            <span>💥</span>
            <span>Elemental Burst</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 font-black">30 MP</span>
          </button>

          {/* Ultimate: Golden glowing gradient button (disabled if MP < 70) */}
          <button
            id="action-ultimate"
            onClick={() => handleAction('ULTIMATE')}
            disabled={!canUltimate}
            className="btn-ultimate disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3 font-extrabold rounded-xl text-slate-950 flex items-center gap-2 text-sm uppercase tracking-wide active:scale-95 shadow-md"
          >
            <span>🌟</span>
            <span>Ultimate</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/50 font-black">70 MP</span>
          </button>

          {/* Auto-Battle Toggle: Sleek pill toggle switch */}
          <button
            id="toggle-auto-battle"
            onClick={handleToggleAuto}
            className={`px-5 py-3 rounded-full font-bold text-sm flex items-center gap-2.5 transition-all shadow-lg active:scale-95 border ${
              isAuto
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isAuto ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            <span>AUTO: <strong>{isAuto ? 'ON' : 'OFF'}</strong></span>
          </button>
        </div>
      </section>

      {/* 4. Stylized Combat Log with Glassmorphism & Color Coding */}
      <section className="w-full max-w-5xl mt-4 glass-panel rounded-2xl p-4 shadow-xl text-left">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
            <span>📜</span>
            <span>Combat Event Log</span>
          </div>
          <span className="text-[10px] text-slate-500">Live authoritative resolutions</span>
        </div>

        <div className="combat-log-scroll max-h-40 overflow-y-auto font-mono text-xs space-y-1.5 pr-2">
          {state.combatLog && state.combatLog.length > 0 ? (
            state.combatLog.map((log, idx) => (
              <div key={idx} className={`py-0.5 leading-relaxed flex items-start gap-2 ${getLogEntryColor(log)}`}>
                <span className="text-slate-600 select-none">›</span>
                <span>{log}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-600 italic py-2">Combat logs will stream here as attacks and skills resolve.</div>
          )}
          <div ref={logEndRef} />
        </div>
      </section>

      {/* 5. Victory & Defeat Modal */}
      <BattleResultModal
        isOpen={state.status === 'COMPLETED'}
        isWinner={isWinner}
        crystalsAwarded={state.matchEnd?.crystalsAwarded ?? 50}
        winnerName={state.winnerId === state.p1?.id ? state.p1?.name : state.p2?.name}
        onRematch={handleRematch}
        onReturnToDiscord={() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/duel';
          }
        }}
      />
    </main>
  );
}

export default function DuelRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 bg-arena-grid flex items-center justify-center text-white">
          <div className="text-lg font-black text-cyan-400 animate-pulse flex items-center gap-3">
            <span className="text-2xl animate-spin">⚔️</span>
            <span>Entering CJVerse Arena...</span>
          </div>
        </div>
      }
    >
      <DuelRoomContent />
    </Suspense>
  );
}
