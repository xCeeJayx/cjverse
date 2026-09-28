import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getQuests } from '../src/app/api/quests/route';
import { POST as claimDaily } from '../src/app/api/quests/daily/route';
import { POST as claimQuest } from '../src/app/api/quests/claim/route';
import { db, users, eq, recordQuestProgress, getDefaultDailyQuests } from '@cjverse/db';

describe('Web Quests & Daily Rewards API Endpoints (/api/quests)', () => {
  const testUserId = 'web-quest-test-user';

  beforeEach(async () => {
    await db.delete(users).where(eq(users.id, testUserId));

    await db.insert(users).values({
      id: testUserId,
      username: 'QuestExplorer',
      crystals: 250,
      dailyStreak: 0,
      lastDailyClaim: null,
      dailyQuests: getDefaultDailyQuests('2026-09-28'),
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });
  });

  describe('GET /api/quests', () => {
    it('rejects unauthenticated request with 401', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/quests',
        cookies: { get: () => undefined },
      };

      const res = await getQuests(mockReq);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns active streak, cooldown timer, and 3 daily quests for user', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/quests?as=${testUserId}`,
        cookies: { get: () => undefined },
      };

      const res = await getQuests(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.streak).toBe(0);
      expect(data.lastDailyClaim).toBeNull();
      expect(data.cooldown.canClaim).toBe(true);
      expect(data.quests).toHaveLength(3);
      expect(data.quests.map((q: any) => q.id)).toEqual(['hunt_cards', 'win_duel', 'upgrade_card']);
      expect(data.crystals).toBe(250);
    });

    it('indicates cooldown when last claim was within 20 hours', async () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      await db
        .update(users)
        .set({ lastDailyClaim: fiveHoursAgo, dailyStreak: 2 })
        .where(eq(users.id, testUserId));

      const mockReq: any = {
        url: `http://localhost:3000/api/quests?as=${testUserId}`,
        cookies: { get: () => undefined },
      };

      const res = await getQuests(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.streak).toBe(2);
      expect(data.cooldown.canClaim).toBe(false);
      expect(data.cooldown.remainingHours).toBeGreaterThanOrEqual(14);
      expect(data.cooldown.remainingHours).toBeLessThanOrEqual(15);
    });
  });

  describe('POST /api/quests/daily', () => {
    it('rejects unauthenticated request with 401', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/quests/daily',
        cookies: { get: () => undefined },
      };

      const res = await claimDaily(mockReq);
      expect(res.status).toBe(401);
    });

    it('claims daily reward, advances streak to 1, and credits crystals', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/quests/daily?as=${testUserId}`,
        cookies: { get: () => undefined },
      };

      const res = await claimDaily(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.streak).toBe(1);
      expect(data.crystalsAwarded).toBe(115); // 100 base + (1 * 15)
      expect(data.newTotalCrystals).toBe(365); // 250 + 115

      // Check DB
      const [updated] = await db.select().from(users).where(eq(users.id, testUserId));
      expect(updated.crystals).toBe(365);
      expect(updated.dailyStreak).toBe(1);
      expect(updated.lastDailyClaim).not.toBeNull();
    });

    it('returns 429 when attempting to claim during cooldown', async () => {
      // First claim
      const mockReq1: any = {
        url: `http://localhost:3000/api/quests/daily?as=${testUserId}`,
        cookies: { get: () => undefined },
      };
      const res1 = await claimDaily(mockReq1);
      expect(res1.status).toBe(200);

      // Second immediate claim attempt
      const mockReq2: any = {
        url: `http://localhost:3000/api/quests/daily?as=${testUserId}`,
        cookies: { get: () => undefined },
      };
      const res2 = await claimDaily(mockReq2);
      expect(res2.status).toBe(429);
      const data2 = await res2.json();
      expect(data2.onCooldown).toBe(true);
    });
  });

  describe('POST /api/quests/claim', () => {
    it('rejects unauthenticated request with 401', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/quests/claim',
        cookies: { get: () => undefined },
        json: async () => ({ questId: 'hunt_cards' }),
      };

      const res = await claimQuest(mockReq);
      expect(res.status).toBe(401);
    });

    it('rejects missing questId with 400', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/quests/claim?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({}),
      };

      const res = await claimQuest(mockReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('questId');
    });

    it('rejects claiming incomplete quest with 400', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/quests/claim?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ questId: 'hunt_cards' }),
      };

      const res = await claimQuest(mockReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('is not yet completed');
    });

    it('successfully claims completed quest reward and awards crystals', async () => {
      // Advance quest to completion
      await recordQuestProgress(testUserId, 'hunt_cards', 2);

      const mockReq: any = {
        url: `http://localhost:3000/api/quests/claim?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ questId: 'hunt_cards' }),
      };

      const res = await claimQuest(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.crystalsAwarded).toBe(50);
      expect(data.newTotalCrystals).toBe(300); // 250 + 50
      expect(data.quest.claimed).toBe(true);

      // Verify double claim is rejected
      const resDouble = await claimQuest(mockReq);
      expect(resDouble.status).toBe(400);
      const doubleData = await resDouble.json();
      expect(doubleData.error).toContain('already been claimed');
    });
  });
});
