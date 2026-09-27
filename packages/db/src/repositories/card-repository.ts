import { cards } from '../schema/cards';

export type NewCard = typeof cards.$inferInsert;
export type CardRecord = typeof cards.$inferSelect;
