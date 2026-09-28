import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getBoss } from '../src/app/api/boss/route';
import { POST as submitDamage } from '../src/app/api/boss/submit-damage/route';
import {
  db,
  users,
  worldBosses,
  bossContributions,
  eq,
  spawnWorldBoss,
} from '@cjverse/db';

describe('Web Boss API Endpoints (/api/boss)', () => {
  const testUserId = 'web-boss-tester-user';
  const testBossId = 'web-boss-test-1';

  beforeEach(async () => {
    await db.delete(bossContributions).where(eq(bossContributions.bossId, testBossId));
    await db.delete(bossContributions).where(eq(bossContributions.userId, testUserId));
    await db.delete(worldBosses).where(eq(worldBosses.id, testBossId));
    await db.delete(users).where(eq(users.id, testUserId));

    // Seed test user with full 3-card lineup
    await db.insert(users).values({
      id: testUserId,
      username: 'BossRaidHero',
      crystals: 100,
      activeLineup: {
        vanguardCardId: 'card-vg-1',
        strikerCardId: 'card-st-1',
        conduitCardId: 'card-cd-1',
      },
    });

    // Seed test world boss with 5000 HP
    await db.insert(worldBosses).values({
      id: testBossId,
      name: 'Test Abyssal Behemoth',
      element: 'water',
      totalHp: 5000,
      currentHp: 5000,
      status: 'active',
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    });
  });

  describe('GET /api/boss', () => {
    it('returns boss details, hpPercent, and contributors', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/boss?bossId=${testBossId}`,
        cookies: { get: () => undefined },
      };

      const res = await getBoss(mockReq);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.boss).toBeDefined();
      expect(data.boss.id).toBe(testBossId);
      expect(data.boss.name).toBe('Test Abyssal Behemoth');
      expect(data.boss.hpPercent).toBe(100);
      expect(Array.isArray(data.contributors)).toBe(true);
      expect(data.userEligibility).toBeNull();
    });

    it('returns user eligibility when authenticated with ?as=', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/boss?bossId=${testBossId}&as=${testUserId}`,
        cookies: { get: () => undefined },
      };

      const res = await getBoss(mockReq);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.userEligibility).toBeDefined();
      expect(data.userEligibility.canFight).toBe(true);
      expect(data.userEligibility.attemptsRemaining).toBe(3);
    });
  });

  describe('POST /api/boss/submit-damage', () => {
    it('rejects unauthenticated request with 401', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/boss/submit-damage',
        cookies: { get: () => undefined },
        json: async () => ({ bossId: testBossId, damageDealt: 500 }),
      };

      const res = await submitDamage(mockReq);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects invalid damage payload with 400', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/boss/submit-damage?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ bossId: testBossId, damageDealt: -100 }),
      };

      const res = await submitDamage(mockReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid damageDealt');
    });

    it('atomically records contribution and reduces boss currentHp', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/boss/submit-damage?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ bossId: testBossId, damageDealt: 1200 }),
      };

      const res = await submitDamage(mockReq);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.damageSubmitted).toBe(1200);
      expect(data.boss.currentHp).toBe(3800);
      expect(data.boss.status).toBe('active');
      expect(data.userContribution.totalDamage).toBe(1200);
      expect(data.userContribution.attemptsCount).toBe(1);
    });

    it('transitions boss to defeated when HP drops to 0 and awards crystal reward', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/boss/submit-damage?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ bossId: testBossId, damageDealt: 6000 }),
      };

      const res = await submitDamage(mockReq);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.boss.currentHp).toBe(0);
      expect(data.boss.status).toBe('defeated');
      expect(data.bossDefeated).toBe(true);
      expect(data.rewardAwarded).toBeGreaterThan(0);

      // Subsequent damage to defeated boss is rejected
      const mockReq2: any = {
        url: `http://localhost:3000/api/boss/submit-damage?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ bossId: testBossId, damageDealt: 500 }),
      };
      const res2 = await submitDamage(mockReq2);
      expect(res2.status).toBe(400);
      const data2 = await res2.json();
      expect(data2.error).toContain('already defeated');
    });
  });
});
