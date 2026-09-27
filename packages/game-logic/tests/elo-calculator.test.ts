import { describe, it, expect } from 'vitest';
import { calculateElo, getRankTier, calculateWinRate } from '../src';

describe('Competitive Elo / MMR Rating Calculator', () => {
  it('calculates equal rating match adjustment accurately (K=32 gives ΔR=16)', () => {
    const result = calculateElo(1000, 1000);
    expect(result.expectedWinner).toBeCloseTo(0.5, 4);
    expect(result.expectedLoser).toBeCloseTo(0.5, 4);
    expect(result.winnerDelta).toBe(16);
    expect(result.loserDelta).toBe(16);
    expect(result.newWinnerRating).toBe(1016);
    expect(result.newLoserRating).toBe(984);
  });

  it('rewards higher delta when lower rated player defeats higher rated player', () => {
    // Underdog (900) beats favorite (1100)
    const result = calculateElo(900, 1100);
    expect(result.winnerDelta).toBeGreaterThan(16);
    expect(result.loserDelta).toBe(result.winnerDelta);
    expect(result.newWinnerRating).toBe(900 + result.winnerDelta);
    expect(result.newLoserRating).toBe(1100 - result.loserDelta);
  });

  it('awards smaller delta when higher rated player defeats lower rated player', () => {
    // Favorite (1200) beats underdog (800)
    const result = calculateElo(1200, 800);
    expect(result.winnerDelta).toBeLessThan(16);
    expect(result.winnerDelta).toBeGreaterThanOrEqual(1);
    expect(result.newWinnerRating).toBe(1200 + result.winnerDelta);
  });

  it('respects the minimum rating floor of 100', () => {
    const result = calculateElo(1200, 105, { minRating: 100 });
    expect(result.newLoserRating).toBeGreaterThanOrEqual(100);

    const floorResult = calculateElo(1500, 100, { minRating: 100 });
    expect(floorResult.newLoserRating).toBe(100);
  });

  it('awards fixed +10 MMR for bot practice matches', () => {
    const result = calculateElo(1000, 1000, { isBotMatch: true });
    expect(result.winnerDelta).toBe(10);
    expect(result.loserDelta).toBe(0);
    expect(result.newWinnerRating).toBe(1010);
    expect(result.newLoserRating).toBe(1000);
  });

  it('correctly classifies rank tiers and calculates win rate percentage', () => {
    expect(getRankTier(950).tier).toBe('Bronze');
    expect(getRankTier(1150).tier).toBe('Silver');
    expect(getRankTier(1350).tier).toBe('Gold');
    expect(getRankTier(1550).tier).toBe('Diamond');

    expect(calculateWinRate(14, 6)).toBe(70);
    expect(calculateWinRate(0, 0)).toBe(0);
    expect(calculateWinRate(1, 0)).toBe(100);
    expect(calculateWinRate(0, 5)).toBe(0);
  });
});
