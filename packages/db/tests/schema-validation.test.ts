// packages/db/tests/schema-validation.test.ts
import { describe, it, expect } from 'vitest';
import { users, cards, matchRooms } from '../src';
import { getTableColumns } from 'drizzle-orm';

describe('Drizzle Database Schema Definitions', () => {
  it('contains all required columns in users table', () => {
    const cols = getTableColumns(users);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('username');
    expect(cols).toHaveProperty('crystals');
    expect(cols).toHaveProperty('activeLineup');
  });

  it('contains all required columns in cards table', () => {
    const cols = getTableColumns(cards);
    expect(cols).toHaveProperty('userId');
    expect(cols).toHaveProperty('race');
    expect(cols).toHaveProperty('variant');
    expect(cols).toHaveProperty('elementTier');
    expect(cols).toHaveProperty('powerScore');
    expect(cols).toHaveProperty('seed');
  });

  it('contains status enum in matchRooms table', () => {
    const cols = getTableColumns(matchRooms);
    expect(cols).toHaveProperty('player1Id');
    expect(cols).toHaveProperty('player2Id');
    expect(cols).toHaveProperty('status');
  });
});
