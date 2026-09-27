import { eq } from 'drizzle-orm';
import { db } from '../client';
import { users, UserActiveLineup } from '../schema/users';

export type UserRecord = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export function validateLineup(lineup: UserActiveLineup): { valid: boolean; error?: string } {
  const slots = [lineup.vanguardCardId, lineup.strikerCardId, lineup.conduitCardId].filter(
    (id): id is string => Boolean(id)
  );

  const uniqueSlots = new Set(slots);
  if (uniqueSlots.size !== slots.length) {
    return {
      valid: false,
      error: 'Duplicate card IDs found in active lineup.',
    };
  }

  return { valid: true };
}

export function isLineupComplete(lineup: UserActiveLineup | null | undefined): boolean {
  if (!lineup) return false;
  return Boolean(lineup.vanguardCardId && lineup.strikerCardId && lineup.conduitCardId);
}

export async function findUserById(userId: string): Promise<UserRecord | undefined> {
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function ensureUser(id: string, username: string): Promise<UserRecord> {
  const existing = await findUserById(id);
  if (existing) {
    return existing;
  }

  const [inserted] = await db
    .insert(users)
    .values({
      id,
      username,
      crystals: 100,
      activeLineup: {
        vanguardCardId: null,
        strikerCardId: null,
        conduitCardId: null,
      },
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { username },
    })
    .returning();

  if (inserted) {
    return inserted;
  }

  const fallback = await findUserById(id);
  if (fallback) {
    return fallback;
  }

  return {
    id,
    username,
    avatarUrl: null,
    crystals: 100,
    activeLineup: {
      vanguardCardId: null,
      strikerCardId: null,
      conduitCardId: null,
    },
    createdAt: new Date(),
  };
}

export async function upsertUser(id: string, username: string): Promise<UserRecord> {
  return ensureUser(id, username);
}
