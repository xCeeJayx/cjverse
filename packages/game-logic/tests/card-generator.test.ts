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

  it('deterministically rolls 50/50 gender and returns male or female', () => {
    const card1 = generateCardFromSeed(12345);
    expect(card1.gender).toBeDefined();
    expect(['male', 'female']).toContain(card1.gender);

    const card2 = generateCardFromSeed(12345);
    expect(card2.gender).toBe(card1.gender);

    // Test overrides
    const femaleCard = generateCardFromSeed(12345, 1, { gender: 'female' });
    expect(femaleCard.gender).toBe('female');

    const maleCard = generateCardFromSeed(12345, 1, { gender: 'male' });
    expect(maleCard.gender).toBe('male');

    // Test both genders appear over a sample of seeds
    const genders = new Set(Array.from({ length: 50 }, (_, i) => generateCardFromSeed(i).gender));
    expect(genders.has('male')).toBe(true);
    expect(genders.has('female')).toBe(true);
  });
});
