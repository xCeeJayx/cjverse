// packages/db/tests/lineup-validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateLineup, isLineupComplete } from '../src';

describe('Active Lineup Validation Rules', () => {
  it('validates a complete and unique 3-card lineup', () => {
    const result = validateLineup({
      vanguardCardId: 'c1',
      strikerCardId: 'c2',
      conduitCardId: 'c3'
    });
    expect(result.valid).toBe(true);
    expect(isLineupComplete({ vanguardCardId: 'c1', strikerCardId: 'c2', conduitCardId: 'c3' })).toBe(true);
  });

  // Review Focus Check: Duplicate Card IDs
  it('rejects active lineup with duplicate card IDs', () => {
    const result = validateLineup({
      vanguardCardId: 'card-1',
      strikerCardId: 'card-1',
      conduitCardId: 'card-2'
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Duplicate card');
  });

  it('identifies incomplete lineups with missing slots', () => {
    expect(isLineupComplete({ vanguardCardId: 'c1', strikerCardId: null, conduitCardId: 'c2' })).toBe(false);
  });
});
