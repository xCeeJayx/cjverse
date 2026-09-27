export interface EloCalculationResult {
  winnerDelta: number;
  loserDelta: number;
  newWinnerRating: number;
  newLoserRating: number;
  expectedWinner: number;
  expectedLoser: number;
}

export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond';

export interface RankTierInfo {
  tier: RankTier;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  minRating: number;
  maxRating: number | null;
}

/**
 * Calculates competitive Elo rating adjustments using the standard formula:
 *   E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 *   ΔR = round(K * (1 - E_A))
 * Default K-factor is 32.
 * Minimum rating floor is 100.
 */
export function calculateElo(
  winnerRating: number,
  loserRating: number,
  options: {
    isBotMatch?: boolean;
    kFactor?: number;
    minRating?: number;
    botRatingGain?: number;
  } = {}
): EloCalculationResult {
  const {
    isBotMatch = false,
    kFactor = 32,
    minRating = 100,
    botRatingGain = 10,
  } = options;

  // Bot matches: fixed +10 MMR rating gain for player
  if (isBotMatch) {
    const winnerDelta = botRatingGain;
    const newWinnerRating = winnerRating + winnerDelta;
    return {
      winnerDelta,
      loserDelta: 0,
      newWinnerRating,
      newLoserRating: loserRating,
      expectedWinner: 1,
      expectedLoser: 0,
    };
  }

  // PvP matches: standard Elo formula
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;

  const winnerDelta = Math.max(1, Math.round(kFactor * (1 - expectedWinner)));
  const loserDelta = winnerDelta;

  const newWinnerRating = winnerRating + winnerDelta;
  const newLoserRating = Math.max(minRating, loserRating - loserDelta);

  return {
    winnerDelta,
    loserDelta,
    newWinnerRating,
    newLoserRating,
    expectedWinner,
    expectedLoser,
  };
}

/**
 * Returns rank tier classifications:
 * - Bronze: < 1100
 * - Silver: 1100 - 1299
 * - Gold: 1300 - 1499
 * - Diamond: 1500+
 */
export function getRankTier(rating: number): RankTierInfo {
  if (rating >= 1500) {
    return {
      tier: 'Diamond',
      color: 'text-cyan-300',
      badgeBg: 'bg-cyan-950/80',
      badgeText: 'text-cyan-300',
      borderColor: 'border-cyan-400',
      minRating: 1500,
      maxRating: null,
    };
  }
  if (rating >= 1300) {
    return {
      tier: 'Gold',
      color: 'text-amber-400',
      badgeBg: 'bg-amber-950/80',
      badgeText: 'text-amber-300',
      borderColor: 'border-amber-400',
      minRating: 1300,
      maxRating: 1499,
    };
  }
  if (rating >= 1100) {
    return {
      tier: 'Silver',
      color: 'text-slate-200',
      badgeBg: 'bg-slate-800',
      badgeText: 'text-slate-200',
      borderColor: 'border-slate-400',
      minRating: 1100,
      maxRating: 1299,
    };
  }
  return {
    tier: 'Bronze',
    color: 'text-amber-600',
    badgeBg: 'bg-stone-900',
    badgeText: 'text-amber-600',
    borderColor: 'border-amber-700',
    minRating: 0,
    maxRating: 1099,
  };
}

/**
 * Calculates win rate percentage.
 */
export function calculateWinRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total <= 0) return 0;
  return Math.round((wins / total) * 100);
}
