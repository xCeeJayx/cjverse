import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  users,
  eq,
  claimDailyReward,
  getUserDailyQuests,
  recordQuestProgress,
  claimQuestReward,
} from '@cjverse/db';
import { handleDailyCommand } from '../src/commands/daily';
import { handleQuestsCommand, handleQuestClaimCommand } from '../src/commands/quests';

describe('Daily Rewards, Streak System, and Daily Quests', () => {
  const testUserId = 'test-daily-user-1';

  beforeEach(async () => {
    await db.delete(users).where(eq(users.id, testUserId));

    await db.insert(users).values({
      id: testUserId,
      username: 'DailyAdventurer',
      crystals: 100,
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });
  });

  describe('Daily Rewards & Streaks', () => {
    it('claims initial daily reward and sets streak to 1', async () => {
      const res = await claimDailyReward(testUserId);
      expect(res.success).toBe(true);
      expect(res.streak).toBe(1);
      expect(res.streakBonus).toBe(15);
      expect(res.crystalsAwarded).toBe(115); // 100 + 15
      expect(res.newTotalCrystals).toBe(215);

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      expect(user.crystals).toBe(215);
      expect(user.dailyStreak).toBe(1);
      expect(user.lastDailyClaim).not.toBeNull();
    });

    it('rejects claim if attempted within 20 hours', async () => {
      await claimDailyReward(testUserId);

      // Attempt second claim immediately
      const res = await claimDailyReward(testUserId);
      expect(res.success).toBe(false);
      expect(res.onCooldown).toBe(true);
      expect(res.remainingHours).toBeGreaterThanOrEqual(19);
      expect(res.message).toContain('cooldown');
    });

    it('increments streak when claiming between 20 and 48 hours later', async () => {
      // Set lastDailyClaim to 24 hours ago
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await db
        .update(users)
        .set({
          lastDailyClaim: twentyFourHoursAgo,
          dailyStreak: 3,
          crystals: 200,
        })
        .where(eq(users.id, testUserId));

      const res = await claimDailyReward(testUserId);
      expect(res.success).toBe(true);
      expect(res.streak).toBe(4);
      expect(res.streakBonus).toBe(60); // 4 * 15
      expect(res.crystalsAwarded).toBe(160); // 100 + 60
      expect(res.newTotalCrystals).toBe(360);
    });

    it('resets streak to 1 if last claim was > 48 hours ago', async () => {
      // Set lastDailyClaim to 50 hours ago
      const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);
      await db
        .update(users)
        .set({
          lastDailyClaim: fiftyHoursAgo,
          dailyStreak: 10,
          crystals: 300,
        })
        .where(eq(users.id, testUserId));

      const res = await claimDailyReward(testUserId);
      expect(res.success).toBe(true);
      expect(res.streak).toBe(1);
      expect(res.streakBonus).toBe(15);
      expect(res.crystalsAwarded).toBe(115);
    });

    it('renders celebratory embed on successful /daily command', async () => {
      const res = await handleDailyCommand(testUserId);
      expect(res.success).toBe(true);
      expect(res.embed.data.title).toContain('Daily Login Reward Claimed');
      expect(res.embed.data.description).toContain('115 Crystals');
    });
  });

  describe('Daily Quests System', () => {
    it('initializes 3 daily quests with 0 progress', async () => {
      const { userDailyQuests, dailyStreak } = await getUserDailyQuests(testUserId);
      expect(dailyStreak).toBe(0);
      expect(userDailyQuests.quests).toHaveLength(3);

      const huntQuest = userDailyQuests.quests.find((q) => q.id === 'hunt_cards');
      const winQuest = userDailyQuests.quests.find((q) => q.id === 'win_duel');
      const upgradeQuest = userDailyQuests.quests.find((q) => q.id === 'upgrade_card');

      expect(huntQuest).toBeDefined();
      expect(huntQuest?.target).toBe(2);
      expect(huntQuest?.current).toBe(0);
      expect(huntQuest?.completed).toBe(false);

      expect(winQuest?.target).toBe(1);
      expect(upgradeQuest?.target).toBe(1);
    });

    it('tracks quest progress and marks completed when target reached', async () => {
      // Hunt 1 card
      const step1 = await recordQuestProgress(testUserId, 'hunt_cards', 1);
      expect(step1.updated).toBe(true);
      expect(step1.completedNow).toBe(false);
      expect(step1.quest?.current).toBe(1);
      expect(step1.quest?.completed).toBe(false);

      // Hunt second card -> completes quest!
      const step2 = await recordQuestProgress(testUserId, 'hunt_cards', 1);
      expect(step2.updated).toBe(true);
      expect(step2.completedNow).toBe(true);
      expect(step2.quest?.current).toBe(2);
      expect(step2.quest?.completed).toBe(true);
      expect(step2.quest?.claimed).toBe(false);
    });

    it('rejects claiming incomplete quest', async () => {
      const res = await claimQuestReward(testUserId, 'hunt_cards');
      expect(res.success).toBe(false);
      expect(res.error).toContain('not yet completed');
    });

    it('claims reward for completed quest and prevents double-claiming', async () => {
      // Complete upgrade quest
      await recordQuestProgress(testUserId, 'upgrade_card', 1);

      // Claim reward (+60 crystals)
      const claim1 = await claimQuestReward(testUserId, 'upgrade_card');
      expect(claim1.success).toBe(true);
      expect(claim1.crystalsAwarded).toBe(60);
      expect(claim1.newTotalCrystals).toBe(160); // 100 + 60

      // Attempt duplicate claim
      const claim2 = await claimQuestReward(testUserId, 'upgrade_card');
      expect(claim2.success).toBe(false);
      expect(claim2.error).toContain('already been claimed');
    });

    it('renders quest progress bar and claim buttons via /quests command', async () => {
      // Complete win_duel quest
      await recordQuestProgress(testUserId, 'win_duel', 1);

      const res = await handleQuestsCommand(testUserId);
      expect(res.embed).toBeDefined();
      expect(res.embed.data.title).toContain('Daily Quests');
      expect(res.embed.data.description).toContain('Win 1 Arena Duel');
      expect(res.embed.data.description).toContain('Ready to Claim');

      // Should have 1 claim button for win_duel
      expect(res.components).toHaveLength(1);
      expect(res.components[0].components).toHaveLength(1);
      expect(res.components[0].components[0].data).toMatchObject({
        custom_id: 'quest_claim_win_duel',
      });
    });
  });
});
