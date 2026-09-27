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

export async function upsertUser(id: string, username: string) {
  return db.insert(users).values({ id, username }).onConflictDoNothing();
}
