'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArenaCanvas } from '../../../components/ArenaCanvas';
import { ArenaController, ArenaState } from '../../../lib/arena-controller';
import {
  getDevSessionFromQuery,
  getClientSessionCookie,
  createMockSessionToken,
  SessionValidationResult,
} from '../../../lib/auth-session';

function DuelRoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = (params?.roomId as string) || '';
  const asParam = searchParams.get('as');

  const [controller] = useState(() => new ArenaController());
  const [state, setState] = useState<ArenaState>(() => controller.getState());
  const [isAuto, setIsAuto] = useState<boolean>(() => controller.isAutoBattleEnabled());

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

  const handleAction = (type: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE', targetCardId?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Local fallback for offline testing
      controller.executeAction(type, targetCardId || 'target-id');
      return;
    }

    const payload = {
      actionType: type,
      targetCardId: targetCardId || '',
    };

    wsRef.current.send(
      JSON.stringify({
        type: 'EXECUTE_ACTION',
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

  // If no session is active and no ?as= query is supplied, show the Dev Authentication Bypass Selector
  if (!session?.userId) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white">
        <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center">
          <div className="text-4xl mb-3">⚔️</div>
          <h1 className="text-2xl font-black text-amber-400 mb-2">CJVerse Duel Arena</h1>
          <p className="text-slate-400 text-sm mb-6">
            Room: <span className="font-mono text-indigo-400 font-bold">{roomId}</span>
          </p>

          <p className="text-slate-300 text-sm mb-6">
            Select a player role to join the local battle session without Discord OAuth:
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                const s: SessionValidationResult = {
                  isValid: true,
                  userId: 'dev-player-1',
                  username: 'Challenger (P1)',
                };
                setSession(s);
              }}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl shadow-lg transition active:scale-98 flex items-center justify-center gap-2"
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
              className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-500 font-bold rounded-xl shadow-lg transition active:scale-98 flex items-center justify-center gap-2"
            >
              ⚔️ Play as Opponent (Player 2)
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-500">
            Tip: Append <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">?as=p1</code> or{' '}
            <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">?as=p2</code> to URL to automate.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-white">
      <div className="mb-4 text-center">
        <h1 className="text-3xl font-extrabold text-amber-400">CJVerse Skirmish Arena</h1>
        <div className="flex items-center justify-center gap-4 text-slate-400 text-sm mt-1">
          <span>
            Room ID: <span className="font-mono text-indigo-400 font-bold">{roomId}</span>
          </span>
          <span>•</span>
          <span>
            Role: <span className="font-bold text-emerald-400">{session.username || session.userId}</span>
          </span>
          <span>•</span>
          <span
            className={`font-semibold flex items-center gap-1.5 ${
              connectionStatus === 'CONNECTED'
                ? 'text-emerald-400'
                : connectionStatus === 'CONNECTING'
                ? 'text-yellow-400'
                : 'text-rose-400'
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
            {connectionStatus}
          </span>
        </div>
      </div>

      <ArenaCanvas
        arenaState={state}
        onAction={handleAction}
        isAuto={isAuto}
        onToggleAuto={handleToggleAuto}
        currentUserId={session.userId}
      />
    </main>
  );
}

export default function DuelRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <div className="text-lg font-bold text-slate-400 animate-pulse">Loading CJVerse Arena...</div>
        </div>
      }
    >
      <DuelRoomContent />
    </Suspense>
  );
}
