// packages/game-logic/tests/races-variants.test.ts
import { describe, it, expect } from 'vitest';
import { RACE_BASE, VARIANT_MULTIPLIERS } from '../src';

describe('Races and Variants Domain Constants', () => {
  it('defines exact base stats for all 7 races', () => {
    expect(RACE_BASE.dragon).toEqual({ hp: 1200, atk: 180, def: 110, spd: 85, mana: 120 });
    expect(RACE_BASE.elf).toEqual({ hp: 800, atk: 160, def: 70, spd: 125, mana: 160 });
    expect(RACE_BASE.human).toEqual({ hp: 950, atk: 130, def: 95, spd: 100, mana: 100 });
    expect(RACE_BASE.dwarf).toEqual({ hp: 1400, atk: 120, def: 150, spd: 70, mana: 80 });
    expect(RACE_BASE.orc).toEqual({ hp: 1350, atk: 170, def: 85, spd: 90, mana: 60 });
    expect(RACE_BASE.troll).toEqual({ hp: 1600, atk: 110, def: 90, spd: 60, mana: 70 });
    expect(RACE_BASE.goblin).toEqual({ hp: 750, atk: 140, def: 60, spd: 140, mana: 110 });
  });

  it('defines exact multiplicative scaling for all 5 variants', () => {
    expect(VARIANT_MULTIPLIERS.normal).toBe(1.00);
    expect(VARIANT_MULTIPLIERS.silver).toBe(1.25);
    expect(VARIANT_MULTIPLIERS.gold).toBe(1.60);
    expect(VARIANT_MULTIPLIERS.diamond).toBe(2.20);
    expect(VARIANT_MULTIPLIERS.rainbow).toBe(3.00);
  });
});
