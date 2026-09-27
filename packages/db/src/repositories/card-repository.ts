import { eq } from 'drizzle-orm';
import { db } from '../client';
import { cards } from '../schema/cards';

export type NewCard = typeof cards.$inferInsert;
export type CardRecord = typeof cards.$inferSelect;

export async function findCardsByUserId(userId: string): Promise<CardRecord[]> {
  return db.select().from(cards).where(eq(cards.userId, userId));
}

export async function createCard(newCard: NewCard) {
  return db.insert(cards).values(newCard);
}
