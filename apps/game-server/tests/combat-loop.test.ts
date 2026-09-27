// apps/game-server/tests/combat-loop.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomManager } from '../src/room/room-manager';

describe('Game Server Combat Loop & Room Hydration', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  it('hydrates room with 3v3 lineups and establishes initiative turn order', async () => {
    const room = await manager.hydrateRoomFromDb('test-room-101');
    expect(room.id).toBe('test-room-101');
    expect(room.p1Cards.length).toBe(3);
    expect(room.p2Cards.length).toBe(3);
    expect(room.p1Cards.map((c) => c.role)).toEqual(['vanguard', 'striker', 'conduit']);
    expect(room.p2Cards.map((c) => c.role)).toEqual(['vanguard', 'striker', 'conduit']);
    expect(room.activeCardId).toBeDefined();
    expect(room.timeRemaining).toBe(15);
  });

  it('executes authoritative action, deducts HP, logs combat event, and advances turn', async () => {
    const room = await manager.hydrateRoomFromDb('test-room-combat');
    room.status = 'IN_PROGRESS';

    const activeCard = [...room.p1Cards, ...room.p2Cards].find((c) => c.id === room.activeCardId)!;
    const enemyTeam = activeCard.playerId === room.player1Id ? room.p2Cards : room.p1Cards;
    const target = enemyTeam[0];
    const initialHp = target.currentHp;

    const result = manager.executeAction(
      'test-room-combat',
      activeCard.playerId,
      'BASIC_ATTACK',
      target.id
    );

    expect(result).not.toBeNull();
    expect(result?.resolved.damage).toBeGreaterThan(0);
    expect(target.currentHp).toBeLessThan(initialHp);
    expect(room.combatLog.length).toBeGreaterThan(0);
    expect(room.combatLog[0]).toContain('DMG');
  });

  it('toggles auto-battle mode on and off', async () => {
    const room = manager.createRoom('room-auto', 'p1', 'p2');
    expect(manager.toggleAuto('room-auto', 'p1')).toBe(true);
    expect(manager.toggleAuto('room-auto', 'p1')).toBe(false);
  });

  it('detects match completion when all enemy cards are defeated', async () => {
    const room = await manager.hydrateRoomFromDb('test-room-win');
    room.status = 'IN_PROGRESS';

    // Set all P2 cards to 1 HP
    room.p2Cards.forEach((c) => {
      c.currentHp = 1;
    });

    // Make sure active card belongs to P1
    room.activeCardId = room.p1Cards[0].id;
    room.p1Cards[0].atk = 9999;

    const broadcastSpy = vi.spyOn(manager, 'broadcast');

    manager.executeAction('test-room-win', room.player1Id, 'ULTIMATE', room.p2Cards[0].id);
    // Knock out other two
    manager.executeAction('test-room-win', room.player1Id, 'ULTIMATE', room.p2Cards[1].id);
    manager.executeAction('test-room-win', room.player1Id, 'ULTIMATE', room.p2Cards[2].id);

    expect(room.status).toBe('COMPLETED');
    expect(room.winnerId).toBe(room.player1Id);

    // Verify MATCH_END broadcast
    expect(broadcastSpy).toHaveBeenCalledWith(
      'test-room-win',
      expect.objectContaining({
        type: 'MATCH_END',
        payload: {
          winnerId: room.player1Id,
          loserId: room.player2Id,
          crystalsAwarded: 50,
        },
      })
    );
  });
});
