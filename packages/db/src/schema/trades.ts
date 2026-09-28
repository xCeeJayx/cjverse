import { pgTable, varchar, timestamp, text } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';

export function generateTradeId(length = 8): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export const trades = pgTable('trades', {
  id: varchar('id', { length: 16 }).$defaultFn(() => generateTradeId()).primaryKey(),
  proposerId: text('proposer_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  targetId: text('target_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  proposerCardId: varchar('proposer_card_id', { length: 16 }).references(() => cards.id, { onDelete: 'cascade' }).notNull(),
  targetCardId: varchar('target_card_id', { length: 16 }).references(() => cards.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 16 }).$type<TradeStatus>().default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
