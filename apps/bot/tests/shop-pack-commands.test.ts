import { describe, it, expect, beforeEach } from 'vitest';
import { handleShopCommand } from '../src/commands/shop';
import { handlePackBuyCommand } from '../src/commands/pack';
import { handleInteraction } from '../src/index';
import { db, users, cards, eq } from '@cjverse/db';

describe('Discord Bot /shop and /pack Command Handlers', () => {
  const testUserId = 'bot-shop-test-user';

  beforeEach(async () => {
    await db.delete(cards).where(eq(cards.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));

    await db.insert(users).values({
      id: testUserId,
      username: 'ShopPatron',
      crystals: 400,
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });
  });

  describe('/shop Command', () => {
    it('displays user balance and packs with disabled buttons for unaffordable packs', async () => {
      const result = await handleShopCommand(testUserId);
      expect(result.success).toBe(true);

      const embed = result.embed.toJSON();
      expect(embed.title).toContain('Crystal & Booster Pack Shop');
      expect(embed.description).toContain('400 Crystals');
      expect(embed.fields).toHaveLength(3);

      const buttons = result.components[0].components;
      expect(buttons).toHaveLength(3);

      // User has 400 crystals:
      // Standard (150) -> enabled
      // Elemental (350) -> enabled
      // Ascendant (750) -> disabled
      expect(buttons[0].data.disabled).toBe(false);
      expect(buttons[1].data.disabled).toBe(false);
      expect(buttons[2].data.disabled).toBe(true);
    });
  });

  describe('/pack buy Command', () => {
    it('rejects purchase when user has insufficient crystals', async () => {
      const result = await handlePackBuyCommand(testUserId, 'ascendant');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient crystals');
    });

    it('purchases Standard pack, deducts 150 crystals, and awards 3 cards with embed', async () => {
      const result = await handlePackBuyCommand(testUserId, 'standard');
      expect(result.success).toBe(true);
      expect(result.cards).toHaveLength(3);
      expect(result.remainingCrystals).toBe(250);

      const embed = result.embed!.toJSON();
      expect(embed.title).toContain('Opened Standard Booster Pack');
      expect(embed.description).toContain('Pulled Cards (3)');
      expect(embed.description).toContain('250 Crystals');

      for (const card of result.cards!) {
        expect(card.id).toHaveLength(6);
      }
    });

    it('purchases Elemental Hoard pack, deducts 350 crystals, and guarantees silver+ rarity', async () => {
      const result = await handlePackBuyCommand(testUserId, 'elemental');
      expect(result.success).toBe(true);
      expect(result.cards).toHaveLength(3);
      expect(result.remainingCrystals).toBe(50);

      const hasSilverOrHigher = result.cards!.some((c) =>
        ['silver', 'gold', 'diamond', 'rainbow'].includes(c.variant)
      );
      expect(hasSilverOrHigher).toBe(true);
    });
  });

  describe('Interaction Gateway Routing', () => {
    it('routes /shop interaction with deferReply and editReply', async () => {
      let deferred = false;
      let editReplyData: any = null;

      const mockInteraction: any = {
        commandName: 'shop',
        user: { id: testUserId, username: 'ShopPatron' },
        deferReply: async () => {
          deferred = true;
        },
        editReply: async (payload: any) => {
          editReplyData = payload;
        },
        deferred: true,
      };

      await handleInteraction(mockInteraction);
      expect(deferred).toBe(true);
      expect(editReplyData).toBeDefined();
      expect(editReplyData.embeds).toBeDefined();
      expect(editReplyData.components).toBeDefined();
    });

    it('routes /pack buy interaction and returns pulled cards embed', async () => {
      let deferred = false;
      let editReplyData: any = null;

      const mockInteraction: any = {
        commandName: 'pack',
        user: { id: testUserId, username: 'ShopPatron' },
        options: {
          getSubcommand: () => 'buy',
          getString: (name: string) => (name === 'type' ? 'standard' : null),
        },
        deferReply: async () => {
          deferred = true;
        },
        editReply: async (payload: any) => {
          editReplyData = payload;
        },
        deferred: true,
      };

      await handleInteraction(mockInteraction);
      expect(deferred).toBe(true);
      expect(editReplyData).toBeDefined();
      expect(editReplyData.embeds[0].data.title).toContain('Opened Standard Booster Pack');
    });
  });
});
