// packages/game-logic/tests/card-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateCardFromSeed } from '../src';

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
});
