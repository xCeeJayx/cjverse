// apps/game-server/tests/action-resolution.test.ts
import { describe, it, expect } from 'vitest';
import { resolveAction, CombatTarget } from '../src/engine/action-resolver';
import { determineFallbackAction } from '../src/engine/auto-battle';

describe('Authoritative Action Resolution & Fallback AI', () => {
  it('deducts damage from target HP and consumes mana on elemental burst', () => {
    const actor = { id: 'c1', atk: 150, currentMana: 40, element: 'fire' };
    const target: CombatTarget = { id: 'c2', def: 50, currentHp: 500, maxHp: 500 };
    const resolution = resolveAction('ELEMENTAL_BURST', actor, target);

    expect(resolution.damage).toBeGreaterThan(0);
    expect(target.currentHp).toBeLessThan(500);
    expect(actor.currentMana).toBe(10); // 40 - 30 mana cost
  });

  it('inflicts signature status effect on ULTIMATE (100% chance)', () => {
    const actor = { id: 'c1', atk: 150, currentMana: 70, maxMana: 100, element: 'ice' };
    const target: CombatTarget = { id: 'c2', def: 50, currentHp: 500, maxHp: 500, statusEffects: [] };
    const resolution = resolveAction('ULTIMATE', actor, target);

    expect(resolution.statusApplied).toBeDefined();
    expect(target.statusEffects?.some((e) => e.type === 'freeze')).toBe(true);
    expect(resolution.animations).toContain('STATUS_FREEZE');
  });

  it('absorbs damage using Divine Shield and increases damage with Shock', () => {
    // 1. Shock test
    const actor = { id: 'c1', atk: 100, currentMana: 10, element: 'fire' };
    const target = {
      id: 'c2',
      def: 20,
      currentHp: 1000,
      maxHp: 1000,
      statusEffects: [
        {
          id: 's1',
          type: 'shock' as const,
          name: 'Shock',
          duration: 2,
          potency: 0.2,
          badge: '⚡ 2T',
          icon: '⚡',
        },
      ],
    };
    const resShock = resolveAction('BASIC_ATTACK', actor, target, { forceCrit: false });
    // base damage for 100 atk vs 20 def is ~83. With +20% shock => ~100
    expect(resShock.damage).toBeGreaterThanOrEqual(95);

    // 2. Divine Shield test
    const shieldedTarget = {
      id: 'c3',
      def: 20,
      currentHp: 1000,
      maxHp: 1000,
      statusEffects: [
        {
          id: 's2',
          type: 'divine_shield' as const,
          name: 'Divine Shield',
          duration: 2,
          potency: 150,
          badge: '🛡️ 2T',
          icon: '🛡️',
        },
      ],
    };
    const resShield = resolveAction('BASIC_ATTACK', actor, shieldedTarget, { forceCrit: false });
    expect(resShield.shieldAbsorbed).toBeGreaterThan(0);
    expect(resShield.damage).toBe(0);
    expect(shieldedTarget.currentHp).toBe(1000);
  });

  it('applies lifesteal healing on basic attack with Shadow Resonance', () => {
    const actor = {
      id: 'c1',
      atk: 100,
      currentMana: 0,
      currentHp: 200,
      maxHp: 500,
      element: 'shadow',
      lifesteal: 0.1,
    };
    const target = { id: 'c2', def: 20, currentHp: 500, maxHp: 500, statusEffects: [] };
    const res = resolveAction('BASIC_ATTACK', actor, target, { forceCrit: false });

    expect(res.lifestealHealed).toBeGreaterThan(0);
    expect(actor.currentHp).toBeGreaterThan(200);
  });
});
