import { pgTable, text, integer, timestamp, varchar, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export function generateCardId(length = 6): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Alphanumeric without ambiguous characters (0, O, 1, I)
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface CardAssetPaths {
  raceSlice: string;
  elementSlice: string;
  frameSlice: string;
}

export const cards = pgTable('cards', {
  id: varchar('id', { length: 16 }).$defaultFn(() => generateCardId()).primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  race: text('race').notNull(),
  variant: text('variant').notNull(),
  element: text('element').notNull(),
  elementTier: text('element_tier').notNull(),
  evolutionStage: integer('evolution_stage').default(1).notNull(),
  level: integer('level').default(1).notNull(),
  powerScore: integer('power_score').notNull(),
  seed: integer('seed').notNull(),
  gender: varchar('gender', { length: 8 }).notNull().default('male'),
  assetPaths: jsonb('asset_paths').$type<CardAssetPaths>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
