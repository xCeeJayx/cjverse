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

  it('handles new users and empty inventories gracefully without throwing', async () => {
    const { handleInventoryCommand } = await import('../src/commands/inventory');
    const result = await handleInventoryCommand('new-user-test', 'BrandNewPlayer', 1);
    expect(result.success).toBe(true);
    expect(result.empty).toBe(true);
    expect(result.message).toContain("You don't own any cards yet!");
  });
});
