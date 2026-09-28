import { describe, it, expect, beforeEach } from 'vitest';
import { db, users, cards, marketListings, trades, eq } from '@cjverse/db';
import {
  handleMarketList,
  handleMarketBrowse,
  handleMarketBuy,
} from '../src/commands/market';
import {
  handleTradePropose,
  handleTradeAccept,
  handleTradeDecline,
} from '../src/commands/trade';

describe('Marketplace & Trading Commands and Persistence', () => {
  const sellerId = 'market-test-seller-1';
  const buyerId = 'market-test-buyer-2';
  const sellerCardId = 'MCARD1';
  const buyerCardId = 'MCARD2';

  beforeEach(async () => {
    // Cleanup existing test records
    await db.delete(trades).where(eq(trades.proposerId, sellerId));
    await db.delete(trades).where(eq(trades.proposerId, buyerId));
    await db.delete(marketListings).where(eq(marketListings.sellerId, sellerId));
    await db.delete(marketListings).where(eq(marketListings.sellerId, buyerId));
    await db.delete(cards).where(eq(cards.id, sellerCardId));
    await db.delete(cards).where(eq(cards.id, buyerCardId));
    await db.delete(users).where(eq(users.id, sellerId));
    await db.delete(users).where(eq(users.id, buyerId));

    // Create seller
    await db.insert(users).values({
      id: sellerId,
      username: 'MerchantSeller',
      crystals: 100,
      activeLineup: {
        vanguardCardId: null,
        strikerCardId: null,
        conduitCardId: null,
      },
    });

    // Create buyer
    await db.insert(users).values({
      id: buyerId,
      username: 'WealthyBuyer',
      crystals: 500,
      activeLineup: {
        vanguardCardId: null,
        strikerCardId: null,
        conduitCardId: null,
      },
    });

    // Create cards
    await db.insert(cards).values({
      id: sellerCardId,
      userId: sellerId,
      race: 'draconian',
      variant: 'crimson',
      element: 'fire',
      elementTier: 't1',
      evolutionStage: 1,
      level: 5,
      powerScore: 120,
      seed: 12345,
    });

    await db.insert(cards).values({
      id: buyerCardId,
      userId: buyerId,
      race: 'abyssal',
      variant: 'shadow',
      element: 'dark',
      elementTier: 't2',
      evolutionStage: 1,
      level: 10,
      powerScore: 250,
      seed: 67890,
    });
  });

  describe('Marketplace Functionality', () => {
    it('rejects listing when card is not owned by seller', async () => {
      const res = await handleMarketList(buyerId, sellerCardId, 50);
      expect(res.success).toBe(false);
      expect(res.message).toContain('do not own');
    });

    it('rejects listing when card is equipped in active lineup', async () => {
      await db.update(users).set({
        activeLineup: {
          vanguardCardId: sellerCardId,
          strikerCardId: null,
          conduitCardId: null,
        },
      }).where(eq(users.id, sellerId));

      const res = await handleMarketList(sellerId, sellerCardId, 50);
      expect(res.success).toBe(false);
      expect(res.message).toContain('equipped');
    });

    it('successfully creates market listing and can browse it', async () => {
      const listRes = await handleMarketList(sellerId, sellerCardId, 80);
      expect(listRes.success).toBe(true);
      expect(listRes.embed).toBeDefined();

      const browseRes = await handleMarketBrowse(1);
      expect(browseRes.success).toBe(true);
      const desc = browseRes.embed.data.description;
      expect(desc).toContain('CRIMSON DRACONIAN');
      expect(desc).toContain('80 Crystals');
      expect(desc).toContain('MerchantSeller');
    });

    it('rejects buying own listing', async () => {
      const listRes = await handleMarketList(sellerId, sellerCardId, 80);
      const listing = (await db.select().from(marketListings).where(eq(marketListings.cardId, sellerCardId)))[0];

      const buyRes = await handleMarketBuy(sellerId, listing.id);
      expect(buyRes.success).toBe(false);
      expect(buyRes.message).toContain('cannot buy your own');
    });

    it('rejects buying when buyer lacks crystals', async () => {
      const listRes = await handleMarketList(sellerId, sellerCardId, 9999);
      const listing = (await db.select().from(marketListings).where(eq(marketListings.cardId, sellerCardId)))[0];

      const buyRes = await handleMarketBuy(buyerId, listing.id);
      expect(buyRes.success).toBe(false);
      expect(buyRes.message).toContain('Insufficient crystals');
    });

    it('completes market purchase atomically', async () => {
      await handleMarketList(sellerId, sellerCardId, 80);
      const listing = (await db.select().from(marketListings).where(eq(marketListings.cardId, sellerCardId)))[0];

      const buyRes = await handleMarketBuy(buyerId, listing.id);
      expect(buyRes.success).toBe(true);
      expect(buyRes.embed?.data.description).toContain('80 Crystals');

      // Check DB state
      const [updatedBuyer] = await db.select().from(users).where(eq(users.id, buyerId));
      const [updatedSeller] = await db.select().from(users).where(eq(users.id, sellerId));
      const [updatedCard] = await db.select().from(cards).where(eq(cards.id, sellerCardId));
      const [updatedListing] = await db.select().from(marketListings).where(eq(marketListings.id, listing.id));

      expect(updatedBuyer.crystals).toBe(420); // 500 - 80
      expect(updatedSeller.crystals).toBe(180); // 100 + 80
      expect(updatedCard.userId).toBe(buyerId); // Ownership transferred
      expect(updatedListing.status).toBe('sold');
    }, 15000);
  });

  describe('Player-to-Player Trading Functionality', () => {
    it('rejects proposing a trade with yourself', async () => {
      const res = await handleTradePropose({
        proposerId: sellerId,
        targetId: sellerId,
        rawProposerCardId: sellerCardId,
        rawTargetCardId: buyerCardId,
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain('yourself');
    });

    it('rejects trade when offered card is equipped', async () => {
      await db.update(users).set({
        activeLineup: {
          vanguardCardId: sellerCardId,
          strikerCardId: null,
          conduitCardId: null,
        },
      }).where(eq(users.id, sellerId));

      const res = await handleTradePropose({
        proposerId: sellerId,
        targetId: buyerId,
        rawProposerCardId: sellerCardId,
        rawTargetCardId: buyerCardId,
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('equipped');
    });

    it('creates trade proposal with Accept/Decline buttons and completes swap on accept', async () => {
      const proposeRes = await handleTradePropose({
        proposerId: sellerId,
        targetId: buyerId,
        rawProposerCardId: sellerCardId,
        rawTargetCardId: buyerCardId,
      });

      expect(proposeRes.success).toBe(true);
      expect(proposeRes.components).toHaveLength(1);
      expect(proposeRes.components![0].components).toHaveLength(2);

      const [pendingTrade] = await db.select().from(trades).where(eq(trades.proposerId, sellerId));
      expect(pendingTrade).toBeDefined();
      expect(pendingTrade.status).toBe('pending');

      // Reject non-target accepting
      const wrongAccept = await handleTradeAccept(pendingTrade.id, 'random-third-party');
      expect(wrongAccept.success).toBe(false);

      // Target accepts trade
      const acceptRes = await handleTradeAccept(pendingTrade.id, buyerId);
      expect(acceptRes.success).toBe(true);

      // Check card swap in DB
      const [pCard] = await db.select().from(cards).where(eq(cards.id, sellerCardId));
      const [tCard] = await db.select().from(cards).where(eq(cards.id, buyerCardId));
      expect(pCard.userId).toBe(buyerId);
      expect(tCard.userId).toBe(sellerId);

      // Check trade status
      const [acceptedTrade] = await db.select().from(trades).where(eq(trades.id, pendingTrade.id));
      expect(acceptedTrade.status).toBe('accepted');
    }, 15000);

    it('handles trade decline properly', async () => {
      await handleTradePropose({
        proposerId: sellerId,
        targetId: buyerId,
        rawProposerCardId: sellerCardId,
        rawTargetCardId: buyerCardId,
      });

      const [pendingTrade] = await db.select().from(trades).where(eq(trades.proposerId, sellerId));
      const declineRes = await handleTradeDecline(pendingTrade.id, buyerId);
      expect(declineRes.success).toBe(true);

      const [declinedTrade] = await db.select().from(trades).where(eq(trades.id, pendingTrade.id));
      expect(declinedTrade.status).toBe('declined');
    }, 15000);
  });
});
