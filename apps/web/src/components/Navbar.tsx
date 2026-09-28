'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getClientSessionCookie, getDevSessionFromQuery } from '../lib/auth-session';

export interface NavbarUser {
  userId?: string;
  username?: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  crystals?: number;
}

export interface NavbarProps {
  initialUser?: NavbarUser | null;
}

export function Navbar({ initialUser }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<NavbarUser | null>(() => {
    if (initialUser) return initialUser;
    const cookieSession = getClientSessionCookie();
    if (cookieSession.isValid) {
      return {
        userId: cookieSession.userId,
        username: cookieSession.username,
        avatar: cookieSession.avatar,
        crystals: cookieSession.crystals ?? 100,
      };
    }
    return null;
  });

  const [isStartingBotMatch, setIsStartingBotMatch] = useState(false);

  const [claimableQuestsCount, setClaimableQuestsCount] = useState<number>(0);

  // Sync auth session from /api/auth/me and fetch quests status
  useEffect(() => {
    let isMounted = true;

    async function fetchSessionAndQuests() {
      try {
        // Check URL for ?as= query param (dev bypass)
        let asParam: string | null = null;
        if (typeof window !== 'undefined') {
          const sp = new URLSearchParams(window.location.search);
          asParam = sp.get('as');
        }

        const devSession = getDevSessionFromQuery(asParam);
        if (devSession?.isValid) {
          if (isMounted) {
            setUser({
              userId: devSession.userId,
              username: devSession.username,
              avatar: devSession.avatar,
              crystals: devSession.crystals ?? 100,
            });
          }
        } else {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.user && isMounted) {
              setUser({
                userId: data.user.userId,
                username: data.user.username,
                avatar: data.user.avatar,
                avatarUrl: data.user.avatarUrl || data.user.avatar,
                crystals: data.user.crystals ?? 100,
              });
            }
          }
        }

        // Check quests status for active indicator / badge
        const querySuffix = asParam ? `?as=${encodeURIComponent(asParam)}` : '';
        const questsRes = await fetch(`/api/quests${querySuffix}`);
        if (questsRes.ok && isMounted) {
          const questData = await questsRes.json();
          let claimable = 0;
          if (questData.cooldown?.canClaim) {
            claimable += 1;
          }
          if (Array.isArray(questData.quests)) {
            for (const q of questData.quests) {
              if (q.completed && !q.claimed) {
                claimable += 1;
              }
            }
          }
          setClaimableQuestsCount(claimable);
        }
      } catch (err) {
        console.warn('[Navbar] Failed to fetch session or quests:', err);
      }
    }

    fetchSessionAndQuests();

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const handleStartBotDuel = async () => {
    if (isStartingBotMatch) return;
    setIsStartingBotMatch(true);

    try {
      let asParam = '';
      if (typeof window !== 'undefined') {
        const sp = new URLSearchParams(window.location.search);
        const asVal = sp.get('as');
        if (asVal) asParam = `?as=${encodeURIComponent(asVal)}`;
      }

      const res = await fetch(`/api/duel/practice${asParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Failed to create practice room: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.arenaUrl) {
        router.push(data.arenaUrl);
      } else if (data.roomId) {
        router.push(`/duel/${data.roomId}${asParam}`);
      }
    } catch (err) {
      console.error('[Navbar] Practice Duel error:', err);
      // Fallback direct practice room navigation
      const fallbackRoomId = 'bot-' + Math.random().toString(36).substring(2, 8);
      router.push(`/duel/${fallbackRoomId}`);
    } finally {
      setIsStartingBotMatch(false);
    }
  };

  const navLinks = [
    { label: 'Arena', href: '/duel', icon: '⚔️' },
    { label: 'World Boss', href: '/boss', icon: '💀' },
    { label: 'Collection / Team', href: '/collection', icon: '🎴' },
    { label: 'Shop', href: '/shop', icon: '🏪' },
    { label: 'Market', href: '/market', icon: '⚖️' },
    { label: 'Quests', href: '/quests', icon: '📜', badgeCount: claimableQuestsCount },
    { label: 'Leaderboard', href: '/leaderboard', icon: '🏆' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-6 md:gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-rose-500 p-0.5 shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-sm font-black text-white">
                CJ
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                CJVERSE
              </span>
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase -mt-1">
                Arena & Binder
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const isActive =
                link.href === '/duel'
                  ? pathname?.startsWith('/duel')
                  : link.href === '/boss'
                  ? pathname?.startsWith('/boss')
                  : pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-800/90 text-white border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span className="text-sm">{link.icon}</span>
                  <span>{link.label}</span>
                  {link.badgeCount !== undefined && link.badgeCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[10px] font-black rounded-full shadow-sm animate-pulse">
                      {link.badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Practice Duel Button, Crystals, & Profile */}
        <div className="flex items-center gap-3">
          {/* Quick Duel Launcher vs Bot */}
          <button
            type="button"
            id="practice-duel-btn"
            disabled={isStartingBotMatch}
            onClick={handleStartBotDuel}
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-900/30 border border-emerald-400/40 transition-all uppercase tracking-wider disabled:opacity-50"
          >
            {isStartingBotMatch ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Launching...</span>
              </>
            ) : (
              <>
                <span>⚔️</span>
                <span>Practice Duel (vs Bot)</span>
              </>
            )}
          </button>

          {/* Active Crystal Balance */}
          <div
            id="user-crystals-display"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 border border-amber-500/40 rounded-xl shadow-sm text-xs font-black text-amber-300"
            title="Active Crystal Balance"
          >
            <span className="text-sm">💎</span>
            <span>{(user?.crystals ?? 100).toLocaleString()}</span>
          </div>

          {/* User Profile / Discord Auth */}
          {user ? (
            <div className="flex items-center gap-2 pl-1 border-l border-slate-800">
              {user.avatar || user.avatarUrl ? (
                <img
                  src={
                    user.avatarUrl ||
                    (user.avatar?.startsWith('http')
                      ? user.avatar
                      : `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png`)
                  }
                  alt={user.username || 'User'}
                  className="w-8 h-8 rounded-full border border-indigo-500/60 object-cover shadow-sm"
                  onError={(e) => {
                    // Fallback to avatar initial
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border border-indigo-400/50 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {(user.username || 'P')[0]?.toUpperCase()}
                </div>
              )}
              <span className="hidden md:inline-block text-xs font-bold text-slate-200 max-w-[120px] truncate">
                {user.username || 'Duelist'}
              </span>
            </div>
          ) : (
            <a
              href="/api/auth/discord/login"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[#5865F2]/25"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <span>Login</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
