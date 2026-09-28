import { describe, it, expect } from 'vitest';
import {
  openBoosterPack,
  BOOSTER_PACKS,
  BoosterPackType,
} from '../src/packs';

describe('Booster Pack System (packages/game-logic/src/packs.ts)', () => {
  it('defines correct configurations for Standard, Elemental, and Ascendant packs', () => {
    expect(BOOSTER_PACKS.standard.cost).toBe(150);
    expect(BOOSTER_PACKS.standard.cardCount).toBe(3);

    expect(BOOSTER_PACKS.elemental.cost).toBe(350);
    expect(BOOSTER_PACKS.elemental.cardCount).toBe(3);

    expect(BOOSTER_PACKS.ascendant.cost).toBe(750);
    expect(BOOSTER_PACKS.ascendant.cardCount).toBe(4);
  });

  describe('Standard Pack', () => {
    it('generates 3 cards with 6-character IDs and valid stats', () => {
      const cards = openBoosterPack('standard');
      expect(cards).toHaveLength(3);
      for (const card of cards) {
        expect(card.id).toHaveLength(6);
        expect(card.level).toBe(1);
        expect(card.powerScore).toBeGreaterThan(0);
        expect(['normal', 'silver', 'gold', 'diamond']).toContain(card.variant);
      }
    });

    it('generates deterministically with a fixed seed', () => {
      const cardsA = openBoosterPack('standard', 424242);
      const cardsB = openBoosterPack('standard', 424242);
      expect(cardsA.length).toBe(cardsB.length);
      for (let i = 0; i < cardsA.length; i++) {
        expect(cardsA[i].race).toBe(cardsB[i].race);
        expect(cardsA[i].variant).toBe(cardsB[i].variant);
        expect(cardsA[i].element).toBe(cardsB[i].element);
        expect(cardsA[i].level).toBe(cardsB[i].level);
      }
    });
  });

  describe('Elemental Hoard', () => {
    it('guarantees at least 1 Silver or higher variant across multiple sample openings', () => {
      for (let seed = 100; seed < 150; seed++) {
        const cards = openBoosterPack('elemental', seed);
        expect(cards).toHaveLength(3);
        const hasSilverOrBetter = cards.some((c) =>
          ['silver', 'gold', 'diamond', 'rainbow'].includes(c.variant)
        );
        expect(hasSilverOrBetter).toBe(true);
      }
    });

    it('includes rare elements and rolls levels up to 3', () => {
      let sawRareElement = false;
      for (let seed = 200; seed < 230; seed++) {
        const cards = openBoosterPack('elemental', seed);
        for (const card of cards) {
          expect(card.level).toBeGreaterThanOrEqual(1);
          expect(card.level).toBeLessThanOrEqual(3);
          if (['arcane', 'shadow', 'blood', 'void'].includes(card.element)) {
            sawRareElement = true;
          }
        }
      }
      expect(sawRareElement).toBe(true);
    });
  });

  describe('Ascendant Vault', () => {
    it('generates 4 cards and guarantees at least 1 Gold or Diamond variant', () => {
      for (let seed = 300; seed < 350; seed++) {
        const cards = openBoosterPack('ascendant', seed);
        expect(cards).toHaveLength(4);
        const hasGoldOrDiamond = cards.some((c) =>
          ['gold', 'diamond', 'rainbow'].includes(c.variant)
        );
        expect(hasGoldOrDiamond).toBe(true);
      }
    });

    it('boosts base levels and power scores', () => {
      const cards = openBoosterPack('ascendant');
      expect(cards).toHaveLength(4);
      for (const card of cards) {
        expect(card.level).toBeGreaterThanOrEqual(3);
        expect(card.level).toBeLessThanOrEqual(6);
        expect(card.powerScore).toBeGreaterThan(150);
      }
    });
  });
});
