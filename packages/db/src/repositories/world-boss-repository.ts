import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../client';
import {
  worldBosses,
  bossContributions,
  WorldBoss,
  BossContribution,
  generateBossId,
} from '../schema/world-boss';
import { users, UserActiveLineup } from '../schema/users';
import { findUserById, ensureUser } from './user-repository';

export interface BossContributorEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalDamage: number;
  attemptsCount: number;
}

export interface RaidEligibilityResult {
  canFight: boolean;
  reason?: string;
  attemptsRemaining: number;
  maxAttempts: number;
  resetsInHours?: number;
  hasLineup: boolean;
}

export interface SubmitDamageResult {
  success: boolean;
  boss: WorldBoss;
  userContribution: BossContribution;
  damageSubmitted: number;
  bossDefeated: boolean;
  rewardAwarded?: number;
  error?: string;
}

const DEFAULT_BOSS_PRESETS = [
  { name: 'Abyssal Leviathan', element: 'void', totalHp: 500000 },
  { name: 'Infernal Behemoth', element: 'fire', totalHp: 500000 },
  { name: 'Glacial Titan', element: 'ice', totalHp: 500000 },
  { name: 'Storm Tempest', element: 'lightning', totalHp: 500000 },
];

/**
 * Retrieves the currently active World Boss, automatically creating one if none exists.
 */
export async function getActiveWorldBoss(): Promise<WorldBoss> {
  const now = new Date();

  // Look for currently active boss
  const [activeBoss] = await db
    .select()
    .from(worldBosses)
    .where(eq(worldBosses.status, 'active'))
    .orderBy(desc(worldBosses.startsAt))
    .limit(1);

  if (activeBoss) {
    // Check if expired
    if (activeBoss.expiresAt && new Date(activeBoss.expiresAt) <= now) {
      await db
        .update(worldBosses)
        .set({ status: 'expired' })
        .where(eq(worldBosses.id, activeBoss.id));

      // Spawn a new active boss
      return spawnWorldBoss();
    }
    return activeBoss;
  }

  // No active boss exists, spawn default one
  return spawnWorldBoss();
}

/**
 * Spawns a new World Boss instance.
 */
export async function spawnWorldBoss(
  presetName?: string,
  elementOverride?: string,
  hpOverride?: number,
  durationHours = 24
): Promise<WorldBoss> {
  const preset =
    DEFAULT_BOSS_PRESETS.find((p) => p.name.toLowerCase() === (presetName || '').toLowerCase()) ||
    DEFAULT_BOSS_PRESETS[Math.floor(Math.random() * DEFAULT_BOSS_PRESETS.length)];

  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);
  const totalHp = hpOverride || preset.totalHp;

  const [newBoss] = await db
    .insert(worldBosses)
    .values({
      id: generateBossId(),
      name: presetName || preset.name,
      element: elementOverride || preset.element,
      totalHp,
      currentHp: totalHp,
      status: 'active',
      startsAt,
      expiresAt,
    })
    .returning();

  return newBoss;
}

/**
 * Fetches World Boss by ID.
 */
export async function findWorldBossById(bossId: string): Promise<WorldBoss | null> {
  const [boss] = await db
    .select()
    .from(worldBosses)
    .where(eq(worldBosses.id, bossId))
    .limit(1);

  return boss || null;
}

/**
 * Retrieves top damage contributors for a specific World Boss.
 */
export async function getBossContributors(
  bossId: string,
  limit = 5
): Promise<BossContributorEntry[]> {
  const rows = await db
    .select({
      userId: bossContributions.userId,
      username: users.username,
      avatarUrl: users.avatarUrl,
      totalDamage: bossContributions.totalDamage,
      attemptsCount: bossContributions.attemptsCount,
    })
    .from(bossContributions)
    .innerJoin(users, eq(bossContributions.userId, users.id))
    .where(eq(bossContributions.bossId, bossId))
    .orderBy(desc(bossContributions.totalDamage))
    .limit(limit);

  return rows;
}

/**
 * Checks a user's eligibility to fight the World Boss (active lineup & 3 attempts per 12h).
 */
export async function checkUserRaidEligibility(
  bossId: string,
  userId: string
): Promise<RaidEligibilityResult> {
  let user = await findUserById(userId);
  if (!user) {
    user = await ensureUser(userId, userId);
  }

  // 1. Verify user has a fully equipped lineup (vanguard, striker, conduit)
  const lineup = user.activeLineup as UserActiveLineup | null;
  const hasLineup = Boolean(
    lineup &&
      lineup.vanguardCardId &&
      lineup.strikerCardId &&
      lineup.conduitCardId
  );

  if (!hasLineup) {
    return {
      canFight: false,
      reason: 'You must have all 3 lineup slots (Vanguard, Striker, Conduit) equipped before entering the World Boss raid.',
      attemptsRemaining: 0,
      maxAttempts: 3,
      hasLineup: false,
    };
  }

  // 2. Check 12-hour raid attempts cooldown (limit: 3 attempts per 12h)
  const [contribution] = await db
    .select()
    .from(bossContributions)
    .where(
      and(
        eq(bossContributions.bossId, bossId),
        eq(bossContributions.userId, userId)
      )
    )
    .limit(1);

  const MAX_ATTEMPTS = 3;
  const WINDOW_MS = 12 * 60 * 60 * 1000;
  const now = Date.now();

  if (!contribution) {
    return {
      canFight: true,
      attemptsRemaining: MAX_ATTEMPTS,
      maxAttempts: MAX_ATTEMPTS,
      hasLineup: true,
    };
  }

  const lastAttemptTime = new Date(contribution.lastAttemptAt).getTime();
  const elapsed = now - lastAttemptTime;

  if (elapsed >= WINDOW_MS) {
    // 12-hour window has expired, reset attempts
    return {
      canFight: true,
      attemptsRemaining: MAX_ATTEMPTS,
      maxAttempts: MAX_ATTEMPTS,
      hasLineup: true,
    };
  }

  const currentAttempts = contribution.attemptsCount;
  const remaining = Math.max(0, MAX_ATTEMPTS - currentAttempts);
  const resetsInMs = WINDOW_MS - elapsed;
  const resetsInHours = Math.max(1, Math.ceil(resetsInMs / (1000 * 60 * 60)));

  if (remaining <= 0) {
    return {
      canFight: false,
      reason: `You have reached the maximum 3 raid attempts for this 12-hour window. Resets in approximately ${resetsInHours}h.`,
      attemptsRemaining: 0,
      maxAttempts: MAX_ATTEMPTS,
      resetsInHours,
      hasLineup: true,
    };
  }

  return {
    canFight: true,
    attemptsRemaining: remaining,
    maxAttempts: MAX_ATTEMPTS,
    resetsInHours,
    hasLineup: true,
  };
}

/**
 * Atomically submits damage dealt to a World Boss, updates player contribution,
 * decrements boss HP, and checks for boss defeat.
 */
export async function submitBossDamage(
  bossId: string,
  userId: string,
  damageDealt: number
): Promise<SubmitDamageResult> {
  const safeDamage = Math.max(0, Math.floor(damageDealt));

  // Ensure user exists
  await ensureUser(userId, userId);

  // Fetch current boss
  const [boss] = await db
    .select()
    .from(worldBosses)
    .where(eq(worldBosses.id, bossId))
    .limit(1);

  if (!boss) {
    throw new Error(`World Boss ${bossId} not found.`);
  }

  if (boss.status !== 'active') {
    throw new Error(`World Boss ${boss.name} is already ${boss.status}.`);
  }

  const newCurrentHp = Math.max(0, boss.currentHp - safeDamage);
  const bossDefeated = newCurrentHp <= 0;
  const newStatus = bossDefeated ? 'defeated' : 'active';

  // 1. Update Boss HP and Status
  const [updatedBoss] = await db
    .update(worldBosses)
    .set({
      currentHp: newCurrentHp,
      status: newStatus,
    })
    .where(eq(worldBosses.id, bossId))
    .returning();

  // 2. Update or Insert User Contribution
  const [existingContrib] = await db
    .select()
    .from(bossContributions)
    .where(
      and(
        eq(bossContributions.bossId, bossId),
        eq(bossContributions.userId, userId)
      )
    )
    .limit(1);

  const WINDOW_MS = 12 * 60 * 60 * 1000;
  const now = new Date();

  let updatedContrib: BossContribution;

  if (existingContrib) {
    const elapsed = now.getTime() - new Date(existingContrib.lastAttemptAt).getTime();
    const shouldResetWindow = elapsed >= WINDOW_MS;
    const newAttemptsCount = shouldResetWindow ? 1 : existingContrib.attemptsCount + 1;

    const [contrib] = await db
      .update(bossContributions)
      .set({
        totalDamage: existingContrib.totalDamage + safeDamage,
        attemptsCount: newAttemptsCount,
        lastAttemptAt: now,
      })
      .where(eq(bossContributions.id, existingContrib.id))
      .returning();

    updatedContrib = contrib;
  } else {
    const [contrib] = await db
      .insert(bossContributions)
      .values({
        bossId,
        userId,
        totalDamage: safeDamage,
        attemptsCount: 1,
        lastAttemptAt: now,
      })
      .returning();

    updatedContrib = contrib;
  }

  // 3. If boss was defeated, distribute crystal bounty rewards to the participant
  let rewardAwarded = 0;
  if (bossDefeated) {
    rewardAwarded = 250; // Defeat bonus crystals
    await db
      .update(users)
      .set({ crystals: sql`${users.crystals} + ${rewardAwarded}` })
      .where(eq(users.id, userId));
  } else {
    // Participation reward: 25 crystals
    rewardAwarded = 25;
    await db
      .update(users)
      .set({ crystals: sql`${users.crystals} + ${rewardAwarded}` })
      .where(eq(users.id, userId));
  }

  return {
    success: true,
    boss: updatedBoss,
    userContribution: updatedContrib,
    damageSubmitted: safeDamage,
    bossDefeated,
    rewardAwarded,
  };
}
