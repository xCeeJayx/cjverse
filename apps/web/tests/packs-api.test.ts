import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getPacks } from '../src/app/api/packs/route';
import { POST as openPack } from '../src/app/api/packs/open/route';
import { db, users, cards, eq, findCardsByUserId } from '@cjverse/db';

describe('Web Booster Packs API Endpoints (/api/packs)', () => {
  const testUserId = 'web-pack-test-user';

  beforeEach(async () => {
    await db.delete(cards).where(eq(cards.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));

    await db.insert(users).values({
      id: testUserId,
      username: 'PackMaster',
      crystals: 500,
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });
  });

  describe('GET /api/packs', () => {
    it('returns available booster packs and unauthenticated state when no session', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/packs',
        cookies: { get: () => undefined },
      };

      const res = await getPacks(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.packs).toHaveLength(3);
      expect(data.packs.map((p: any) => p.id)).toEqual(['standard', 'elemental', 'ascendant']);
      expect(data.authenticated).toBe(false);
    });

    it('returns user crystal balance when authenticated via ?as=', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/packs?as=${testUserId}`,
        cookies: { get: () => undefined },
      };

      const res = await getPacks(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.authenticated).toBe(true);
      expect(data.userCrystals).toBe(500);
    });
  });

  describe('POST /api/packs/open', () => {
    it('rejects unauthenticated request with 401', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/packs/open',
        cookies: { get: () => undefined },
        json: async () => ({ packType: 'standard' }),
      };

      const res = await openPack(mockReq);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects missing or invalid packType with 400', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/packs/open?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ packType: 'mythic_super_pack' }),
      };

      const res = await openPack(mockReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid or missing packType');
    });

    it('rejects purchase when user has insufficient crystals with 400', async () => {
      // Ascendant vault costs 750, user has 500
      const mockReq: any = {
        url: `http://localhost:3000/api/packs/open?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ packType: 'ascendant' }),
      };

      const res = await openPack(mockReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Insufficient crystals');
    });

    it('successfully purchases and opens Standard Pack, deducts 150 crystals, and persists cards', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/packs/open?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ packType: 'standard' }),
      };

      const res = await openPack(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.packType).toBe('standard');
      expect(data.cost).toBe(150);
      expect(data.remainingCrystals).toBe(350);
      expect(data.cards).toHaveLength(3);

      for (const card of data.cards) {
        expect(card.id).toHaveLength(6);
        expect(card.powerScore).toBeGreaterThan(0);
      }

      // Check DB persistence
      const dbCards = await findCardsByUserId(testUserId);
      expect(dbCards).toHaveLength(3);

      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      expect(user.crystals).toBe(350);
    });

    it('successfully opens Elemental Hoard, guarantees Silver+ card, and deducts 350 crystals', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/packs/open?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ packType: 'elemental' }),
      };

      const res = await openPack(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.packType).toBe('elemental');
      expect(data.cost).toBe(350);
      expect(data.remainingCrystals).toBe(150);
      expect(data.cards).toHaveLength(3);

      const hasSilverOrHigher = data.cards.some((c: any) =>
        ['silver', 'gold', 'diamond', 'rainbow'].includes(c.variant)
      );
      expect(hasSilverOrHigher).toBe(true);
    });
  });
});
