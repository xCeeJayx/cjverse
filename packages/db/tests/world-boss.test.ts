import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureUser,
  getActiveWorldBoss,
  spawnWorldBoss,
  checkUserRaidEligibility,
  submitBossDamage,
  getBossContributors,
  db,
  users,
  cards,
  worldBosses,
  bossContributions,
  eq,
} from '../src';

describe('Server-wide Co-op World Boss Raid (packages/db)', () => {
  const testUserId = 'test-boss-slayer';

  beforeEach(async () => {
    // Reset test data
    await ensureUser(testUserId, 'BossSlayer');
  });

  it('spawns and retrieves active World Boss with full initial HP', async () => {
    const boss = await spawnWorldBoss('Infernal Behemoth', 'fire', 100000);

    expect(boss).toBeDefined();
    expect(boss.name).toBe('Infernal Behemoth');
    expect(boss.element).toBe('fire');
    expect(boss.totalHp).toBe(100000);
    expect(boss.currentHp).toBe(100000);
    expect(boss.status).toBe('active');

    const active = await getActiveWorldBoss();
    expect(active.id).toBe(boss.id);
  });

  it('rejects raid entry if user does not have a complete 3-card lineup', async () => {
    const boss = await getActiveWorldBoss();

    // Clear active lineup
    await db
      .update(users)
      .set({ activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null } })
      .where(eq(users.id, testUserId));

    const eligibility = await checkUserRaidEligibility(boss.id, testUserId);
    expect(eligibility.canFight).toBe(false);
    expect(eligibility.hasLineup).toBe(false);
    expect(eligibility.reason).toContain('equipped before entering');
  }, 20000);

  it('permits raid entry when lineup is complete and limits attempts to 3 per window', async () => {
    const boss = await spawnWorldBoss('Abyssal Leviathan', 'void', 200000);

    // Give user 3 equipped cards
    const [c1] = await db
      .insert(cards)
      .values({
        userId: testUserId,
        race: 'dragon',
        variant: 'gold',
        element: 'water',
        elementTier: 'A',
        powerScore: 250,
        seed: 101,
      })
      .returning();

    const [c2] = await db
      .insert(cards)
      .values({
        userId: testUserId,
        race: 'elf',
        variant: 'silver',
        element: 'fire',
        elementTier: 'A',
        powerScore: 230,
        seed: 102,
      })
      .returning();

    const [c3] = await db
      .insert(cards)
      .values({
        userId: testUserId,
        race: 'human',
        variant: 'normal',
        element: 'ice',
        elementTier: 'A',
        powerScore: 210,
        seed: 103,
      })
      .returning();

    await db
      .update(users)
      .set({
        activeLineup: {
          vanguardCardId: c1.id,
          strikerCardId: c2.id,
          conduitCardId: c3.id,
        },
      })
      .where(eq(users.id, testUserId));

    const el1 = await checkUserRaidEligibility(boss.id, testUserId);
    expect(el1.canFight).toBe(true);
    expect(el1.attemptsRemaining).toBe(3);

    // Submit 3 attempts
    await submitBossDamage(boss.id, testUserId, 1000);
    await submitBossDamage(boss.id, testUserId, 1500);
    await submitBossDamage(boss.id, testUserId, 2000);

    const elExhausted = await checkUserRaidEligibility(boss.id, testUserId);
    expect(elExhausted.canFight).toBe(false);
    expect(elExhausted.attemptsRemaining).toBe(0);
    expect(elExhausted.reason).toContain('maximum 3 raid attempts');
  }, 20000);

  it('atomically submits damage, decrements boss HP, and transitions to defeated at 0 HP', async () => {
    const boss = await spawnWorldBoss('Glacial Titan', 'ice', 5000);

    // 1. Partial damage
    const hit1 = await submitBossDamage(boss.id, testUserId, 2000);
    expect(hit1.success).toBe(true);
    expect(hit1.boss.currentHp).toBe(3000);
    expect(hit1.boss.status).toBe('active');
    expect(hit1.userContribution.totalDamage).toBe(2000);
    expect(hit1.bossDefeated).toBe(false);

    // 2. Fatal damage exceeding remaining HP
    const hit2 = await submitBossDamage(boss.id, testUserId, 4000);
    expect(hit2.success).toBe(true);
    expect(hit2.boss.currentHp).toBe(0);
    expect(hit2.boss.status).toBe('defeated');
    expect(hit2.bossDefeated).toBe(true);
    expect(hit2.rewardAwarded).toBe(250); // Defeat bonus awarded!

    // Verify contributors list
    const contributors = await getBossContributors(boss.id, 5);
    expect(contributors.length).toBeGreaterThanOrEqual(1);
    expect(contributors[0].userId).toBe(testUserId);
    expect(contributors[0].totalDamage).toBe(6000);
  }, 20000);
});
