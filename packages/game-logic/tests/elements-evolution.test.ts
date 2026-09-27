// packages/game-logic/tests/elements-evolution.test.ts
import { describe, it, expect } from 'vitest';
import { ELEMENT_TIER_BONUS, ELEMENT_TO_TIER, getEvolutionMultiplier } from '../src';

describe('Element Tiers and Evolution Scaling', () => {
  it('correctly maps S, A, B, C tier element bonuses', () => {
    expect(ELEMENT_TIER_BONUS.S).toBe(200);
    expect(ELEMENT_TIER_BONUS.A).toBe(120);
    expect(ELEMENT_TIER_BONUS.B).toBe(80);
    expect(ELEMENT_TIER_BONUS.C).toBe(50);

    expect(ELEMENT_TO_TIER['void']).toBe('S');
    expect(ELEMENT_TO_TIER['fire']).toBe('A');
    expect(ELEMENT_TO_TIER['water']).toBe('B');
    expect(ELEMENT_TO_TIER['crystal']).toBe('C');
  });

  it('calculates exact evolution multiplier for stages 1 through 5', () => {
    expect(getEvolutionMultiplier(1)).toBeCloseTo(1.0);
    expect(getEvolutionMultiplier(2)).toBeCloseTo(1.6);
    expect(getEvolutionMultiplier(3)).toBeCloseTo(2.2);
    expect(getEvolutionMultiplier(4)).toBeCloseTo(2.8);
    expect(getEvolutionMultiplier(5)).toBeCloseTo(3.4);
  });
});
