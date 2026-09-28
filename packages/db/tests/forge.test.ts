import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  users,
  cards,
  marketListings,
  eq,
  ensureUser,
  salvageCards,
  salvageCardsByRarity,
  fuseThreeCards,
  createMarketListing,
} from '../src';

describe('Forge & Salvage Persistence (packages/db)', () => {
  const testUserId = 'test-forge-user-1';

  beforeEach(async () => {
    // Clean up user data
    await db.delete(marketListings).where(eq(marketListings.sellerId, testUserId));
    await db.delete(cards).where(eq(cards.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));

    await db.insert(users).values({
      id: testUserId,
      username: 'ForgeMaster',
      crystals: 100,
      arcaneDust: 0,
      activeLineup: {
        vanguardCardId: null,
        strikerCardId: null,
        conduitCardId: null,
      },
    });
  });

  describe('salvageCards', () => {
    it('rejects salvaging cards not owned by user', async () => {
      const res = await salvageCards(testUserId, ['non-existent-card-id']);
      expect(res.success).toBe(false);
      expect(res.error).toContain('could not be found');
    });

    it('rejects salvaging cards that are equipped in active lineup', async () => {
      const [c1] = await db
        .insert(cards)
        .values({
          userId: testUserId,
          race: 'dragon',
          variant: 'normal',
          element: 'fire',
          elementTier: 'B',
          evolutionStage: 1,
          level: 1,
          powerScore: 200,
          seed: 111,
        })
        .returning();

      // Equip in vanguard
      await db
        .update(users)
        .set({ activeLineup: { vanguardCardId: c1.id, strikerCardId: null, conduitCardId: null } })
        .where(eq(users.id, testUserId));

      const res = await salvageCards(testUserId, [c1.id]);
      expect(res.success).toBe(false);
      expect(res.error).toContain('currently equipped');
    });

    it('rejects salvaging cards that are listed on market', async () => {
      const [c1] = await db
        .insert(cards)
        .values({
          userId: testUserId,
          race: 'orc',
          variant: 'silver',
          element: 'water',
          elementTier: 'A',
          evolutionStage: 1,
          level: 1,
          powerScore: 300,
          seed: 222,
        })
        .returning();

      await createMarketListing({
        sellerId: testUserId,
        cardId: c1.id,
        price: 50,
      });

      const res = await salvageCards(testUserId, [c1.id]);
      expect(res.success).toBe(false);
      expect(res.error).toContain('currently listed on the marketplace');
    });

    it('salvages single card, deletes from cards table, and credits arcane dust and crystals', async () => {
      const [c1] = await db
        .insert(cards)
        .values({
          userId: testUserId,
          race: 'elf',
          variant: 'normal',
          element: 'wind',
          elementTier: 'C',
          evolutionStage: 1,
          level: 1,
          powerScore: 180,
          seed: 333,
        })
        .returning();

      // Normal yields 15 dust, 10 crystals
      const res = await salvageCards(testUserId, [c1.id]);
      expect(res.success).toBe(true);
      expect(res.count).toBe(1);
      expect(res.arcaneDustGained).toBe(15);
      expect(res.crystalsGained).toBe(10);
      expect(res.newBalance?.arcaneDust).toBe(15);
      expect(res.newBalance?.crystals).toBe(110);

      // Verify card was deleted
      const checkCard = await db.select().from(cards).where(eq(cards.id, c1.id));
      expect(checkCard).toHaveLength(0);
    });
  });

  describe('salvageCardsByRarity', () => {
    it('bulk dismantles unequipped cards of specified rarity, skipping equipped cards', async () => {
      const [c1] = await db
        .insert(cards)
        .values({
          userId: testUserId,
          race: 'human',
          variant: 'normal',
          element: 'fire',
          elementTier: 'C',
          powerScore: 190,
          seed: 401,
        })
        .returning();

      const [c2] = await db
        .insert(cards)
        .values({
          userId: testUserId,
          race: 'human',
          variant: 'normal',
          element: 'fire',
          elementTier: 'C',
          powerScore: 190,
          seed: 402,
        })
        .returning();

      const [c3Equipped] = await db
        .insert(cards)
        .values({
          userId: testUserId,
          race: 'human',
          variant: 'normal',
          element: 'fire',
          elementTier: 'C',
          powerScore: 190,
          seed: 403,
        })
        .returning();

      // Equip c3
      await db
        .update(users)
        .set({ activeLineup: { vanguardCardId: c3Equipped.id, strikerCardId: null, conduitCardId: null } })
        .where(eq(users.id, testUserId));

      const res = await salvageCardsByRarity(testUserId, 'normal');
      expect(res.success).toBe(true);
      expect(res.count).toBe(2);
      expect(res.deletedCardIds).toContain(c1.id);
      expect(res.deletedCardIds).toContain(c2.id);
      expect(res.deletedCardIds).not.toContain(c3Equipped.id);

      // 2 Normal = 30 dust, 20 crystals
      expect(res.arcaneDustGained).toBe(30);
      expect(res.crystalsGained).toBe(20);

      // c3Equipped still exists
      const checkEquipped = await db.select().from(cards).where(eq(cards.id, c3Equipped.id));
      expect(checkEquipped).toHaveLength(1);
    });
  });

  describe('fuseThreeCards', () => {
    it('rejects fusion if 3 cards have mismatched variants', async () => {
      const [c1] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'orc', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 200, seed: 501 })
        .returning();
      const [c2] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'orc', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 200, seed: 502 })
        .returning();
      const [c3] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'orc', variant: 'silver', element: 'fire', elementTier: 'C', powerScore: 250, seed: 503 })
        .returning();

      const res = await fuseThreeCards(testUserId, [c1.id, c2.id, c3.id]);
      expect(res.success).toBe(false);
      expect(res.error).toContain('exact same variant');
    });

    it('successfully fuses 3 Normal cards into a Silver card, deleting sacrifices and creating new card', async () => {
      const [c1] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'dragon', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 210, seed: 601 })
        .returning();
      const [c2] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'dragon', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 210, seed: 602 })
        .returning();
      const [c3] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'elf', variant: 'normal', element: 'water', elementTier: 'B', powerScore: 210, seed: 603 })
        .returning();

      const res = await fuseThreeCards(testUserId, [c1.id, c2.id, c3.id]);
      expect(res.success).toBe(true);
      expect(res.fusedCard).toBeDefined();
      expect(res.fusedCard?.variant).toBe('silver');
      expect(res.fusedCard?.element).toBe('fire');
      expect(res.fusedCard?.userId).toBe(testUserId);

      // Verify sacrifices deleted
      const checkC1 = await db.select().from(cards).where(eq(cards.id, c1.id));
      const checkC2 = await db.select().from(cards).where(eq(cards.id, c2.id));
      const checkC3 = await db.select().from(cards).where(eq(cards.id, c3.id));
      expect(checkC1).toHaveLength(0);
      expect(checkC2).toHaveLength(0);
      expect(checkC3).toHaveLength(0);

      // Verify new card exists in DB
      const checkNew = await db.select().from(cards).where(eq(cards.id, res.fusedCard!.id));
      expect(checkNew).toHaveLength(1);
    });
  });
});
