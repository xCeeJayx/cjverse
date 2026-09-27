import { pgTable, text, integer, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export interface CardAssetPaths {
  raceSlice: string;
  elementSlice: string;
  frameSlice: string;
}

export const cards = pgTable('cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  race: text('race').notNull(),
  variant: text('variant').notNull(),
  element: text('element').notNull(),
  elementTier: text('element_tier').notNull(),
  evolutionStage: integer('evolution_stage').default(1).notNull(),
  level: integer('level').default(1).notNull(),
  powerScore: integer('power_score').notNull(),
  seed: integer('seed').notNull(),
  assetPaths: jsonb('asset_paths').$type<CardAssetPaths>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
