// packages/db/tests/schema-validation.test.ts
import { describe, it, expect } from 'vitest';
import { users, cards, matchRooms, db, generateCardId } from '../src';
import { getTableColumns } from 'drizzle-orm';

describe('Drizzle Database Schema Definitions', () => {
  it('exports active drizzle db client', () => {
    expect(db).toBeDefined();
    expect(db.query).toBeDefined();
  });
  it('contains all required columns in users table', () => {
    const cols = getTableColumns(users);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('username');
    expect(cols).toHaveProperty('crystals');
    expect(cols).toHaveProperty('rating');
    expect(cols).toHaveProperty('wins');
    expect(cols).toHaveProperty('losses');
    expect(cols).toHaveProperty('activeLineup');
    expect(cols).toHaveProperty('lastDailyClaim');
    expect(cols).toHaveProperty('dailyStreak');
    expect(cols).toHaveProperty('dailyQuests');
  });

  it('contains all required columns in cards table with 6-character id support', () => {
    const cols = getTableColumns(cards);
    expect(cols).toHaveProperty('id');
    expect(cols.id.dataType).toBe('string');
    expect(cols).toHaveProperty('userId');
    expect(cols).toHaveProperty('race');
    expect(cols).toHaveProperty('variant');
    expect(cols).toHaveProperty('elementTier');
    expect(cols).toHaveProperty('powerScore');
    expect(cols).toHaveProperty('seed');

    const testId = generateCardId();
    expect(testId).toHaveLength(6);
    expect(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(testId)).toBe(true);
    expect(testId).not.toContain('#');
  });

  it('contains status enum, combatLogs, and summary in matchRooms table', () => {
    const cols = getTableColumns(matchRooms);
    expect(cols).toHaveProperty('player1Id');
    expect(cols).toHaveProperty('player2Id');
    expect(cols).toHaveProperty('status');
    expect(cols).toHaveProperty('winnerId');
    expect(cols).toHaveProperty('combatLogs');
    expect(cols).toHaveProperty('summary');
  });

  it('contains required columns in marketListings table', async () => {
    const { marketListings, generateListingId } = await import('../src');
    const cols = getTableColumns(marketListings);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('sellerId');
    expect(cols).toHaveProperty('cardId');
    expect(cols).toHaveProperty('price');
    expect(cols).toHaveProperty('status');
    expect(cols).toHaveProperty('createdAt');

    const testId = generateListingId();
    expect(testId).toHaveLength(8);
  });

  it('contains required columns in trades table', async () => {
    const { trades, generateTradeId } = await import('../src');
    const cols = getTableColumns(trades);
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('proposerId');
    expect(cols).toHaveProperty('targetId');
    expect(cols).toHaveProperty('proposerCardId');
    expect(cols).toHaveProperty('targetCardId');
    expect(cols).toHaveProperty('status');
    expect(cols).toHaveProperty('createdAt');

    const testId = generateTradeId();
    expect(testId).toHaveLength(8);
  });
});
