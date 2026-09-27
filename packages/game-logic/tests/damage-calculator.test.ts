// packages/game-logic/tests/damage-calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateMitigation, calculateDamage } from '../src';

describe('Damage Calculation & Mitigation Formula', () => {
  it('halves incoming damage at 1000 DEF and inflicts full damage at 0 DEF', () => {
    expect(calculateMitigation(0)).toBeCloseTo(1.0);
    expect(calculateMitigation(1000)).toBeCloseTo(0.5);
  });

  it('calculates final damage using raw damage and mitigation', () => {
    // raw damage: (200 atk * 1.5 skill * 1.0 elem) = 300
    // mitigation: 1000 / (1000 + 1000) = 0.5
    // final: floor(300 * 0.5) = 150
    const damage = calculateDamage(200, 1.5, 1.0, 1000);
    expect(damage).toBe(150);
  });

  // Review Focus Check: Damage Floor
  it('mitigation floors at 1 damage when defender DEF is extraordinarily high', () => {
    const damage = calculateDamage(10, 1.0, 0.5, 1000000);
    expect(damage).toBe(1);
  });
});
