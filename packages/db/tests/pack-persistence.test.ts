import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  users,
  cards,
  eq,
  buyAndOpenBoosterPack,
  findCardsByUserId,
} from '../src';

describe('Pack Persistence & Atomic Purchasing (packages/db)', () => {
  const testUserId = 'pack-test-user-db';

  beforeEach(async () => {
    await db.delete(cards).where(eq(cards.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));

    await db.insert(users).values({
      id: testUserId,
      username: 'PackTester',
      crystals: 500,
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });
  });

  it('rejects purchase when user has insufficient crystals', async () => {
    // Ascendant pack costs 750, user has 500
    const result = await buyAndOpenBoosterPack(testUserId, 'ascendant');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient crystals');

    // Balance remains 500
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(user.crystals).toBe(500);
  });

  it('atomically deducts crystals and inserts all cards on standard pack purchase', async () => {
    const result = await buyAndOpenBoosterPack(testUserId, 'standard');
    expect(result.success).toBe(true);
    expect(result.cards).toHaveLength(3);
    expect(result.cost).toBe(150);
    expect(result.remainingCrystals).toBe(350);

    // Verify user crystal balance in DB
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(user.crystals).toBe(350);

    // Verify cards inserted into DB
    const dbCards = await findCardsByUserId(testUserId);
    expect(dbCards).toHaveLength(3);
    for (const card of result.cards!) {
      expect(card.id).toHaveLength(6);
      const foundInDb = dbCards.find((c) => c.id === card.id);
      expect(foundInDb).toBeDefined();
      expect(foundInDb?.race).toBe(card.race);
      expect(foundInDb?.variant).toBe(card.variant);
      expect(foundInDb?.element).toBe(card.element);
      expect(foundInDb?.powerScore).toBe(card.powerScore);
    }
  });

  it('purchases elemental hoard pack, deducts 350 crystals, and guarantees silver+ variant', async () => {
    const result = await buyAndOpenBoosterPack(testUserId, 'elemental');
    expect(result.success).toBe(true);
    expect(result.cards).toHaveLength(3);
    expect(result.cost).toBe(350);
    expect(result.remainingCrystals).toBe(150);

    const hasSilverOrBetter = result.cards!.some((c) =>
      ['silver', 'gold', 'diamond', 'rainbow'].includes(c.variant)
    );
    expect(hasSilverOrBetter).toBe(true);

    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(user.crystals).toBe(150);
  });
});
