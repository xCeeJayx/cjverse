import { eq, sql } from 'drizzle-orm';
import { db } from '../client';
import {
  users,
  UserDailyQuests,
  DailyQuestItem,
  getDefaultDailyQuests,
} from '../schema/users';
import { findUserById, ensureUser } from './user-repository';

export interface DailyClaimResult {
  success: boolean;
  onCooldown?: boolean;
  remainingMs?: number;
  remainingHours?: number;
  remainingMinutes?: number;
  streak?: number;
  crystalsAwarded?: number;
  streakBonus?: number;
  newTotalCrystals?: number;
  message?: string;
  error?: string;
}

export interface QuestClaimResult {
  success: boolean;
  quest?: DailyQuestItem;
  crystalsAwarded?: number;
  newTotalCrystals?: number;
  error?: string;
}

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Ensures user daily quests are synced and refreshed if the UTC date has rolled over.
 */
export function syncDailyQuests(questsData: UserDailyQuests | null | undefined): {
  synced: UserDailyQuests;
  wasReset: boolean;
} {
  const today = getTodayDateString();

  if (!questsData || !questsData.quests || questsData.quests.length === 0) {
    return {
      synced: getDefaultDailyQuests(today),
      wasReset: true,
    };
  }

  if (questsData.lastResetDate !== today) {
    const fresh = getDefaultDailyQuests(today);
    return {
      synced: fresh,
      wasReset: true,
    };
  }

  return {
    synced: questsData,
    wasReset: false,
  };
}

/**
 * Claim daily login crystals and advance streak.
 * Cooldown: 20 hours to prevent time drift.
 * Between 20 and 48 hours: streak += 1.
 * > 48 hours (or first claim): streak = 1.
 * Reward: 100 crystals + min(250, streak * 15).
 */
export async function claimDailyReward(userId: string): Promise<DailyClaimResult> {
  const user = await findUserById(userId);
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const now = Date.now();
  const lastClaim = user.lastDailyClaim ? new Date(user.lastDailyClaim).getTime() : null;

  if (lastClaim) {
    const elapsedMs = now - lastClaim;
    const cooldownMs = 20 * 60 * 60 * 1000; // 20 hours

    if (elapsedMs < cooldownMs) {
      const remainingMs = cooldownMs - elapsedMs;
      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

      return {
        success: false,
        onCooldown: true,
        remainingMs,
        remainingHours,
        remainingMinutes,
        streak: user.dailyStreak || 0,
        message: `Daily reward is on cooldown. Try again in ${remainingHours}h ${remainingMinutes}m.`,
      };
    }
  }

  // Calculate new streak
  let newStreak = 1;
  if (lastClaim) {
    const elapsedHours = (now - lastClaim) / (1000 * 60 * 60);
    if (elapsedHours >= 20 && elapsedHours <= 48) {
      newStreak = (user.dailyStreak || 0) + 1;
    } else {
      // Over 48 hours: streak resets to 1
      newStreak = 1;
    }
  }

  // Base reward: 100 crystals + (streak * 15 crystals, max 250 bonus)
  const streakBonus = Math.min(250, newStreak * 15);
  const crystalsAwarded = 100 + streakBonus;
  const newTotalCrystals = (user.crystals || 0) + crystalsAwarded;

  await db
    .update(users)
    .set({
      crystals: newTotalCrystals,
      lastDailyClaim: new Date(now),
      dailyStreak: newStreak,
    })
    .where(eq(users.id, userId));

  return {
    success: true,
    streak: newStreak,
    crystalsAwarded,
    streakBonus,
    newTotalCrystals,
    message: `Claimed daily reward! +${crystalsAwarded} Crystals (Streak: ${newStreak} days 🔥)`,
  };
}

/**
 * Fetch user daily quest state, automatically resetting if it's a new day.
 */
export async function getUserDailyQuests(userId: string): Promise<{
  userDailyQuests: UserDailyQuests;
  dailyStreak: number;
  lastDailyClaim: Date | null;
  crystals: number;
}> {
  let user = await findUserById(userId);
  if (!user) {
    user = await ensureUser(userId, userId);
  }

  const { synced, wasReset } = syncDailyQuests(user.dailyQuests);

  if (wasReset) {
    await db
      .update(users)
      .set({ dailyQuests: synced })
      .where(eq(users.id, userId));
  }

  return {
    userDailyQuests: synced,
    dailyStreak: user.dailyStreak ?? 0,
    lastDailyClaim: user.lastDailyClaim ?? null,
    crystals: user.crystals ?? 0,
  };
}

/**
 * Increment progression for a specific daily quest ('hunt_cards', 'win_duel', 'upgrade_card').
 */
export async function recordQuestProgress(
  userId: string,
  questId: 'hunt_cards' | 'win_duel' | 'upgrade_card',
  amount = 1
): Promise<{
  updated: boolean;
  completedNow: boolean;
  quest?: DailyQuestItem;
  dailyQuests?: UserDailyQuests;
}> {
  if (userId.startsWith('BOT') || userId.includes('TRAINER')) {
    return { updated: false, completedNow: false };
  }

  let user = await findUserById(userId);
  if (!user) {
    user = await ensureUser(userId, userId);
  }

  const { synced } = syncDailyQuests(user.dailyQuests);
  let completedNow = false;
  let targetQuest: DailyQuestItem | undefined;

  for (const q of synced.quests) {
    if (q.id === questId) {
      targetQuest = q;
      const prevCompleted = q.completed;
      q.current = Math.min(q.target, q.current + amount);
      if (q.current >= q.target) {
        q.completed = true;
        if (!prevCompleted) {
          completedNow = true;
        }
      }
      break;
    }
  }

  if (targetQuest) {
    await db
      .update(users)
      .set({ dailyQuests: synced })
      .where(eq(users.id, userId));

    return {
      updated: true,
      completedNow,
      quest: targetQuest,
      dailyQuests: synced,
    };
  }

  return { updated: false, completedNow: false };
}

/**
 * Claim the reward for a completed quest.
 */
export async function claimQuestReward(
  userId: string,
  questId: string
): Promise<QuestClaimResult> {
  const user = await findUserById(userId);
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const { synced, wasReset } = syncDailyQuests(user.dailyQuests);
  if (wasReset) {
    await db
      .update(users)
      .set({ dailyQuests: synced })
      .where(eq(users.id, userId));
  }

  const quest = synced.quests.find((q) => q.id === questId);
  if (!quest) {
    return { success: false, error: `Quest '${questId}' not found.` };
  }

  if (!quest.completed) {
    return {
      success: false,
      error: `Quest '${quest.title}' is not yet completed (${quest.current}/${quest.target}).`,
    };
  }

  if (quest.claimed) {
    return {
      success: false,
      error: `Reward for quest '${quest.title}' has already been claimed today.`,
    };
  }

  // Mark as claimed and credit crystals
  quest.claimed = true;
  const newTotalCrystals = (user.crystals || 0) + quest.reward;

  await db
    .update(users)
    .set({
      crystals: newTotalCrystals,
      dailyQuests: synced,
    })
    .where(eq(users.id, userId));

  return {
    success: true,
    quest,
    crystalsAwarded: quest.reward,
    newTotalCrystals,
  };
}
