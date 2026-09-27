// packages/game-logic/tests/card-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateCardFromSeed, generateCardId } from '../src';

describe('Deterministic Card Generation from Seed', () => {
  it('generates identical card identity given identical integer seed', () => {
    const cardA = generateCardFromSeed(133742);
    const cardB = generateCardFromSeed(133742);
    expect(cardA).toEqual(cardB);
    expect(cardA.seed).toBe(133742);
    expect(cardA.level).toBe(1);
    expect(cardA.evolutionStage).toBe(1);
  });

  it('calculates a strictly positive integer power score', () => {
    const card = generateCardFromSeed(9999);
    expect(card.powerScore).toBeGreaterThan(0);
    expect(Number.isInteger(card.powerScore)).toBe(true);
  });

  it('generates strictly 6-character alphanumeric card IDs without ambiguous characters or hashtags', () => {
    const id = generateCardId();
    expect(id).toHaveLength(6);
    expect(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(id)).toBe(true);
    expect(id).not.toContain('#');
    expect(id).not.toMatch(/[0O1I]/);
  });
});
