import { EmbedBuilder } from 'discord.js';
import { buyAndOpenBoosterPack, PackPurchaseResult } from '@cjverse/db';
import { BoosterPackType, BOOSTER_PACKS, GeneratedCard } from '@cjverse/game-logic';
import { renderCardComposite } from '@cjverse/asset-pipeline';

export function formatVariantEmoji(variant: string): string {
  switch (variant.toLowerCase()) {
    case 'diamond':
      return '💎 Diamond';
    case 'gold':
      return '🌟 Gold';
    case 'silver':
      return '🥈 Silver';
    case 'rainbow':
      return '🌈 Rainbow';
    case 'normal':
    default:
      return '⚪ Normal';
  }
}

export function formatCardSummary(card: GeneratedCard): string {
  const variantDisplay = formatVariantEmoji(card.variant);
  return `• \`${card.id}\` **${card.race.toUpperCase()}** [${variantDisplay}] — Element: **${card.element.toUpperCase()}** (${card.elementTier}-Tier) • Lv.${card.level} • ⚡ **${card.powerScore} Power**`;
}

export async function handlePackBuyCommand(
  userId: string,
  packType: BoosterPackType
): Promise<{
  success: boolean;
  message?: string;
  embed?: EmbedBuilder;
  cards?: GeneratedCard[];
  remainingCrystals?: number;
  featuredCard?: GeneratedCard;
  imageBuffer?: Buffer;
}> {
  const result: PackPurchaseResult = await buyAndOpenBoosterPack(userId, packType);

  if (!result.success) {
    return {
      success: false,
      message: result.error || 'Failed to purchase booster pack.',
    };
  }

  const packConfig = BOOSTER_PACKS[packType] || BOOSTER_PACKS.standard;
  const cards = result.cards || [];

  const color =
    packType === 'ascendant'
      ? 0xf59e0b
      : packType === 'elemental'
      ? 0xa855f7
      : 0x06b6d4;

  const cardListFormatted = cards.map(formatCardSummary).join('\n');

  // Identify featured card (highest rarity variant, highest powerScore)
  const variantRank: Record<string, number> = {
    diamond: 4,
    gold: 3,
    silver: 2,
    normal: 1,
  };
  const sortedCards = [...cards].sort((a, b) => {
    const rA = variantRank[a.variant.toLowerCase()] || 0;
    const rB = variantRank[b.variant.toLowerCase()] || 0;
    if (rB !== rA) return rB - rA;
    return b.powerScore - a.powerScore;
  });
  const featuredCard = sortedCards[0] || cards[0];

  let imageBuffer: Buffer | undefined;
  if (featuredCard) {
    try {
      imageBuffer = await renderCardComposite(featuredCard);
    } catch (err) {
      console.warn('[Pack Command] Failed to render composite:', err);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎉 Opened ${packConfig.name}!`)
    .setDescription(
      `You cracked open a **${packConfig.name}** for **💎 ${result.cost} Crystals**!\n\n` +
      `### 🎴 Pulled Cards (${cards.length})\n` +
      `${cardListFormatted}\n\n` +
      `💰 **Remaining Balance:** **💎 ${result.remainingCrystals?.toLocaleString()} Crystals**`
    )
    .setColor(color)
    .setFooter({
      text: 'Cards have been added to your inventory. Equip them with /equip or view with /inventory!',
    });

  return {
    success: true,
    embed,
    cards,
    remainingCrystals: result.remainingCrystals,
    featuredCard,
    imageBuffer,
  };
}

