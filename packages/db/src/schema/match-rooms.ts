import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export const matchRooms = pgTable('match_rooms', {
  id: text('id').primaryKey(),
  player1Id: text('player1_id').references(() => users.id).notNull(),
  player2Id: text('player2_id').references(() => users.id).notNull(),
  status: text('status', { enum: ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'ABORTED'] }).default('WAITING').notNull(),
  winnerId: text('winner_id').references(() => users.id),
  gameStateSnapshot: jsonb('game_state_snapshot'),
  combatLogs: jsonb('combat_logs').$type<string[]>(),
  summary: jsonb('summary').$type<{
    winnerId?: string | null;
    loserId?: string | null;
    winnerDelta?: number;
    loserDelta?: number;
    crystalsWon?: number;
    cardsUsed?: { p1?: string[]; p2?: string[] };
    turnsCount?: number;
    durationSeconds?: number;
    completedAt?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
