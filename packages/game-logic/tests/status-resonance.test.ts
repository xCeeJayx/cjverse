import { describe, it, expect } from 'vitest';
import {
  applyStatusEffect,
  processTurnStartEffects,
  processActionBleed,
  modifyIncomingDamageWithStatus,
  calculateTeamResonance,
  applyResonanceToCardStats,
  TargetCardState,
} from '../src';

describe('Elemental Status Effects & Team Resonance (packages/game-logic)', () => {
  describe('Status Effects System', () => {
    it('applies Burn and inflicts 5% max HP damage each turn for 2 turns', () => {
      const card: TargetCardState = {
        id: 'card-1',
        name: 'Fire Dragon',
        currentHp: 1000,
        maxHp: 1000,
        currentMana: 50,
      };

      const result = applyStatusEffect(card, 'burn');
      expect(result.applied).toBe(true);
      expect(result.effect.duration).toBe(2);

      // Turn 1 start
      const turn1 = processTurnStartEffects(card);
      expect(turn1.totalDamage).toBe(50); // 5% of 1000
      expect(card.currentHp).toBe(950);
      expect(card.statusEffects![0].duration).toBe(1);

      // Turn 2 start
      const turn2 = processTurnStartEffects(card);
      expect(turn2.totalDamage).toBe(50);
      expect(card.currentHp).toBe(900);
      expect(turn2.expiredEffects).toHaveLength(1);
      expect(card.statusEffects).toHaveLength(0); // Purged
    });

    it('applies Shock and increases incoming damage by 20%', () => {
      const target: TargetCardState = {
        id: 'target-1',
        currentHp: 1000,
        maxHp: 1000,
        currentMana: 50,
      };

      applyStatusEffect(target, 'shock', 2);
      const res = modifyIncomingDamageWithStatus(target, 100);
      expect(res.finalDamage).toBe(120); // 100 + 20%
      expect(res.shockBonus).toBe(20);
    });

    it('absorbs incoming damage with Divine Shield up to 25% max HP', () => {
      const target: TargetCardState = {
        id: 'target-2',
        currentHp: 1000,
        maxHp: 1000,
        currentMana: 50,
      };

      applyStatusEffect(target, 'divine_shield'); // 25% of 1000 = 250 shield
      expect(target.statusEffects![0].potency).toBe(250);

      // Incoming attack of 150 DMG: fully absorbed!
      const hit1 = modifyIncomingDamageWithStatus(target, 150);
      expect(hit1.finalDamage).toBe(0);
      expect(hit1.shieldAbsorbed).toBe(150);
      expect(hit1.shieldBroken).toBe(false);
      expect(target.statusEffects![0].potency).toBe(100);

      // Incoming attack of 150 DMG: 100 absorbed, 50 goes through, shield breaks!
      const hit2 = modifyIncomingDamageWithStatus(target, 150);
      expect(hit2.finalDamage).toBe(50);
      expect(hit2.shieldAbsorbed).toBe(100);
      expect(hit2.shieldBroken).toBe(true);
      expect(target.statusEffects).toHaveLength(0);
    });

    it('stacks Bleed and inflicts action damage', () => {
      const card: TargetCardState = {
        id: 'card-bleed',
        currentHp: 1000,
        maxHp: 1000,
        currentMana: 50,
      };

      applyStatusEffect(card, 'bleed');
      applyStatusEffect(card, 'bleed'); // 2 stacks
      expect(card.statusEffects![0].potency).toBe(2);

      const res = processActionBleed(card);
      expect(res.damage).toBe(60); // 3% * 2 * 1000 = 60
      expect(card.currentHp).toBe(940);
    });

    it('steals MP and transfers to attacker via Void Siphon', () => {
      const attacker = {
        id: 'void-caster',
        currentMana: 20,
        maxMana: 100,
        isAlive: true,
      };

      const target: TargetCardState = {
        id: 'target-unit',
        currentHp: 1000,
        maxHp: 1000,
        currentMana: 15,
      };

      applyStatusEffect(target, 'void_siphon', 2, 10, attacker.id);
      const res = processTurnStartEffects(target, [attacker]);

      expect(res.mpStolen).toBe(10);
      expect(target.currentMana).toBe(5);
      expect(attacker.currentMana).toBe(30);
    });

    it('Freeze breaks upon heavy physical impact >= 100 damage', () => {
      const target: TargetCardState = {
        id: 'frozen-unit',
        currentHp: 1000,
        maxHp: 1000,
        currentMana: 50,
      };

      applyStatusEffect(target, 'freeze', 1);
      expect(target.statusEffects).toHaveLength(1);

      modifyIncomingDamageWithStatus(target, 150);
      expect(target.statusEffects).toHaveLength(0); // Ice shattered
    });
  });

  describe('Team Resonance Passives', () => {
    it('activates Dual Fire Resonance (+15% ATK) when 2 fire cards in lineup', () => {
      const lineup = [
        { element: 'fire', race: 'dragon' },
        { element: 'fire', race: 'elf' },
        { element: 'ice', race: 'human' },
      ];

      const buffs = calculateTeamResonance(lineup);
      expect(buffs).toHaveLength(1);
      expect(buffs[0].id).toBe('resonance_fire');
      expect(buffs[0].atkMultiplier).toBe(1.15);

      const modified = applyResonanceToCardStats({ atk: 100, def: 100 }, buffs);
      expect(modified.atk).toBe(115);
      expect(modified.def).toBe(100);
    });

    it('activates Dual Ice (+20% DEF) and Dual Arcane (+20 Max MP)', () => {
      const iceLineup = [
        { element: 'ice' },
        { element: 'ice' },
        { element: 'water' },
      ];
      const iceBuffs = calculateTeamResonance(iceLineup);
      expect(iceBuffs[0].id).toBe('resonance_ice');
      expect(iceBuffs[0].defMultiplier).toBe(1.2);

      const arcaneLineup = [
        { element: 'arcane' },
        { element: 'arcane' },
        { element: 'light' },
      ];
      const arcaneBuffs = calculateTeamResonance(arcaneLineup);
      expect(arcaneBuffs[0].id).toBe('resonance_arcane');
      expect(arcaneBuffs[0].bonusMaxMana).toBe(20);
    });

    it('activates Prismatic Synergy when all 3 cards have different elements', () => {
      const lineup = [
        { element: 'fire' },
        { element: 'water' },
        { element: 'earth' },
      ];

      const buffs = calculateTeamResonance(lineup);
      expect(buffs).toHaveLength(1);
      expect(buffs[0].id).toBe('resonance_prismatic');
      expect(buffs[0].statMultiplier).toBe(1.1);
      expect(buffs[0].bonusStartingMana).toBe(5);

      const modified = applyResonanceToCardStats(
        { atk: 100, def: 50, spd: 40, maxHp: 1000, currentMana: 20, maxMana: 100 },
        buffs
      );
      expect(modified.atk).toBe(110);
      expect(modified.def).toBe(55);
      expect(modified.spd).toBe(44);
      expect(modified.maxHp).toBe(1100);
      expect(modified.currentMana).toBe(25); // +5 starting mana
    });
  });
});
