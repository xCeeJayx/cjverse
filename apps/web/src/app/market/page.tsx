'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { calculateStats, getEvolutionStageName } from '@cjverse/game-logic';
import { getDevSessionFromQuery, getClientSessionCookie } from '../../lib/auth-session';

interface MarketListingItem {
  id: string;
  sellerId: string;
  sellerUsername: string;
  cardId: string;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  createdAt: string;
  card: {
    id: string;
    race: string;
    variant: string;
    element: string;
    elementTier: string;
    evolutionStage: number;
    level: number;
    powerScore: number;
    seed: number;
    assetPaths: any;
  };
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
    badgeText:
      'text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-300 via-green-300 via-cyan-400 to-fuchsia-400 font-black',
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

function MarketCardTile({
  listing,
  isOwnListing,
  canAfford,
  onInitiateBuy,
}: {
  listing: MarketListingItem;
  isOwnListing: boolean;
  canAfford: boolean;
  onInitiateBuy: (listing: MarketListingItem) => void;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0, sheenX: 50, sheenY: 50, isHovered: false });
  const card = listing.card;

  const variantStyle = VARIANT_COLORS[card.variant] || VARIANT_COLORS.Normal;
  const elementStyle = ELEMENT_STYLES[card.element] || {
    bg: 'bg-slate-800 border-slate-600',
    text: 'text-slate-300',
    icon: '⚡',
  };

  const stats = useMemo(
    () =>
      calculateStats({
        id: card.id,
        race: card.race as any,
        variant: card.variant as any,
        element: card.element as any,
        elementTier: card.elementTier as any,
        evolutionStage: card.evolutionStage,
        level: card.level,
        powerScore: card.powerScore,
        seed: card.seed,
      }),
    [card]
  );

  const stageName = getEvolutionStageName(card.evolutionStage);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;
    const sheenX = (x / rect.width) * 100;
    const sheenY = (y / rect.height) * 100;
    setTilt({ x: rotateX, y: rotateY, sheenX, sheenY, isHovered: true });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0, sheenX: 50, sheenY: 50, isHovered: false });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: tilt.isHovered
          ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.02, 1.02, 1.02)`
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        transition: tilt.isHovered ? 'transform 0.08s ease-out' : 'transform 0.4s ease-out',
      }}
      className={`relative group rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/95 border-2 ${variantStyle.border} ${variantStyle.glow} p-4 flex flex-col justify-between overflow-hidden shadow-xl transition-shadow select-none`}
    >
      {/* Dynamic Foil Sheen Overlay */}
      {tilt.isHovered && (
        <div
          className={`absolute inset-0 pointer-events-none rounded-2xl z-20 bg-gradient-to-tr ${variantStyle.foilOverlay} mix-blend-color-dodge transition-opacity duration-150`}
          style={{
            backgroundPosition: `${tilt.sheenX}% ${tilt.sheenY}%`,
          }}
        />
      )}

      {/* Top Badges: Price & Seller */}
      <div className="flex items-center justify-between gap-2 z-10 mb-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/90 border border-amber-500/70 shadow-sm text-xs font-black text-amber-300">
          <span>💎</span>
          <span>{listing.price.toLocaleString()}</span>
        </div>

        <div
          className="flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/80 truncate max-w-[120px]"
          title={`Seller: ${listing.sellerUsername}`}
        >
          <span>👤</span>
          <span className="truncate">{listing.sellerUsername}</span>
        </div>
      </div>

      {/* Card Artwork / Preview Placeholder */}
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 flex items-center justify-center mb-3">
        <div className="absolute inset-0 bg-radial from-slate-800/40 via-transparent to-slate-950/80 pointer-events-none" />
        <div className="text-4xl filter drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
          {elementStyle.icon}
        </div>

        {/* Card Level Badge */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-700 text-[10px] font-black text-cyan-300 tracking-wider">
          LV. {card.level}
        </div>

        {/* Evolution Stage Badge */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/90 border border-purple-500/60 text-[10px] font-bold text-purple-300">
          {stageName}
        </div>
      </div>

      {/* Card Details */}
      <div className="z-10 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-black text-white tracking-wide truncate">
              {card.variant.toUpperCase()} {card.race.toUpperCase()}
            </h3>
            <span className="text-[10px] font-mono text-slate-400">#{card.id}</span>
          </div>

          {/* Badges: Element & Variant */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span
              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 ${elementStyle.bg} ${elementStyle.text}`}
            >
              <span>{elementStyle.icon}</span>
              <span>{card.element}</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${variantStyle.badgeBg} ${variantStyle.badgeText}`}
            >
              {card.variant}
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-800/60 border border-slate-700 text-[10px] font-mono text-slate-300">
              ⚡ {card.powerScore}
            </span>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[10px] text-slate-300 mb-3">
            <div>
              <span className="text-slate-400 block text-[9px]">HP</span>
              <span className="font-bold text-emerald-400">{stats.maxHp}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">ATK</span>
              <span className="font-bold text-rose-400">{stats.atk}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">DEF</span>
              <span className="font-bold text-sky-400">{stats.def}</span>
            </div>
          </div>
        </div>

        {/* Action Button: Buy Now or Own Listing */}
        <div className="pt-2 border-t border-slate-800/80">
          {isOwnListing ? (
            <button
              disabled
              className="w-full py-2 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs font-bold text-slate-400 cursor-not-allowed text-center"
            >
              Your Active Listing
            </button>
          ) : !canAfford ? (
            <button
              onClick={() => onInitiateBuy(listing)}
              className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 rounded-xl text-xs font-bold text-rose-300 transition-all text-center flex items-center justify-center gap-1.5"
            >
              <span>Need More 💎</span>
              <span className="opacity-75">({listing.price} 💎)</span>
            </button>
          ) : (
            <button
              onClick={() => onInitiateBuy(listing)}
              className="w-full py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-950/50 border border-emerald-400/40 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
            >
              <span>Buy Now</span>
              <span>•</span>
              <span>💎 {listing.price.toLocaleString()}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketContent() {
  const searchParams = useSearchParams();
  const asParam = searchParams.get('as');

  const [listings, setListings] = useState<MarketListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User state
  const [currentUser, setCurrentUser] = useState<{
    userId: string;
    username: string;
    crystals: number;
  } | null>(null);

  // Filters
  const [selectedElement, setSelectedElement] = useState<string>('all');
  const [selectedVariant, setSelectedVariant] = useState<string>('all');
  const [maxPriceFilter, setMaxPriceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Purchase Modal State
  const [selectedListing, setSelectedListing] = useState<MarketListingItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  // Load user session
  useEffect(() => {
    async function loadUser() {
      if (asParam) {
        const dev = getDevSessionFromQuery(asParam);
        if (dev?.isValid && dev.userId) {
          setCurrentUser({
            userId: dev.userId,
            username: dev.username || dev.userId,
            crystals: dev.crystals ?? 100,
          });
          return;
        }
      }

      const clientCookie = getClientSessionCookie();
      if (clientCookie.isValid && clientCookie.userId) {
        setCurrentUser({
          userId: clientCookie.userId,
          username: clientCookie.username || clientCookie.userId,
          crystals: clientCookie.crystals ?? 100,
        });
      }

      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser({
              userId: data.user.userId,
              username: data.user.username,
              crystals: data.user.crystals ?? 100,
            });
          }
        }
      } catch (err) {
        console.warn('[Market] Failed to load session:', err);
      }
    }

    loadUser();
  }, [asParam]);

  // Fetch active listings
  const fetchListings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/market');
      if (!res.ok) {
        throw new Error('Failed to load marketplace listings.');
      }
      const data = await res.json();
      setListings(data.listings || []);
    } catch (err: any) {
      console.error('[Market] Error loading listings:', err);
      setError(err.message || 'Error loading marketplace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  // Filter listings
  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      // Element filter
      if (selectedElement !== 'all' && l.card.element.toLowerCase() !== selectedElement.toLowerCase()) {
        return false;
      }
      // Variant filter
      if (selectedVariant !== 'all' && l.card.variant.toLowerCase() !== selectedVariant.toLowerCase()) {
        return false;
      }
      // Price filter
      if (maxPriceFilter !== 'all') {
        const max = parseInt(maxPriceFilter, 10);
        if (!Number.isNaN(max) && l.price > max) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const cardMatch =
          l.card.race.toLowerCase().includes(q) ||
          l.card.variant.toLowerCase().includes(q) ||
          l.card.id.toLowerCase().includes(q);
        const sellerMatch = l.sellerUsername.toLowerCase().includes(q);
        if (!cardMatch && !sellerMatch) return false;
      }
      return true;
    });
  }, [listings, selectedElement, selectedVariant, maxPriceFilter, searchQuery]);

  // Execute purchase
  const handleConfirmPurchase = async () => {
    if (!selectedListing || !currentUser) return;
    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      const asQuery = asParam ? `?as=${encodeURIComponent(asParam)}` : '';
      const res = await fetch(`/api/market/buy${asQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: selectedListing.id }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete purchase.');
      }

      setPurchaseSuccess(
        `Successfully purchased ${data.cardName} for 💎 ${data.price} Crystals!`
      );

      // Update local crystals
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              crystals: data.buyerCrystalsRemaining ?? prev.crystals - selectedListing.price,
            }
          : null
      );

      // Refresh listings
      await fetchListings();

      // Close modal after brief delay
      setTimeout(() => {
        setSelectedListing(null);
        setPurchaseSuccess(null);
      }, 1500);
    } catch (err: any) {
      setPurchaseError(err.message || 'An error occurred during checkout.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const userBalance = currentUser?.crystals ?? 0;

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Marketplace Header Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900/90 via-indigo-950/70 to-slate-900/90 border border-indigo-500/30 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-black uppercase tracking-wider">
                  Global Exchange
                </span>
                <span className="text-xs text-slate-400">• Active Trading Post</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                <span>🏪</span>
                <span className="bg-gradient-to-r from-white via-slate-200 to-cyan-300 bg-clip-text text-transparent">
                  Card Marketplace
                </span>
              </h1>
              <p className="mt-1 text-sm sm:text-base text-slate-300 max-w-2xl">
                Browse verified duelist listings, buy rare variants, or acquire key cards to complete
                your battle lineup.
              </p>
            </div>

            {/* Crystal Wallet Widget */}
            <div className="flex flex-col items-start sm:items-end bg-slate-950/80 border border-amber-500/50 rounded-2xl p-4 shadow-lg">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Your Crystal Balance
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl sm:text-3xl">💎</span>
                <span className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight">
                  {userBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Filters & Search Toolbar */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-md flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by card race, variant, or seller..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filters Group */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              {/* Element Filter */}
              <select
                value={selectedElement}
                onChange={(e) => setSelectedElement(e.target.value)}
                className="bg-slate-950/80 border border-slate-700 text-xs font-bold text-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">⚡ All Elements</option>
                <option value="fire">🔥 Fire</option>
                <option value="ice">❄️ Ice</option>
                <option value="lightning">⚡ Lightning</option>
                <option value="earth">🌿 Earth</option>
                <option value="arcane">🔮 Arcane</option>
                <option value="shadow">🌑 Shadow</option>
                <option value="void">🌌 Void</option>
                <option value="blood">🩸 Blood</option>
                <option value="light">✨ Light</option>
                <option value="time">⏳ Time</option>
                <option value="cosmic">🌠 Cosmic</option>
                <option value="chaos">💥 Chaos</option>
              </select>

              {/* Variant Filter */}
              <select
                value={selectedVariant}
                onChange={(e) => setSelectedVariant(e.target.value)}
                className="bg-slate-950/80 border border-slate-700 text-xs font-bold text-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">✨ All Variants</option>
                <option value="normal">Normal</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="diamond">Diamond</option>
                <option value="rainbow">Rainbow</option>
              </select>

              {/* Max Price Filter */}
              <select
                value={maxPriceFilter}
                onChange={(e) => setMaxPriceFilter(e.target.value)}
                className="bg-slate-950/80 border border-slate-700 text-xs font-bold text-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">💎 Any Price</option>
                <option value="100">≤ 100 Crystals</option>
                <option value="250">≤ 250 Crystals</option>
                <option value="500">≤ 500 Crystals</option>
                <option value="1000">≤ 1,000 Crystals</option>
              </select>

              {/* Reset Filters */}
              {(selectedElement !== 'all' ||
                selectedVariant !== 'all' ||
                maxPriceFilter !== 'all' ||
                searchQuery !== '') && (
                <button
                  onClick={() => {
                    setSelectedElement('all');
                    setSelectedVariant('all');
                    setMaxPriceFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-3 py-2.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border border-cyan-500/40 rounded-xl transition-all whitespace-nowrap"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Quick Counter */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <span>
              Showing <strong className="text-white">{filteredListings.length}</strong> active{' '}
              {filteredListings.length === 1 ? 'card' : 'cards'}
            </span>
            <button
              onClick={fetchListings}
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
            >
              <span>🔄</span> Refresh
            </button>
          </div>
        </section>

        {/* Listings Grid */}
        <section>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-bold">Scanning marketplace listings...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-950/30 border border-rose-500/50 rounded-2xl p-6 text-center text-rose-300">
              <p className="text-sm font-bold">{error}</p>
              <button
                onClick={fetchListings}
                className="mt-3 px-4 py-1.5 bg-rose-900/60 hover:bg-rose-800 rounded-xl text-xs font-bold text-white transition-all"
              >
                Try Again
              </button>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-12 text-center flex flex-col items-center justify-center">
              <span className="text-4xl mb-3">🏪</span>
              <h3 className="text-lg font-black text-white">No Listings Found</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md">
                {listings.length === 0
                  ? 'There are currently no cards listed on the marketplace. You can list one via the Discord bot with `/market list`!'
                  : 'No active listings match your current filters. Try relaxing your search criteria.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredListings.map((listing) => {
                const isOwn = currentUser ? listing.sellerId === currentUser.userId : false;
                const canAfford = userBalance >= listing.price;

                return (
                  <MarketCardTile
                    key={listing.id}
                    listing={listing}
                    isOwnListing={isOwn}
                    canAfford={canAfford}
                    onInitiateBuy={(item) => {
                      setSelectedListing(item);
                      setPurchaseError(null);
                      setPurchaseSuccess(null);
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Immediate Purchase Confirmation Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 shadow-2xl p-6 flex flex-col gap-5">
            <button
              onClick={() => setSelectedListing(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-2xl">
                💎
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Confirm Purchase</h3>
                <p className="text-xs text-slate-400">
                  Transfers card ownership immediately to your collection
                </p>
              </div>
            </div>

            {/* Card Summary Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-white">
                  {selectedListing.card.variant.toUpperCase()} {selectedListing.card.race.toUpperCase()}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <span>Lv. {selectedListing.card.level}</span>
                  <span>•</span>
                  <span>{selectedListing.card.element}</span>
                  <span>•</span>
                  <span>Power: {selectedListing.card.powerScore}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Seller</span>
                <span className="text-xs font-bold text-slate-200">{selectedListing.sellerUsername}</span>
              </div>
            </div>

            {/* Price Balance Breakdown */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Current Balance</span>
                <span className="font-bold text-slate-200">💎 {userBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Purchase Price</span>
                <span className="font-bold text-rose-400">- 💎 {selectedListing.price.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold">
                <span className="text-slate-200">Balance After Purchase</span>
                <span
                  className={
                    userBalance >= selectedListing.price ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  💎 {(userBalance - selectedListing.price).toLocaleString()}
                </span>
              </div>
            </div>

            {purchaseError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/60 text-xs font-bold text-rose-300">
                ❌ {purchaseError}
              </div>
            )}

            {purchaseSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/60 text-xs font-bold text-emerald-300">
                ✅ {purchaseSuccess}
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                disabled={isPurchasing}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isPurchasing || userBalance < selectedListing.price}
                onClick={handleConfirmPurchase}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-95 text-white text-xs font-black shadow-lg shadow-emerald-950/50 transition-all uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {isPurchasing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : userBalance < selectedListing.price ? (
                  <span>Insufficient Crystals</span>
                ) : (
                  <span>Confirm Purchase</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400">
          <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MarketContent />
    </Suspense>
  );
}
