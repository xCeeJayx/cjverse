// apps/bot/tests/inventory-command.test.ts
import { describe, it, expect } from 'vitest';
import { paginateCards, formatCardLineupTag } from '../src/commands/inventory';

describe('Discord Bot /inventory Command Handler', () => {
  it('correctly tags cards slotted in active lineup', () => {
    const lineup = {
      vanguardCardId: 'card-a',
      strikerCardId: 'card-b',
      conduitCardId: 'card-c'
    };
    expect(formatCardLineupTag('card-a', lineup)).toBe('[VANGUARD]');
    expect(formatCardLineupTag('card-b', lineup)).toBe('[STRIKER]');
    expect(formatCardLineupTag('card-c', lineup)).toBe('[CONDUIT]');
    expect(formatCardLineupTag('card-x', lineup)).toBe('');
  });

  it('paginates card collections into discrete pages', () => {
    const mockList = Array.from({ length: 15 }, (_, i) => ({ id: `card-${i}` }));
    const result = paginateCards(mockList, 1, 5);
    expect(result.pageCards.length).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(result.currentPage).toBe(1);
  });
});
