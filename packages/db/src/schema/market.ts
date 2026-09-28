import { pgTable, varchar, integer, timestamp, text } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';

export function generateListingId(length = 8): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export type MarketListingStatus = 'active' | 'sold' | 'cancelled';

export const marketListings = pgTable('market_listings', {
  id: varchar('id', { length: 16 }).$defaultFn(() => generateListingId()).primaryKey(),
  sellerId: text('seller_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  cardId: varchar('card_id', { length: 16 }).references(() => cards.id, { onDelete: 'cascade' }).notNull(),
  price: integer('price').notNull(),
  status: varchar('status', { length: 16 }).$type<MarketListingStatus>().default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
