import { EmbedBuilder } from 'discord.js';
import { buyAndOpenBoosterPack, PackPurchaseResult } from '@cjverse/db';
import { BoosterPackType, BOOSTER_PACKS, GeneratedCard } from '@cjverse/game-logic';

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
  };
}
