// apps/game-server/tests/action-resolution.test.ts
import { describe, it, expect } from 'vitest';
import { resolveAction } from '../src/engine/action-resolver';
import { determineFallbackAction } from '../src/engine/auto-battle';

describe('Authoritative Action Resolution & Fallback AI', () => {
  it('deducts damage from target HP and consumes mana on elemental burst', () => {
    const actor = { id: 'c1', atk: 150, currentMana: 40, element: 'fire' };
    const target = { id: 'c2', def: 50, currentHp: 500 };
    const resolution = resolveAction('ELEMENTAL_BURST', actor, target);

    expect(resolution.damage).toBeGreaterThan(0);
    expect(target.currentHp).toBeLessThan(500);
    expect(actor.currentMana).toBe(10); // 40 - 30 mana cost
  });

  // Review Focus Check: Auto-Battle Fallback on 15s Timeout
  it('executes fallback attack on lowest HP enemy when 15s turn timer expires', () => {
    const actor = { id: 'c1', atk: 100, element: 'fire', currentMana: 0 };
    const enemies = [
      { id: 'tank', currentHp: 800, role: 'vanguard', element: 'earth' },
      { id: 'low-hp', currentHp: 50, role: 'striker', element: 'wind' }
    ];
    const fallback = determineFallbackAction(actor, enemies);
    expect(fallback.targetCardId).toBe('low-hp');
    expect(fallback.actionType).toBe('BASIC_ATTACK');
  });
});
