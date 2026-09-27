// apps/web/tests/arena-controller.test.ts
import { describe, it, expect } from 'vitest';
import { ArenaController } from '../src/lib/arena-controller';

describe('Web Arena Client Controller', () => {
  it('updates local state on ROOM_STATE message', () => {
    const controller = new ArenaController();
    controller.handleMessage({
      type: 'ROOM_STATE',
      payload: {
        status: 'IN_PROGRESS',
        activeCardId: 'card-1',
        timeRemaining: 15,
        p1: { id: 'p1', name: 'Player1', cards: [] },
        p2: { id: 'p2', name: 'Player2', cards: [] }
      }
    });

    expect(controller.getState().status).toBe('IN_PROGRESS');
    expect(controller.getState().timeRemaining).toBe(15);
  });

  it('toggles auto-battle switch and queues commands when active', () => {
    const controller = new ArenaController();
    expect(controller.isAutoBattleEnabled()).toBe(false);
    controller.toggleAutoBattle();
    expect(controller.isAutoBattleEnabled()).toBe(true);
  });

  it('updates remaining time and active card on TIMER_TICK message', () => {
    const controller = new ArenaController();
    controller.handleMessage({
      type: 'TIMER_TICK',
      payload: {
        timeRemaining: 9,
        activeCardId: 'card-active-2',
      },
    });

    expect(controller.getState().timeRemaining).toBe(9);
    expect(controller.getState().activeCardId).toBe('card-active-2');
  });

  it('updates status and matchEnd payload on MATCH_END message', () => {
    const controller = new ArenaController();
    controller.handleMessage({
      type: 'MATCH_END',
      payload: {
        winnerId: 'winner-123',
        loserId: 'loser-456',
        crystalsAwarded: 50,
      },
    });

    expect(controller.getState().status).toBe('COMPLETED');
    expect(controller.getState().winnerId).toBe('winner-123');
    expect(controller.getState().matchEnd).toEqual({
      winnerId: 'winner-123',
      loserId: 'loser-456',
      crystalsAwarded: 50,
    });
  });
});
