import { describe, it, expect } from 'vitest';
import {
  simulateRaidRun,
  executeRaidBossTurn,
  formatBossHpBar,
  getBossElementalMultiplier,
  RaidCombatCard,
  RaidBossConfig,
} from '../src';

describe('World Boss Raid Combat Logic (packages/game-logic)', () => {
  const dummyBoss: RaidBossConfig = {
    id: 'boss-1',
    name: 'Infernal Behemoth',
    element: 'fire',
    totalHp: 500000,
    currentHp: 500000,
    atk: 100,
    def: 50,
  };

  const createLineup = (): RaidCombatCard[] => [
    {
      id: 'c1',
      name: 'Iron Vanguard',
      role: 'vanguard',
      element: 'water',
      maxHp: 1000,
      currentHp: 1000,
      atk: 120,
      def: 80,
      currentMana: 50,
      maxMana: 100,
      isAlive: true,
    },
    {
      id: 'c2',
      name: 'Shadow Striker',
      role: 'striker',
      element: 'fire',
      maxHp: 600,
      currentHp: 600,
      atk: 180,
      def: 40,
      currentMana: 50,
      maxMana: 100,
      isAlive: true,
    },
    {
      id: 'c3',
      name: 'Arcane Conduit',
      role: 'conduit',
      element: 'ice',
      maxHp: 500,
      currentHp: 500,
      atk: 100,
      def: 30,
      currentMana: 50,
      maxMana: 100,
      isAlive: true,
    },
  ];

  it('calculates elemental weakness bonus (1.5x) against boss', () => {
    const waterVsFire = getBossElementalMultiplier('water', 'fire');
    expect(waterVsFire.multiplier).toBe(1.5);
    expect(waterVsFire.isWeakness).toBe(true);

    const neutral = getBossElementalMultiplier('earth', 'fire');
    expect(neutral.multiplier).toBe(1.0);
    expect(neutral.isWeakness).toBe(false);
  });

  it('executes Cleave against the active Vanguard on normal turns', () => {
    const cards = createLineup();
    const vanguardInitialHp = cards[0].currentHp;

    const res = executeRaidBossTurn(dummyBoss, cards, 1); // Turn 1 is normal
    expect(res.actionType).toBe('CLEAVE');
    expect(res.targetsHit).toHaveLength(1);
    expect(res.targetsHit[0].cardId).toBe('c1');
    expect(cards[0].currentHp).toBeLessThan(vanguardInitialHp);
    expect(cards[1].currentHp).toBe(600); // Unharmed
    expect(cards[2].currentHp).toBe(500); // Unharmed
  });

  it('executes Cataclysm AoE hitting all cards simultaneously every 3 turns', () => {
    const cards = createLineup();

    const res = executeRaidBossTurn(dummyBoss, cards, 3); // Turn 3 triggers Cataclysm
    expect(res.actionType).toBe('CATACLYSM');
    expect(res.targetsHit).toHaveLength(3);
    expect(cards[0].currentHp).toBeLessThan(1000);
    expect(cards[1].currentHp).toBeLessThan(600);
    expect(cards[2].currentHp).toBeLessThan(500);
  });

  it('increases boss damage by 300% (4x) when Enraged after 10 turns', () => {
    const cardsNormal = createLineup();
    const resNormal = executeRaidBossTurn(dummyBoss, cardsNormal, 1);

    const cardsEnraged = createLineup();
    const resEnraged = executeRaidBossTurn(dummyBoss, cardsEnraged, 11); // Turn 11 is enraged

    expect(resEnraged.isEnraged).toBe(true);
    expect(resEnraged.actionType).toBe('ENRAGED_CLEAVE');
    // Enraged damage should be ~4x higher than normal cleave damage
    expect(resEnraged.totalDamage).toBeGreaterThanOrEqual(resNormal.totalDamage * 3.5);
  });

  it('simulates complete raid run, accumulating damage and terminating upon wipe or turn 10', () => {
    const cards = createLineup();
    const runResult = simulateRaidRun(cards, dummyBoss, 10);

    expect(runResult.totalDamageDealt).toBeGreaterThan(0);
    expect(runResult.turnsElapsed).toBeGreaterThanOrEqual(1);
    expect(runResult.turnsElapsed).toBeLessThanOrEqual(10);
    expect(runResult.turnLogs.length).toBe(runResult.turnsElapsed);
    expect(runResult.logs.length).toBeGreaterThan(0);
  });

  it('formats visual segmented HP bar accurately', () => {
    const barFull = formatBossHpBar(500000, 500000, 10);
    expect(barFull).toContain('100.0%');
    expect(barFull).toContain('██████████');

    const barHalf = formatBossHpBar(250000, 500000, 10);
    expect(barHalf).toContain('50.0%');
    expect(barHalf).toContain('█████░░░░░');
  });
});
