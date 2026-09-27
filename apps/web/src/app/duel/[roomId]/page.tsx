'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArenaCanvas } from '../../../components/ArenaCanvas';
import { BattleResultModal } from '../../../components/BattleResultModal';
import { ArenaController, ArenaState } from '../../../lib/arena-controller';
import { soundEngine } from '../../../lib/sound-engine';
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
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING');
  const [isMuted, setIsMuted] = useState<boolean>(() => soundEngine.isMuted());

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

  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(() => {
    if (asParam && getDevSessionFromQuery(asParam)?.isValid) return false;
    return true;
  });

  const wsRef = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const matchEndAudioPlayedRef = useRef<boolean>(false);

  // Directly scroll the internal combat log container to the bottom without page-jumping
  useEffect(() => {
    const el = logContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.combatLog]);

  // Subscribe to audio mute changes
  useEffect(() => {
    return soundEngine.subscribe((muted) => {
      setIsMuted(muted);
    });
  }, []);

  // Unlock AudioContext on first user interaction (browser autoplay policy)
  useEffect(() => {
    const unlockAudio = () => {
      soundEngine.unlock();
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const handleToggleMute = () => {
    const newMuted = soundEngine.toggleMute();
    setIsMuted(newMuted);
  };

  // Update session if ?as= changes dynamically in dev
  useEffect(() => {
    if (asParam) {
      const dev = getDevSessionFromQuery(asParam);
      if (dev?.isValid) {
        setSession(dev);
        setIsLoadingAuth(false);
      }
    }
  }, [asParam]);

  // Check server session via /api/auth/me for Discord OAuth users
  useEffect(() => {
    if (asParam && getDevSessionFromQuery(asParam)?.isValid) {
      setIsLoadingAuth(false);
      return;
    }

    let isMounted = true;
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.authenticated && data.user) {
          setSession({
            isValid: true,
            userId: data.user.userId,
            username: data.user.username,
            avatar: data.user.avatar,
            crystals: data.user.crystals,
          });
        }
      })
      .catch((err) => {
        console.warn('[Web Arena] Session verification error:', err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingAuth(false);
        }
      });

    return () => {
      isMounted = false;
    };
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
      const token = session.token || createMockSessionToken(session.userId!, session.username || 'Duelist', session.avatar);
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

        if (msg.type === 'ACTION_RESOLVED' && msg.payload) {
          const actionType = msg.payload.actionType;
          if (actionType === 'ULTIMATE') {
            soundEngine.playUltimate();
          } else if (actionType === 'ELEMENTAL_BURST') {
            soundEngine.playBurst();
          } else {
            soundEngine.playAttack();
          }
        }

        if (msg.type === 'MATCH_END' && msg.payload) {
          const { winnerId, crystalsAwarded } = msg.payload;
          if (
            (session?.userId && winnerId === session.userId) ||
            (session?.userId === 'dev-player-1' && winnerId === state.p1?.id) ||
            (session?.userId === 'dev-player-2' && winnerId === state.p2?.id)
          ) {
            setSession((prev) =>
              prev ? { ...prev, crystals: (prev.crystals ?? 100) + (crystalsAwarded ?? 50) } : prev
            );
          }
        }
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
  }, [roomId, session?.userId, controller, state.p1?.id, state.p2?.id]);

  // Trigger playTimerTick() when timer <= 5 seconds in active duel
  useEffect(() => {
    const time = state.timeRemaining;
    if (state.status === 'IN_PROGRESS' && time <= 5 && time > 0 && time !== lastTickRef.current) {
      lastTickRef.current = time;
      soundEngine.playTimerTick();
    } else if (time > 5) {
      lastTickRef.current = null;
    }
  }, [state.timeRemaining, state.status]);

  const handleAction = (type: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE') => {
    soundEngine.unlock();
    const targetId = selectedTargetId || 'target-id';

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Local fallback for offline testing
      if (type === 'ULTIMATE') soundEngine.playUltimate();
      else if (type === 'ELEMENTAL_BURST') soundEngine.playBurst();
      else soundEngine.playAttack();

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

  // Trigger playVictory() or playDefeat() on match conclusion
  useEffect(() => {
    if (state.status === 'COMPLETED' && !matchEndAudioPlayedRef.current) {
      matchEndAudioPlayedRef.current = true;
      if (isWinner) {
        soundEngine.playVictory();
      } else {
        soundEngine.playDefeat();
      }
    } else if (state.status === 'IN_PROGRESS') {
      matchEndAudioPlayedRef.current = false;
    }
  }, [state.status, isWinner]);

  if (isLoadingAuth && !session?.userId) {
    return (
      <main className="min-h-screen bg-slate-950 bg-arena-grid bg-arena-radial flex flex-col items-center justify-center p-6 text-white select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-2xl animate-spin">
            ⚔️
          </div>
          <div className="text-sm font-bold text-slate-300 animate-pulse">
            Verifying Discord Session...
          </div>
        </div>
      </main>
    );
  }

  // If unauthenticated, display the "Sign in with Discord to enter Skirmish Arena" modal
  if (!session?.userId) {
    return (
      <main className="min-h-screen bg-slate-950 bg-arena-grid bg-arena-radial flex flex-col items-center justify-center p-6 text-white select-none">
        <div className="max-w-md w-full p-8 bg-slate-900/90 border border-indigo-500/30 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.8)] backdrop-blur-xl text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/40 flex items-center justify-center mx-auto mb-5 text-4xl shadow-[0_0_30px_rgba(99,102,241,0.25)]">
            ⚔️
          </div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 mb-3 tracking-wide">
            Sign in with Discord to enter Skirmish Arena
          </h1>
          <p className="text-slate-400 text-xs mb-3">
            Room: <span className="font-mono text-cyan-400 font-bold bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">#{roomId}</span>
          </p>
          <p className="text-slate-300 text-sm mb-7 leading-relaxed">
            Connect your Discord account to synchronize your lineup cards, track crystal rewards, and battle opponents in authoritative real-time combat.
          </p>

          <a
            href={`/api/auth/discord/login?returnTo=/duel/${roomId}`}
            id="discord-login-btn"
            className="w-full py-4 px-6 bg-[#5865F2] hover:bg-[#4752C4] text-white font-black rounded-2xl shadow-xl shadow-[#5865F2]/30 transition-all duration-200 active:scale-98 flex items-center justify-center gap-3 text-sm uppercase tracking-wider"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            <span>Login with Discord</span>
          </a>

          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-8 pt-5 border-t border-slate-800/80">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                Local Dev Testing Bypass (?as=)
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => {
                    const s: SessionValidationResult = {
                      isValid: true,
                      userId: 'dev-player-1',
                      username: 'Challenger (P1)',
                      avatar: null,
                      crystals: 100,
                    };
                    setSession(s);
                  }}
                  className="py-2.5 px-3 bg-blue-950/50 hover:bg-blue-900/50 border border-blue-500/30 text-blue-300 font-bold rounded-xl transition active:scale-95"
                >
                  🛡️ Player 1 (Dev)
                </button>
                <button
                  onClick={() => {
                    const s: SessionValidationResult = {
                      isValid: true,
                      userId: 'dev-player-2',
                      username: 'Opponent (P2)',
                      avatar: null,
                      crystals: 100,
                    };
                    setSession(s);
                  }}
                  className="py-2.5 px-3 bg-rose-950/50 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 font-bold rounded-xl transition active:scale-95"
                >
                  ⚔️ Player 2 (Dev)
                </button>
              </div>
              <div className="mt-3 text-[11px] text-slate-500">
                Or append <code className="text-indigo-300 bg-slate-800/80 px-1 py-0.5 rounded">?as=p1</code> or{' '}
                <code className="text-indigo-300 bg-slate-800/80 px-1 py-0.5 rounded">?as=p2</code> to the URL.
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-h-screen h-screen overflow-hidden bg-slate-950 bg-arena-grid bg-arena-radial flex flex-col items-center justify-between p-2 md:p-3 text-white select-none">
      <div className="w-full max-w-5xl h-full flex flex-col justify-between items-center overflow-hidden gap-2">
        {/* 1. Custom Header: Room details, Player badges & Connection indicator */}
        <header className="w-full shrink-0 glass-panel rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-lg font-black">
              ⚔️
            </div>
            <div>
              <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 leading-tight">
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
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-blue-950/60 border border-blue-500/30 px-2.5 py-1 rounded-xl shadow-sm">
              <span className="text-sm">🛡️</span>
              <div className="text-left">
                <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Challenger</div>
                <div className="text-xs font-black text-blue-100">{state.p1?.name || 'Player 1'}</div>
              </div>
            </div>

            <span className="text-slate-600 font-black italic text-xs">VS</span>

            <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-500/30 px-2.5 py-1 rounded-xl shadow-sm">
              <span className="text-sm">⚔️</span>
              <div className="text-left">
                <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Opponent</div>
                <div className="text-xs font-black text-rose-100">{state.p2?.name || 'Player 2'}</div>
              </div>
            </div>
          </div>

          {/* User Profile & Connection Status Indicator */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Authenticated Player Profile Badge */}
            <div className="flex items-center gap-2.5 bg-slate-900/80 border border-slate-700/60 pl-2 pr-3 py-1 rounded-xl shadow-inner">
              {session.avatar ? (
                <img
                  src={session.avatar}
                  alt={session.username || 'User Avatar'}
                  className="w-8 h-8 rounded-full border border-indigo-400/50 shadow-md object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs shadow-md text-white">
                  {(session.username || session.userId || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <div className="text-xs font-black text-slate-100 leading-tight max-w-[120px] truncate">
                  {session.username || session.userId}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-extrabold text-cyan-300">
                  <span>💎</span>
                  <span>{session.crystals ?? 100} Crystals</span>
                </div>
              </div>
            </div>

            {/* Audio Mute Toggle Button */}
            <button
              id="toggle-audio-mute"
              onClick={handleToggleMute}
              title={isMuted ? 'Sound: Muted (Click to Unmute)' : 'Sound: Enabled (Click to Mute)'}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className={`p-2 rounded-xl border transition-all duration-200 flex items-center justify-center ${
                isMuted
                  ? 'bg-rose-950/50 border-rose-500/40 text-rose-400 hover:bg-rose-900/60 hover:text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                  : 'bg-slate-900/80 border-slate-700/60 text-cyan-300 hover:bg-slate-800/80 hover:text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
              }`}
            >
              {isMuted ? (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>

            {/* Collection / Binder Navigation Button */}
            <a
              href="/collection"
              title="Manage Lineup & Collection"
              className="p-2 rounded-xl border bg-slate-900/80 border-slate-700/60 text-slate-300 hover:text-cyan-300 hover:bg-slate-800/80 hover:border-cyan-500/40 transition-all flex items-center justify-center text-xs"
            >
              🎴
            </a>

            {/* Connection Status Indicator */}
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
              <span className="hidden sm:inline">{connectionStatus === 'CONNECTED' ? '● CONNECTED' : connectionStatus}</span>
            </div>
          </div>
        </header>

        {/* PvP Waiting Banner */}
        {state.status === 'WAITING' &&
          !(
            state.p2?.id &&
            (state.p2.id.toUpperCase().includes('BOT') || state.p2.id.toLowerCase().startsWith('bot'))
          ) && (
            <div className="w-full shrink-0 p-2.5 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl flex items-center justify-between flex-wrap gap-2 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <span className="text-base animate-spin">⏳</span>
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
                className="px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-lg transition shadow-lg text-xs active:scale-95"
              >
                🔗 Open Player 2 view in a new window ↗
              </a>
            </div>
          )}

        {/* 2. Interactive Canvas Arena Stage with Visual FX */}
        <div className="flex-1 flex items-center justify-center min-h-0 w-full overflow-hidden my-0.5">
          <ArenaCanvas
            arenaState={state}
            currentUserId={session.userId}
            selectedTargetId={selectedTargetId}
            onSelectTarget={setSelectedTargetId}
          />
        </div>

        {/* 3. Modernized Action Bar */}
        <section className="w-full shrink-0 glass-panel rounded-xl p-2.5 flex flex-col items-center gap-2 shadow-2xl">
          {/* Turn Status Badge */}
          {state.status === 'IN_PROGRESS' && (
            <div className="text-xs font-bold tracking-wide">
              {isMyCardActive ? (
                <span className="text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-3 py-1 rounded-full inline-flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>YOUR TURN — Active: <strong className="text-white">{activeCard?.name || 'Your Card'}</strong> (MP: {activeMana})</span>
                </span>
              ) : (
                <span className="text-amber-300 bg-amber-950/80 border border-amber-500/50 px-3 py-1 rounded-full inline-flex items-center gap-2">
                  <span>⏳ OPPONENT'S TURN — Waiting for <strong className="text-white">{activeCard?.name || 'Opponent'}</strong>...</span>
                </span>
              )}
            </div>
          )}

          {/* Action Button Row */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
            {/* Basic Attack */}
            <button
              id="action-basic-attack"
              onClick={() => handleAction('BASIC_ATTACK')}
              disabled={!canBasicAttack}
              className="btn-basic-attack disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 font-extrabold rounded-xl text-slate-100 flex items-center gap-2 text-xs uppercase tracking-wide active:scale-95 shadow-md"
            >
              <span>⚔️</span>
              <span>Basic Attack</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-600/50">0 MP</span>
            </button>

            {/* Elemental Burst */}
            <button
              id="action-elemental-burst"
              onClick={() => handleAction('ELEMENTAL_BURST')}
              disabled={!canElementalBurst}
              className="btn-elemental-burst disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 font-extrabold rounded-xl text-white flex items-center gap-2 text-xs uppercase tracking-wide active:scale-95 shadow-md"
            >
              <span>💥</span>
              <span>Elemental Burst</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 font-black">30 MP</span>
            </button>

            {/* Ultimate */}
            <button
              id="action-ultimate"
              onClick={() => handleAction('ULTIMATE')}
              disabled={!canUltimate}
              className="btn-ultimate disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 font-extrabold rounded-xl text-slate-950 flex items-center gap-2 text-xs uppercase tracking-wide active:scale-95 shadow-md"
            >
              <span>🌟</span>
              <span>Ultimate</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/50 font-black">70 MP</span>
            </button>

            {/* Auto-Battle Toggle */}
            <button
              id="toggle-auto-battle"
              onClick={handleToggleAuto}
              className={`px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 transition-all shadow-lg active:scale-95 border ${
                isAuto
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isAuto ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              <span>AUTO: <strong>{isAuto ? 'ON' : 'OFF'}</strong></span>
            </button>
          </div>
        </section>

        {/* 4. Stylized Combat Log with Glassmorphism & Direct Container Scroll */}
        <section className="w-full shrink-0 glass-panel rounded-xl p-2.5 shadow-xl text-left">
          <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
              <span>📜</span>
              <span>Combat Event Log</span>
            </div>
            <span className="text-[10px] text-slate-500">Live authoritative resolutions</span>
          </div>

          <div
            ref={logContainerRef}
            className="combat-log-scroll h-28 max-h-28 overflow-y-auto font-mono text-xs space-y-1 pr-2"
          >
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
          </div>
        </section>

        {/* 5. Victory & Defeat Modal */}
        <BattleResultModal
          isOpen={state.status === 'COMPLETED'}
          isWinner={isWinner}
          crystalsAwarded={state.matchEnd?.crystalsAwarded ?? 50}
          ratingDelta={isWinner ? state.matchEnd?.winnerDelta : state.matchEnd?.loserDelta}
          newRating={isWinner ? state.matchEnd?.newWinnerRating : state.matchEnd?.newLoserRating}
          winnerName={state.winnerId === state.p1?.id ? state.p1?.name : state.p2?.name}
          onRematch={handleRematch}
          onReturnToDiscord={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/duel';
            }
          }}
        />
      </div>
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
