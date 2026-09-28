import { describe, it, expect } from 'vitest';
import {
  SALVAGE_VALUES,
  calculateSalvageYield,
  validateFusionCards,
  getDominantElement,
  fuseCards,
  calculatePowerScore,
} from '../src';

describe('Arcane Forge & Salvaging Logic (packages/game-logic)', () => {
  describe('Salvage Calculations', () => {
    it('accurately calculates dust and crystals for normal, silver, gold, diamond', () => {
      expect(SALVAGE_VALUES.normal).toEqual({ arcaneDust: 15, crystals: 10 });
      expect(SALVAGE_VALUES.silver).toEqual({ arcaneDust: 50, crystals: 35 });
      expect(SALVAGE_VALUES.gold).toEqual({ arcaneDust: 175, crystals: 100 });
      expect(SALVAGE_VALUES.diamond).toEqual({ arcaneDust: 600, crystals: 350 });
    });

    it('calculates cumulative yield for a batch of mixed cards', () => {
      const cards = [
        { variant: 'normal' },
        { variant: 'normal' },
        { variant: 'silver' },
        { variant: 'gold' },
      ];
      // 15*2 + 50 + 175 = 255 dust
      // 10*2 + 35 + 100 = 155 crystals
      const result = calculateSalvageYield(cards);
      expect(result.arcaneDust).toBe(255);
      expect(result.crystals).toBe(155);
    });
  });

  describe('Card Fusion Validation & Rules', () => {
    it('rejects fusion with fewer or more than 3 cards', () => {
      const res2 = validateFusionCards([
        { id: '1', variant: 'normal' },
        { id: '2', variant: 'normal' },
      ]);
      expect(res2.valid).toBe(false);
      expect(res2.reason).toContain('exactly 3 cards');

      const res4 = validateFusionCards([
        { id: '1', variant: 'normal' },
        { id: '2', variant: 'normal' },
        { id: '3', variant: 'normal' },
        { id: '4', variant: 'normal' },
      ]);
      expect(res4.valid).toBe(false);
    });

    it('rejects duplicate card IDs', () => {
      const res = validateFusionCards([
        { id: '1', variant: 'normal' },
        { id: '1', variant: 'normal' },
        { id: '2', variant: 'normal' },
      ]);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('duplicate');
    });

    it('rejects cards with mismatched variant tiers', () => {
      const res = validateFusionCards([
        { id: '1', variant: 'normal' },
        { id: '2', variant: 'silver' },
        { id: '3', variant: 'normal' },
      ]);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('exact same variant');
    });

    it('identifies dominant element correctly when 2 share element', () => {
      const dominant = getDominantElement(['fire', 'water', 'fire']);
      expect(dominant).toBe('fire');
    });

    it('picks one of the sacrifice elements when all 3 are distinct', () => {
      const elements = ['fire', 'water', 'lightning'];
      const chosen = getDominantElement(elements);
      expect(elements).toContain(chosen);
    });

    it('fuses 3 Normal cards into a Silver card with +10% power score bonus', () => {
      const sacrifice = [
        { id: 'c1', race: 'dragon', variant: 'normal', element: 'fire' },
        { id: 'c2', race: 'dragon', variant: 'normal', element: 'fire' },
        { id: 'c3', race: 'elf', variant: 'normal', element: 'water' },
      ];

      const fused = fuseCards(sacrifice);
      expect(fused.id).toHaveLength(6);
      expect(fused.variant).toBe('silver');
      expect(fused.race).toBe('dragon');
      expect(fused.element).toBe('fire');

      // Verify +10% bonus
      const baseScore = calculatePowerScore({
        race: fused.race,
        variant: 'silver',
        elementTier: fused.elementTier,
        evolutionStage: 1,
        level: 1,
      });
      expect(fused.powerScore).toBe(Math.round(baseScore * 1.1));
    });

    it('fuses 3 Silver cards into a Gold card', () => {
      const sacrifice = [
        { id: 's1', race: 'orc', variant: 'silver', element: 'void' },
        { id: 's2', race: 'orc', variant: 'silver', element: 'void' },
        { id: 's3', race: 'orc', variant: 'silver', element: 'ice' },
      ];

      const fused = fuseCards(sacrifice);
      expect(fused.variant).toBe('gold');
      expect(fused.element).toBe('void');
    });

    it('fuses 3 Gold cards into a Diamond card', () => {
      const sacrifice = [
        { id: 'g1', race: 'human', variant: 'gold', element: 'arcane' },
        { id: 'g2', race: 'human', variant: 'gold', element: 'arcane' },
        { id: 'g3', race: 'human', variant: 'gold', element: 'arcane' },
      ];

      const fused = fuseCards(sacrifice);
      expect(fused.variant).toBe('diamond');
      expect(fused.element).toBe('arcane');
    });
  });
});
