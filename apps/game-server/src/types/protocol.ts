export type RoomStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';

export type ActionType = 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE';

export interface JoinRoomPayload {
  token?: string;
  roomId: string;
  userId?: string;
}

export interface ExecuteActionPayload {
  actionType: ActionType;
  targetCardId: string;
}

export interface ActionResolvedPayload {
  actorCardId: string;
  targetCardId: string;
  damage: number;
  isCrit: boolean;
  targetRemainingHp: number;
  animations: string[];
  combatLog?: string;
}

export interface RoomStatePayload {
  status: RoomStatus;
  activeCardId: string | null;
  timeRemaining: number;
  p1: { id: string; name: string; cards: any[] };
  p2: { id: string; name: string; cards: any[] };
  winnerId?: string | null;
  combatLog?: string[];
}

export type WebSocketClientMessage =
  | { type: 'JOIN_ROOM'; roomId?: string; userId?: string; payload?: JoinRoomPayload }
  | { type: 'EXECUTE_ACTION'; payload: ExecuteActionPayload }
  | { type: 'TOGGLE_AUTO'; payload?: { enabled?: boolean } };

export type WebSocketServerMessage =
  | { type: 'ROOM_STATE'; payload: RoomStatePayload }
  | { type: 'ACTION_RESOLVED'; payload: ActionResolvedPayload }
  | { type: 'ERROR'; payload: { message: string } };
