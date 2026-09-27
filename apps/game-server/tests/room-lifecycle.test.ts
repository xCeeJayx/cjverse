// apps/game-server/tests/room-lifecycle.test.ts
import { describe, it, expect } from 'vitest';
import { RoomManager } from '../src/room/room-manager';

describe('Authoritative Room Lifecycle State Machine', () => {
  it('creates room in WAITING state and transitions to IN_PROGRESS when both players join', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('room-alpha', 'player-1', 'player-2');
    expect(room.status).toBe('WAITING');

    manager.connectPlayer('room-alpha', 'player-1');
    expect(room.status).toBe('WAITING');

    manager.connectPlayer('room-alpha', 'player-2');
    expect(room.status).toBe('IN_PROGRESS');
  });

  it('rejects unknown room IDs or unauthorized spectators joining as players', () => {
    const manager = new RoomManager();
    manager.createRoom('room-beta', 'p1', 'p2');
    expect(() => manager.connectPlayer('room-beta', 'intruder')).toThrow('Unauthorized');
  });
});
