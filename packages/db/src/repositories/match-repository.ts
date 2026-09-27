import { matchRooms } from '../schema/match-rooms';

export type NewMatchRoom = typeof matchRooms.$inferInsert;
export type MatchRoomRecord = typeof matchRooms.$inferSelect;
