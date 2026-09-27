import { RoomStatus, RoomStatePayload } from '../types/protocol';

export interface GameRoom {
  id: string;
  player1Id: string;
  player2Id: string;
  status: RoomStatus;
  connectedPlayers: Set<string>;
  activeCardId: string | null;
  timeRemaining: number;
  p1Cards: any[];
  p2Cards: any[];
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();

  createRoom(id: string, player1Id: string, player2Id: string): GameRoom {
    const room: GameRoom = {
      id,
      player1Id,
      player2Id,
      status: 'WAITING',
      connectedPlayers: new Set<string>(),
      activeCardId: null,
      timeRemaining: 15,
      p1Cards: [],
      p2Cards: []
    };
    this.rooms.set(id, room);
    return room;
  }

  getRoom(id: string): GameRoom | undefined {
    return this.rooms.get(id);
  }

  connectPlayer(roomId: string, playerId: string): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    if (playerId !== room.player1Id && playerId !== room.player2Id) {
      throw new Error('Unauthorized');
    }

    room.connectedPlayers.add(playerId);

    if (room.connectedPlayers.has(room.player1Id) && room.connectedPlayers.has(room.player2Id)) {
      room.status = 'IN_PROGRESS';
    }

    return room;
  }

  disconnectPlayer(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.connectedPlayers.delete(playerId);
    }
  }

  getRoomState(roomId: string): RoomStatePayload | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      status: room.status,
      activeCardId: room.activeCardId,
      timeRemaining: room.timeRemaining,
      p1: { id: room.player1Id, name: 'Player 1', cards: room.p1Cards },
      p2: { id: room.player2Id, name: 'Player 2', cards: room.p2Cards }
    };
  }
}
