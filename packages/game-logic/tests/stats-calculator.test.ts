// packages/game-logic/tests/stats-calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateStats, CardEntity } from '../src';

describe('CardStats Calculation Engine', () => {
  it('calculates exact stats for a Normal Level 1 Dragon with A-Tier Element at Stage 1', () => {
    const card: CardEntity = {
      seed: 1,
      race: 'dragon',
      variant: 'normal',
      element: 'fire',
      elementTier: 'A',
      evolutionStage: 1,
      level: 1,
      powerScore: 100
    };
    // Dragon base: hp 1200, atk 180, def 110, spd 85, mana 120
    // variant normal: 1.0, evo stage 1: 1.0, A-tier elem bonus: 120, lvlBonus: 15
    // maxHp: floor((1200 * 1.0) + (15 * 5)) = 1275
    // atk: floor((180 * 1.0) + 120 + 15) = 315
    // def: floor((110 * 1.0) + (15 * 0.5)) = 117
    // spd: floor(85 + (1.0 * 10)) = 95
    // maxMana: floor((120 * 1.0) + (120 * 0.5)) = 180
    // currentMana: 50
    const stats = calculateStats(card);
    expect(stats).toEqual({
      maxHp: 1275,
      currentHp: 1275,
      atk: 315,
      def: 117,
      spd: 95,
      maxMana: 180,
      currentMana: 50
    });
  });

  it('proves evolved Stage 4 Rainbow Goblin ATK strictly exceeds Stage 1 Normal Dragon ATK', () => {
    const normalDragon: CardEntity = {
      seed: 1, race: 'dragon', variant: 'normal', element: 'sand', elementTier: 'C', evolutionStage: 1, level: 1, powerScore: 100
    };
    const rainbowGoblin: CardEntity = {
      seed: 2, race: 'goblin', variant: 'rainbow', element: 'void', elementTier: 'S', evolutionStage: 4, level: 10, powerScore: 200
    };
    const dragonStats = calculateStats(normalDragon);
    const goblinStats = calculateStats(rainbowGoblin);
    expect(goblinStats.atk).toBeGreaterThan(dragonStats.atk);
  });

  it('safely handles race aliases like draconian and abyssal without throwing', () => {
    const draconianCard: any = {
      race: 'draconian',
      variant: 'gold',
      elementTier: 'A',
      level: 5,
    };
    const abyssalCard: any = {
      race: 'abyssal',
      variant: 'normal',
      elementTier: 'B',
      level: 1,
    };
    const unknownCard: any = {
      race: 'mystic_beast',
      variant: 'rainbow',
    };

    const dStats = calculateStats(draconianCard);
    expect(dStats).toBeDefined();
    expect(dStats.maxHp).toBeGreaterThan(0);

    const aStats = calculateStats(abyssalCard);
    expect(aStats).toBeDefined();
    expect(aStats.maxHp).toBeGreaterThan(0);

    const uStats = calculateStats(unknownCard);
    expect(uStats).toBeDefined();
    expect(uStats.maxHp).toBeGreaterThan(0);
  });
});
