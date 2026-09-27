import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export const matchRooms = pgTable('match_rooms', {
  id: text('id').primaryKey(),
  player1Id: text('player1_id').references(() => users.id).notNull(),
  player2Id: text('player2_id').references(() => users.id).notNull(),
  status: text('status', { enum: ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'ABORTED'] }).default('WAITING').notNull(),
  winnerId: text('winner_id').references(() => users.id),
  gameStateSnapshot: jsonb('game_state_snapshot'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
