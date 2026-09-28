import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleSalvageSingle, handleSalvageBulk } from '../src/commands/salvage';
import { handleFuseCommand } from '../src/commands/fuse';
import { handleInteraction } from '../src';
import {
  ensureUser,
  db,
  users,
  cards,
  marketListings,
  eq,
} from '@cjverse/db';

describe('Discord Bot /salvage and /fuse Command Handlers (apps/bot)', () => {
  const testUserId = 'test-bot-forge-user';

  beforeEach(async () => {
    await db.delete(marketListings).where(eq(marketListings.sellerId, testUserId));
    await db.delete(cards).where(eq(cards.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));

    await ensureUser(testUserId, 'BotForgeHero');
    await db
      .update(users)
      .set({
        crystals: 100,
        arcaneDust: 0,
        activeLineup: {
          vanguardCardId: null,
          strikerCardId: null,
          conduitCardId: null,
        },
      })
      .where(eq(users.id, testUserId));
  });

  describe('/salvage single', () => {
    it('rejects salvaging when card is not found or not owned', async () => {
      const res = await handleSalvageSingle(testUserId, 'INVALID');
      expect(res.success).toBe(false);
      expect(res.message).toContain('could not be found');
    });

    it('rejects salvaging when card is equipped in active lineup', async () => {
      const [c1] = await db
        .insert(cards)
        .values({
          userId: testUserId,
          race: 'dragon',
          variant: 'normal',
          element: 'fire',
          elementTier: 'C',
          powerScore: 200,
          seed: 111,
        })
        .returning();

      await db
        .update(users)
        .set({ activeLineup: { vanguardCardId: c1.id, strikerCardId: null, conduitCardId: null } })
        .where(eq(users.id, testUserId));

      const res = await handleSalvageSingle(testUserId, c1.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('currently equipped');
    });

    it('dismantles card and returns celebratory embed with reclaimed essence', async () => {
      const [c1] = await db
        .insert(cards)
        .values({
          userId: testUserId,
          race: 'elf',
          variant: 'silver',
          element: 'water',
          elementTier: 'B',
          powerScore: 260,
          seed: 222,
        })
        .returning();

      const res = await handleSalvageSingle(testUserId, c1.id);
      expect(res.success).toBe(true);
      expect(res.embed).toBeDefined();

      const data = res.embed!.toJSON();
      expect(data.title).toContain('Card Disenchanted');
      // Silver = 50 dust, 35 crystals
      expect(data.description).toContain('+50 Arcane Dust');
      expect(data.description).toContain('+35 Crystals');
    });
  });

  describe('/salvage bulk', () => {
    it('rejects invalid rarity tier', async () => {
      const res = await handleSalvageBulk(testUserId, 'mythic');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Invalid Rarity');
    });

    it('bulk dismantles all unequipped cards of specified rarity', async () => {
      await db.insert(cards).values([
        { userId: testUserId, race: 'orc', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 200, seed: 301 },
        { userId: testUserId, race: 'orc', variant: 'normal', element: 'water', elementTier: 'C', powerScore: 200, seed: 302 },
      ]);

      const res = await handleSalvageBulk(testUserId, 'normal');
      expect(res.success).toBe(true);
      expect(res.embed).toBeDefined();

      const data = res.embed!.toJSON();
      expect(data.title).toContain('Bulk Salvage Completed');
      expect(data.description).toContain('Dismantled **2**');
      expect(data.description).toContain('+30 Arcane Dust');
      expect(data.description).toContain('+20 Crystals');
    });
  });

  describe('/fuse', () => {
    it('rejects fusion if sacrifice cards have mismatched variants', async () => {
      const [c1] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'dragon', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 200, seed: 401 })
        .returning();
      const [c2] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'dragon', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 200, seed: 402 })
        .returning();
      const [c3] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'dragon', variant: 'gold', element: 'fire', elementTier: 'C', powerScore: 200, seed: 403 })
        .returning();

      const res = await handleFuseCommand(testUserId, c1.id, c2.id, c3.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('exact same variant');
    });

    it('fuses 3 cards and returns celebratory embed with synthesized card', async () => {
      const [c1] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'dragon', variant: 'silver', element: 'fire', elementTier: 'B', powerScore: 300, seed: 501 })
        .returning();
      const [c2] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'dragon', variant: 'silver', element: 'fire', elementTier: 'B', powerScore: 300, seed: 502 })
        .returning();
      const [c3] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'elf', variant: 'silver', element: 'ice', elementTier: 'B', powerScore: 300, seed: 503 })
        .returning();

      const res = await handleFuseCommand(testUserId, c1.id, c2.id, c3.id);
      expect(res.success).toBe(true);
      expect(res.embed).toBeDefined();

      const data = res.embed!.toJSON();
      expect(data.title).toContain('Arcane Fusion Successful');
      expect(data.description).toContain('GOLD');
      expect(data.description).toContain('FIRE');
    });
  });

  describe('Interaction Gateway Routing', () => {
    it('routes /salvage single through gateway', async () => {
      const [c1] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'orc', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 200, seed: 601 })
        .returning();

      const mockInteraction: any = {
        commandName: 'salvage',
        user: { id: testUserId, username: 'BotForgeHero' },
        options: {
          getSubcommand: vi.fn().mockReturnValue('single'),
          getString: vi.fn().mockImplementation((name: string) => {
            if (name === 'card_id') return c1.id;
            return null;
          }),
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
      };

      await handleInteraction(mockInteraction);
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );
    });

    it('routes /fuse through gateway', async () => {
      const [c1] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'orc', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 200, seed: 701 })
        .returning();
      const [c2] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'orc', variant: 'normal', element: 'fire', elementTier: 'C', powerScore: 200, seed: 702 })
        .returning();
      const [c3] = await db
        .insert(cards)
        .values({ userId: testUserId, race: 'orc', variant: 'normal', element: 'water', elementTier: 'C', powerScore: 200, seed: 703 })
        .returning();

      const mockInteraction: any = {
        commandName: 'fuse',
        user: { id: testUserId, username: 'BotForgeHero' },
        options: {
          getString: vi.fn().mockImplementation((name: string) => {
            if (name === 'card1_id') return c1.id;
            if (name === 'card2_id') return c2.id;
            if (name === 'card3_id') return c3.id;
            return null;
          }),
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
      };

      await handleInteraction(mockInteraction);
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );
    });
  });
});
