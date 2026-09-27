// apps/game-server/tests/initiative-clock.test.ts
import { describe, it, expect } from 'vitest';
import { InitiativeClock, CombatCardState } from '../src/engine/initiative-clock';

describe('Turn Order Initiative Clock (0-100 gauge)', () => {
  it('increments card initiative by SPD and triggers turn when reaching 100', () => {
    const cards: CombatCardState[] = [
      { id: 'fast-card', playerId: 'p1', spd: 50, initiative: 0, isAlive: true },
      { id: 'slow-card', playerId: 'p2', spd: 20, initiative: 0, isAlive: true }
    ];
    const clock = new InitiativeClock(cards);

    // Tick 1: fast 50, slow 20
    const tick1 = clock.tick();
    expect(tick1.activeCard).toBeNull();

    // Tick 2: fast 100 (triggers), slow 40
    const tick2 = clock.tick();
    expect(tick2.activeCard?.id).toBe('fast-card');
    // Active card resets gauge to 0
    expect(cards[0].initiative).toBe(0);
  });

  it('skips dead cards from gaining initiative', () => {
    const cards: CombatCardState[] = [
      { id: 'dead-card', playerId: 'p1', spd: 100, initiative: 0, isAlive: false }
    ];
    const clock = new InitiativeClock(cards);
    const result = clock.tick();
    expect(result.activeCard).toBeNull();
  });

  it('manages 15-second turn timer countdown and reset', () => {
    const cards: CombatCardState[] = [
      { id: 'card-1', playerId: 'p1', spd: 30, initiative: 0, isAlive: true }
    ];
    const clock = new InitiativeClock(cards);
    expect(clock.getTimeRemaining()).toBe(15);

    clock.decrementTimer();
    expect(clock.getTimeRemaining()).toBe(14);

    clock.resetTimer(15);
    expect(clock.getTimeRemaining()).toBe(15);
  });
});
