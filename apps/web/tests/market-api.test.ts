import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getMarketListings } from '../src/app/api/market/route';
import { POST as buyMarketListing } from '../src/app/api/market/buy/route';
import { db, users, cards, marketListings, eq } from '@cjverse/db';

describe('Web Marketplace API Endpoints (/api/market)', () => {
  const sellerId = 'web-mkt-seller';
  const buyerId = 'web-mkt-buyer';
  const card1Id = 'WMKT01';
  const card2Id = 'WMKT02';

  beforeEach(async () => {
    await db.delete(marketListings).where(eq(marketListings.sellerId, sellerId));
    await db.delete(marketListings).where(eq(marketListings.sellerId, buyerId));
    await db.delete(cards).where(eq(cards.id, card1Id));
    await db.delete(cards).where(eq(cards.id, card2Id));
    await db.delete(users).where(eq(users.id, sellerId));
    await db.delete(users).where(eq(users.id, buyerId));

    await db.insert(users).values({
      id: sellerId,
      username: 'MarketVendor',
      crystals: 50,
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });

    await db.insert(users).values({
      id: buyerId,
      username: 'DiamondCollector',
      crystals: 1000,
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });

    await db.insert(cards).values({
      id: card1Id,
      userId: sellerId,
      race: 'draconian',
      variant: 'gold',
      element: 'fire',
      elementTier: 't2',
      evolutionStage: 2,
      level: 12,
      powerScore: 350,
      seed: 991122,
    });

    await db.insert(cards).values({
      id: card2Id,
      userId: sellerId,
      race: 'abyssal',
      variant: 'normal',
      element: 'ice',
      elementTier: 't1',
      evolutionStage: 1,
      level: 3,
      powerScore: 80,
      seed: 334455,
    });

    await db.insert(marketListings).values({
      id: 'LST001',
      sellerId,
      cardId: card1Id,
      price: 300,
      status: 'active',
    });

    await db.insert(marketListings).values({
      id: 'LST002',
      sellerId,
      cardId: card2Id,
      price: 50,
      status: 'active',
    });
  });

  describe('GET /api/market', () => {
    it('returns active listings with card stats and seller username', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/market',
      };

      const res = await getMarketListings(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.listings).toBeDefined();
      expect(data.listings.length).toBeGreaterThanOrEqual(2);

      const lst1 = data.listings.find((l: any) => l.id === 'LST001');
      expect(lst1).toBeDefined();
      expect(lst1.price).toBe(300);
      expect(lst1.sellerUsername).toBe('MarketVendor');
      expect(lst1.card.variant).toBe('gold');
      expect(lst1.card.element).toBe('fire');
    });

    it('filters listings by element and maxPrice', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/market?element=ice&maxPrice=100',
      };

      const res = await getMarketListings(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.listings.every((l: any) => l.card.element.toLowerCase() === 'ice')).toBe(true);
      expect(data.listings.every((l: any) => l.price <= 100)).toBe(true);
    });
  });

  describe('POST /api/market/buy', () => {
    it('rejects unauthenticated request with 401', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/market/buy',
        cookies: { get: () => undefined },
        json: async () => ({ listingId: 'LST001' }),
      };

      const res = await buyMarketListing(mockReq);
      expect(res.status).toBe(401);
    });

    it('rejects purchase when buyer attempts to buy their own listing', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/market/buy?as=${sellerId}`,
        cookies: { get: () => undefined },
        json: async () => ({ listingId: 'LST001' }),
      };

      const res = await buyMarketListing(mockReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('cannot buy your own');
    });

    it('completes crystal checkout and transfers card ownership on valid purchase', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/market/buy?as=${buyerId}`,
        cookies: { get: () => undefined },
        json: async () => ({ listingId: 'LST001' }),
      };

      const res = await buyMarketListing(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.price).toBe(300);
      expect(data.buyerCrystalsRemaining).toBe(700); // 1000 - 300

      // Verify in DB
      const [updatedCard] = await db.select().from(cards).where(eq(cards.id, card1Id));
      const [updatedBuyer] = await db.select().from(users).where(eq(users.id, buyerId));
      const [updatedSeller] = await db.select().from(users).where(eq(users.id, sellerId));
      const [updatedListing] = await db.select().from(marketListings).where(eq(marketListings.id, 'LST001'));

      expect(updatedCard.userId).toBe(buyerId);
      expect(updatedBuyer.crystals).toBe(700);
      expect(updatedSeller.crystals).toBe(350); // 50 + 300
      expect(updatedListing.status).toBe('sold');
    });
  });
});
