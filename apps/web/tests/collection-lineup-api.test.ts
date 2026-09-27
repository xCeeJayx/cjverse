import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getCollection } from '../src/app/api/user/collection/route';
import { POST as postLineup } from '../src/app/api/user/lineup/route';
import { createMockSessionToken } from '../src/lib/auth-session';
import { db, users, cards, createCard, generateCardId, eq } from '@cjverse/db';

describe('Web Card Collection & Lineup Deckbuilder API', () => {
  const testUserId = 'test-collection-user-1';
  let card1Id: string;
  let card2Id: string;
  let card3Id: string;

  beforeEach(async () => {
    // Clean up test data
    await db.delete(cards).where(eq(cards.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));

    // Create test user
    await db.insert(users).values({
      id: testUserId,
      username: 'TestBinderMaster',
      crystals: 250,
      activeLineup: {
        vanguardCardId: null,
        strikerCardId: null,
        conduitCardId: null,
      },
    });

    // Create 3 test cards
    card1Id = generateCardId();
    card2Id = generateCardId();
    card3Id = generateCardId();

    await createCard({
      id: card1Id,
      userId: testUserId,
      race: 'Dragon',
      variant: 'Rainbow',
      element: 'Arcane',
      elementTier: 'S',
      evolutionStage: 3,
      level: 15,
      powerScore: 1850,
      seed: 12345,
    });

    await createCard({
      id: card2Id,
      userId: testUserId,
      race: 'Elf',
      variant: 'Gold',
      element: 'Fire',
      elementTier: 'A',
      evolutionStage: 1,
      level: 10,
      powerScore: 1200,
      seed: 23456,
    });

    await createCard({
      id: card3Id,
      userId: testUserId,
      race: 'Dwarf',
      variant: 'Diamond',
      element: 'Earth',
      elementTier: 'B',
      evolutionStage: 2,
      level: 12,
      powerScore: 1450,
      seed: 34567,
    });
  });

  describe('GET /api/user/collection', () => {
    it('rejects unauthenticated request with 401', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/user/collection',
        cookies: {
          get: () => undefined,
        },
      };

      const res = await getCollection(mockReq);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('authenticates via ?as= parameter in dev mode and returns user, cards, and lineup', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/user/collection?as=${testUserId}`,
        cookies: {
          get: () => undefined,
        },
      };

      const res = await getCollection(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.user).toBeDefined();
      expect(data.user.id).toBe(testUserId);
      expect(data.user.crystals).toBe(250);

      expect(data.cards).toBeInstanceOf(Array);
      expect(data.cards.length).toBe(3);
      expect(data.cards.map((c: any) => c.id)).toContain(card1Id);
      expect(data.cards.map((c: any) => c.id)).toContain(card2Id);
      expect(data.cards.map((c: any) => c.id)).toContain(card3Id);

      // Verify all card IDs are strictly 6-character strings
      for (const card of data.cards) {
        expect(card.id).toHaveLength(6);
        expect(card.id).not.toContain('#');
      }

      expect(data.lineup).toBeDefined();
      expect(data.lineup.vanguardCardId).toBeNull();
      expect(data.lineup.strikerCardId).toBeNull();
      expect(data.lineup.conduitCardId).toBeNull();
    });

    it('authenticates via cjverse_session cookie', async () => {
      const token = createMockSessionToken(testUserId, 'TestBinderMaster');
      const mockReq: any = {
        url: 'http://localhost:3000/api/user/collection',
        cookies: {
          get: (name: string) => (name === 'cjverse_session' ? { value: token } : undefined),
        },
      };

      const res = await getCollection(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.id).toBe(testUserId);
      expect(data.cards.length).toBe(3);
    });
  });

  describe('POST /api/user/lineup', () => {
    it('rejects unauthenticated request with 401', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/user/lineup',
        cookies: {
          get: () => undefined,
        },
        json: async () => ({ slot: 'vanguard', cardId: card1Id }),
      };

      const res = await postLineup(mockReq);
      expect(res.status).toBe(401);
    });

    it('rejects invalid slot name with 400', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/user/lineup?as=${testUserId}`,
        cookies: {
          get: () => undefined,
        },
        json: async () => ({ slot: 'support_lane', cardId: card1Id }),
      };

      const res = await postLineup(mockReq);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid slot');
    });

    it('rejects card that does not belong to authenticated user with 403', async () => {
      // Ensure stranger user exists in users table first to satisfy foreign key constraint
      await db.insert(users).values({
        id: 'other-stranger-user',
        username: 'StrangerUser',
        crystals: 100,
        activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
      }).onConflictDoNothing();

      // Create a foreign card belonging to stranger
      const foreignCardId = generateCardId();
      await createCard({
        id: foreignCardId,
        userId: 'other-stranger-user',
        race: 'Dragon',
        variant: 'Normal',
        element: 'Fire',
        elementTier: 'A',
        evolutionStage: 1,
        level: 1,
        powerScore: 800,
        seed: 99999,
      });

      const mockReq: any = {
        url: `http://localhost:3000/api/user/lineup?as=${testUserId}`,
        cookies: {
          get: () => undefined,
        },
        json: async () => ({ slot: 'vanguard', cardId: foreignCardId }),
      };

      const res = await postLineup(mockReq);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('not belong');
    });

    it('equips card to vanguard slot and updates DB', async () => {
      const mockReq: any = {
        url: `http://localhost:3000/api/user/lineup?as=${testUserId}`,
        cookies: {
          get: () => undefined,
        },
        json: async () => ({ slot: 'vanguard', cardId: card1Id }),
      };

      const res = await postLineup(mockReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.lineup.vanguardCardId).toBe(card1Id);
      expect(data.lineup.strikerCardId).toBeNull();
      expect(data.lineup.conduitCardId).toBeNull();

      // Verify persistence in Supabase
      const [dbUser] = await db.select().from(users).where(eq(users.id, testUserId));
      expect(dbUser.activeLineup.vanguardCardId).toBe(card1Id);
    });

    it('clears card from existing slot when equipped in another slot (prevents duplicates)', async () => {
      // 1. Equip card1 to Vanguard
      await postLineup({
        url: `http://localhost:3000/api/user/lineup?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ slot: 'vanguard', cardId: card1Id }),
      } as any);

      // 2. Now equip the same card1 to Striker
      const res = await postLineup({
        url: `http://localhost:3000/api/user/lineup?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ slot: 'striker', cardId: card1Id }),
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.lineup.strikerCardId).toBe(card1Id);
      // Vanguard should now be cleared
      expect(data.lineup.vanguardCardId).toBeNull();
    });

    it('unequips slot when cardId is null', async () => {
      // 1. Equip card1 to Conduit
      await postLineup({
        url: `http://localhost:3000/api/user/lineup?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ slot: 'conduit', cardId: card1Id }),
      } as any);

      // 2. Unequip Conduit
      const res = await postLineup({
        url: `http://localhost:3000/api/user/lineup?as=${testUserId}`,
        cookies: { get: () => undefined },
        json: async () => ({ slot: 'conduit', cardId: null }),
      } as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.lineup.conduitCardId).toBeNull();

      const [dbUser] = await db.select().from(users).where(eq(users.id, testUserId));
      expect(dbUser.activeLineup.conduitCardId).toBeNull();
    });
  });
});
