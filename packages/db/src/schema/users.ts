import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

export interface UserActiveLineup {
  vanguardCardId: string | null;
  strikerCardId: string | null;
  conduitCardId: string | null;
}

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Discord Snowflake ID
  username: text('username').notNull(),
  avatarUrl: text('avatar_url'),
  crystals: integer('crystals').default(100).notNull(),
  activeLineup: jsonb('active_lineup').$type<UserActiveLineup>().default({
    vanguardCardId: null,
    strikerCardId: null,
    conduitCardId: null
  }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
