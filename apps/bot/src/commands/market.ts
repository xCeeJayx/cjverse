import { EmbedBuilder } from 'discord.js';
import {
  createMarketListing,
  findActiveListings,
  buyMarketListing,
  cancelMarketListing,
  findListingById,
} from '@cjverse/db';

export function cleanCardId(rawId: string): string {
  return rawId.replace(/^#/, '').trim().toUpperCase();
}

export async function handleMarketList(
  sellerId: string,
  rawCardId: string,
  price: number
): Promise<{ success: boolean; message?: string; embed?: EmbedBuilder }> {
  const cardId = cleanCardId(rawCardId);

  const result = await createMarketListing({
    sellerId,
    cardId,
    price,
  });

  if (!result.success || !result.listing) {
    return {
      success: false,
      message: `❌ **Listing Failed:** ${result.error || 'Unknown error.'}`,
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('🏷️ Card Listed on Marketplace!')
    .setDescription(
      `Your card (\`${cardId}\`) has been listed for sale on the CJVerse marketplace.\n\n` +
      `**Listing ID:** \`${result.listing.id}\`\n` +
      `**Price:** 💎 **${price} Crystals**\n\n` +
      `*Other duelists can now purchase it via \`/market buy ${result.listing.id}\` or on the Web Market.*`
    )
    .setColor(0x10b981);

  return { success: true, embed };
}

export async function handleMarketBrowse(
  page: number = 1
): Promise<{ success: boolean; embed: EmbedBuilder }> {
  const pageSize = 5;
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;

  const listings = await findActiveListings({
    limit: pageSize,
    offset,
  });

  if (listings.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle(`🏪 CJVerse Card Marketplace (Page ${safePage})`)
      .setDescription(
        safePage === 1
          ? '*No cards are currently listed on the marketplace. Be the first to list one with `/market list`!*'
          : `*No active listings found on page ${safePage}.*`
      )
      .setColor(0x06b6d4);

    return { success: true, embed };
  }

  const items = listings
    .map((l) => {
      const cardName = `${l.card.variant.toUpperCase()} ${l.card.race.toUpperCase()}`;
      return (
        `🏷️ **\`[${l.id}]\` ${cardName}** (\`${l.card.id}\`)\n` +
        `> ⚡ Power: **${l.card.powerScore}** | Element: **${l.card.element}** (${l.card.elementTier}) | Lv. ${l.card.level}\n` +
        `> 💎 Price: **${l.price} Crystals** | Seller: **${l.sellerUsername}**`
      );
    })
    .join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle(`🏪 CJVerse Card Marketplace (Page ${safePage})`)
    .setDescription(
      `${items}\n\n` +
      `💡 *Use \`/market buy <listing_id>\` to purchase any card above.*`
    )
    .setColor(0x06b6d4)
    .setFooter({ text: `Page ${safePage} • Active Listings` });

  return { success: true, embed };
}

export async function handleMarketBuy(
  buyerId: string,
  rawListingId: string
): Promise<{ success: boolean; message?: string; embed?: EmbedBuilder }> {
  const listingId = rawListingId.trim().toUpperCase();

  const result = await buyMarketListing({
    buyerId,
    listingId,
  });

  if (!result.success) {
    return {
      success: false,
      message: `❌ **Purchase Failed:** ${result.error}`,
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('🎉 Card Purchased from Marketplace!')
    .setDescription(
      `You successfully bought **${result.cardName}** from the marketplace!\n\n` +
      `💎 **Price Paid:** ${result.price} Crystals\n` +
      `💎 **Your Balance:** ${result.buyerCrystalsRemaining} Crystals remaining\n\n` +
      `*The card has been transferred to your collection! Check \`/inventory\` to view it.*`
    )
    .setColor(0xf59e0b);

  return { success: true, embed };
}
