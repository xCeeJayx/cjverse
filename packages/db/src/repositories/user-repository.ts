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

export async function ensureUser(id: string, username: string, avatarUrl?: string | null): Promise<UserRecord> {
  const existing = await findUserById(id);
  if (existing) {
    if (avatarUrl !== undefined && existing.avatarUrl !== avatarUrl) {
      try {
        await db.update(users).set({ avatarUrl }).where(eq(users.id, id));
        existing.avatarUrl = avatarUrl;
      } catch (err) {
        console.warn(`[UserRepository] Failed to update avatar for ${id}:`, err);
      }
    }
    return existing;
  }

  const [inserted] = await db
    .insert(users)
    .values({
      id,
      username,
      avatarUrl: avatarUrl || null,
      crystals: 100,
      activeLineup: {
        vanguardCardId: null,
        strikerCardId: null,
        conduitCardId: null,
      },
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        username,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
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
    avatarUrl: avatarUrl || null,
    crystals: 100,
    activeLineup: {
      vanguardCardId: null,
      strikerCardId: null,
      conduitCardId: null,
    },
    createdAt: new Date(),
  };
}

export async function upsertUser(id: string, username: string, avatarUrl?: string | null): Promise<UserRecord> {
  return ensureUser(id, username, avatarUrl);
}
