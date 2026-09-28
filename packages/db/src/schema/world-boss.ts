import { pgTable, varchar, integer, timestamp, serial, text } from 'drizzle-orm/pg-core';
import { users } from './users';

export function generateBossId(length = 8): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export type WorldBossStatus = 'active' | 'defeated' | 'expired';

export const worldBosses = pgTable('world_bosses', {
  id: varchar('id', { length: 16 }).$defaultFn(() => generateBossId()).primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  element: varchar('element', { length: 32 }).notNull(),
  totalHp: integer('total_hp').notNull(),
  currentHp: integer('current_hp').notNull(),
  status: varchar('status', { length: 16 }).$type<WorldBossStatus>().default('active').notNull(),
  startsAt: timestamp('starts_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
});

export const bossContributions = pgTable('boss_contributions', {
  id: serial('id').primaryKey(),
  bossId: varchar('boss_id', { length: 16 }).references(() => worldBosses.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  totalDamage: integer('total_damage').default(0).notNull(),
  attemptsCount: integer('attempts_count').default(0).notNull(),
  lastAttemptAt: timestamp('last_attempt_at').defaultNow().notNull(),
});

export type WorldBoss = typeof worldBosses.$inferSelect;
export type NewWorldBoss = typeof worldBosses.$inferInsert;
export type BossContribution = typeof bossContributions.$inferSelect;
export type NewBossContribution = typeof bossContributions.$inferInsert;
