// apps/bot/tests/card-resolver.test.ts
import { describe, it, expect } from 'vitest';
import {
  sanitizeCardIdInput,
  resolveCardById,
  getCardNotFoundError,
} from '../src/services/card-resolver';
import { CardRecord } from '@cjverse/db';

describe('Card ID Resolver & Input Sanitization', () => {
  const mockCards: CardRecord[] = [
    {
      id: 'X7K9A2',
      userId: 'user-test',
      race: 'dragon',
      variant: 'gold',
      element: 'fire',
      elementTier: 'A',
      evolutionStage: 1,
      level: 1,
      powerScore: 850,
      seed: 1111,
      assetPaths: null,
      createdAt: new Date(),
    },
    {
      id: 'B4M8Q9',
      userId: 'user-test',
      race: 'elf',
      variant: 'silver',
      element: 'water',
      elementTier: 'B',
      evolutionStage: 1,
      level: 1,
      powerScore: 650,
      seed: 2222,
      assetPaths: null,
      createdAt: new Date(),
    },
  ];

  it('sanitizes input by removing hashtags, trimming, and uppercasing', () => {
    expect(sanitizeCardIdInput('#x7k9a2')).toBe('X7K9A2');
    expect(sanitizeCardIdInput('  #b4m8q9  ')).toBe('B4M8Q9');
    expect(sanitizeCardIdInput('###X7K9A2###')).toBe('X7K9A2');
    expect(sanitizeCardIdInput('')).toBe('');
  });

  it('resolves card by case-insensitive 6-character ID match', () => {
    const card = resolveCardById(mockCards, 'x7k9a2');
    expect(card).toBeDefined();
    expect(card?.id).toBe('X7K9A2');
  });

  it('resolves card when user accidentally includes a hashtag prefix', () => {
    const card = resolveCardById(mockCards, '#B4M8Q9');
    expect(card).toBeDefined();
    expect(card?.id).toBe('B4M8Q9');
  });

  it('resolves card by prefix match', () => {
    const card = resolveCardById(mockCards, 'X7K');
    expect(card).toBeDefined();
    expect(card?.id).toBe('X7K9A2');
  });

  it('returns undefined if card is not found', () => {
    const card = resolveCardById(mockCards, '#ZZZZ99');
    expect(card).toBeUndefined();
  });

  it('generates standardized not-found error message without hashtags', () => {
    const err = getCardNotFoundError('#z7k9a2');
    expect(err).toBe(
      'Card Z7K9A2 was not found in your inventory. Use /inventory to view your 6-character card IDs.'
    );
    expect(err).not.toContain('#');
  });
});
