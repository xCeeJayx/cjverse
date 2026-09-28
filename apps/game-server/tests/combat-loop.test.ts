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
    expect(room.combatLog.some((log) => log.includes('DMG'))).toBe(true);
  });

  it('skips turn when active unit is frozen solid and decrements status', async () => {
    const room = await manager.hydrateRoomFromDb('test-room-frozen');
    room.status = 'IN_PROGRESS';

    const p1First = room.p1Cards[0];
    p1First.statusEffects = [
      {
        id: 'frz-1',
        type: 'freeze',
        name: 'Freeze',
        duration: 1,
        potency: 1.0, // Guaranteed skip
        badge: '❄️ 1T',
        icon: '❄️',
      },
    ];

    // Force p1First to be the next active card by setting high spd and initiative
    p1First.initiative = 99;
    p1First.spd = 100;
    for (const c of [...room.p1Cards, ...room.p2Cards]) {
      if (c.id !== p1First.id) {
        c.initiative = 0;
        c.spd = 1;
      }
    }

    manager.advanceTurn('test-room-frozen', false);

    expect(room.combatLog.some((log) => log.includes('is frozen solid and cannot move'))).toBe(true);
    // p1First duration decremented and purged
    expect(p1First.statusEffects.length).toBe(0);
  });

  it('deals burn damage at turn start to afflicted unit', async () => {
    const room = await manager.hydrateRoomFromDb('test-room-burn');
    room.status = 'IN_PROGRESS';

    const p1Card = room.p1Cards[0];
    p1Card.currentHp = 1000;
    p1Card.maxHp = 1000;
    p1Card.statusEffects = [
      {
        id: 'brn-1',
        type: 'burn',
        name: 'Burn',
        duration: 2,
        potency: 0.05,
        badge: '🔥 2T',
        icon: '🔥',
      },
    ];

    p1Card.initiative = 99;
    p1Card.spd = 100;
    for (const c of [...room.p1Cards, ...room.p2Cards]) {
      if (c.id !== p1Card.id) {
        c.initiative = 0;
        c.spd = 1;
      }
    }

    manager.advanceTurn('test-room-burn', false);

    // 5% of 1000 is 50 damage
    expect(p1Card.currentHp).toBe(950);
    expect(room.combatLog.some((log) => log.includes('Burn damage'))).toBe(true);
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

    // Verify MATCH_END broadcast with crystals and Elo updates
    expect(broadcastSpy).toHaveBeenCalledWith(
      'test-room-win',
      expect.objectContaining({
        type: 'MATCH_END',
        payload: expect.objectContaining({
          winnerId: room.player1Id,
          loserId: room.player2Id,
          crystalsAwarded: 50,
          winnerDelta: expect.any(Number),
          loserDelta: expect.any(Number),
          newWinnerRating: expect.any(Number),
          newLoserRating: expect.any(Number),
        }),
      })
    );
  });
});
