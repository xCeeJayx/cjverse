import { describe, it, expect, beforeEach } from 'vitest';
import { POST as salvageRoute } from '../src/app/api/forge/salvage/route';
import { POST as fuseRoute } from '../src/app/api/forge/fuse/route';
import { GET as getForgeRoute } from '../src/app/api/forge/route';
import {
  db,
  users,
  cards,
  eq,
} from '@cjverse/db';

describe('Web Forge API Endpoints (/api/forge)', () => {
  const testUserId = 'web-forge-tester-user';

  beforeEach(async () => {
    await db.delete(cards).where(eq(cards.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));

    await db.insert(users).values({
      id: testUserId,
      username: 'WebForgeHero',
      crystals: 200,
      arcaneDust: 50,
      activeLineup: {
        vanguardCardId: null,
        strikerCardId: null,
        conduitCardId: null,
      },
    });
  });

  describe('GET /api/forge', () => {
    it('returns unauthenticated when no session', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/forge',
        cookies: { get: () => undefined },
      };

      const res = await getForgeRoute(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(false);
    });

    it('returns user essence balances when authenticated with ?as=', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/forge?as=${testUserId}`,
        cookies: { get: () => undefined },
      };

      const res = await getForgeRoute(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
      expect(data.arcaneDust).toBe(50);
      expect(data.crystals).toBe(200);
    });
  });

  describe('POST /api/forge/salvage', () => {
    it('rejects unauthenticated request with 401', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/forge/salvage',
        cookies: { get: () => undefined },
        json: async () => ({ cardIds: ['some-id'] }),
      };

      const res = await salvageRoute(mockReq);
      expect(res.status).toBe(401);
    });

    it('rejects empty or invalid cardIds with 400', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/forge/salvage?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ cardIds: [] }),
      };

      const res = await salvageRoute(mockReq);
      expect(res.status).toBe(400);
    });

    it('dismantles card and updates arcane dust and crystals', async () => {
      const [c1] = await db
        .insert(cards)
        .values({
          userId: testUserId,
          race: 'dragon',
          variant: 'normal',
          element: 'fire',
          elementTier: 'C',
          powerScore: 200,
          seed: 101,
        })
        .returning();

      const mockReq: any = {
        url: `http://localhost:3000/api/forge/salvage?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ cardIds: [c1.id] }),
      };

      const res = await salvageRoute(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);
      // Normal yields 15 dust, 10 crystals -> new balance: 50+15=65 dust, 200+10=210 crystals
      expect(data.arcaneDustGained).toBe(15);
      expect(data.crystalsGained).toBe(10);
      expect(data.newBalance.arcaneDust).toBe(65);
      expect(data.newBalance.crystals).toBe(210);

      // Verify card was deleted
      const check = await db.select().from(cards).where(eq(cards.id, c1.id));
      expect(check).toHaveLength(0);
    });
  });

  describe('POST /api/forge/fuse', () => {
    it('rejects unauthenticated request with 401', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/forge/fuse',
        cookies: { get: () => undefined },
        json: async () => ({ cardIds: ['1', '2', '3'] }),
      };

      const res = await fuseRoute(mockReq);
      expect(res.status).toBe(401);
    });

    it('rejects payload with invalid number of cards with 400', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/forge/fuse?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ cardIds: ['1', '2'] }),
      };

      const res = await fuseRoute(mockReq);
      expect(res.status).toBe(400);
    });

    it('rejects cards with mismatched variants with 400', async () => {
      const [c1] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'orc', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 200, seed: 201 })
        .returning();
      const [c2] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'orc', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 200, seed: 202 })
        .returning();
      const [c3] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'orc', variant: 'silver', element: 'fire', elementTier: 'C', powerScore: 250, seed: 203 })
        .returning();

      const mockReq: any = {
        url: `http://localhost:3000/api/forge/fuse?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ cardIds: [c1.id, c2.id, c3.id] }),
      };

      const res = await fuseRoute(mockReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('exact same variant');
    });

    it('fuses 3 Normal cards into a Silver card, removing sacrifices and returning new card', async () => {
      const [c1] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'dragon', variant: 'normal', element: 'ice', elementTier: 'C', powerScore: 200, seed: 301 })
        .returning();
      const [c2] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'dragon', variant: 'normal', element: 'ice', elementTier: 'C', powerScore: 200, seed: 302 })
        .returning();
      const [c3] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'human', variant: 'normal', element: 'water', elementTier: 'C', powerScore: 200, seed: 303 })
        .returning();

      const mockReq: any = {
        url: `http://localhost:3000/api/forge/fuse?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ cardIds: [c1.id, c2.id, c3.id] }),
      };

      const res = await fuseRoute(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.fusedCard).toBeDefined();
      expect(data.fusedCard.variant).toBe('silver');
      expect(data.fusedCard.element).toBe('ice');

      // Sacrifices deleted
      const check1 = await db.select().from(cards).where(eq(cards.id, c1.id));
      expect(check1).toHaveLength(0);

      // New card exists
      const checkNew = await db.select().from(cards).where(eq(cards.id, data.fusedCard.id));
      expect(checkNew).toHaveLength(1);
    });
  });
});
