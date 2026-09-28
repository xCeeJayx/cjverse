import { EmbedBuilder } from 'discord.js';
import { salvageCards, salvageCardsByRarity } from '@cjverse/db';
import { cleanCardId } from './market';

/**
 * Handles `/salvage single [card_id]`
 */
export async function handleSalvageSingle(
  userId: string,
  rawCardId: string
): Promise<{ success: boolean; message?: string; embed?: EmbedBuilder }> {
  const cardId = cleanCardId(rawCardId);

  const result = await salvageCards(userId, [cardId]);

  if (!result.success) {
    return {
      success: false,
      message: `❌ **Salvage Failed:** ${result.error || 'Unable to dismantle card.'}`,
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('✨ Card Disenchanted!')
    .setDescription(
      `Card \`#${cardId}\` was dissolved into raw essence within the Arcane Forge.\n\n` +
        `**Materials Reclaimed:**\n` +
        `🔮 **+${result.arcaneDustGained} Arcane Dust**\n` +
        `💎 **+${result.crystalsGained} Crystals**\n\n` +
        `**New Balance:** 🔮 \`${result.newBalance?.arcaneDust} Dust\` | 💎 \`${result.newBalance?.crystals} Crystals\``
    )
    .setColor(0xa855f7);

  return { success: true, embed };
}

/**
 * Handles `/salvage bulk [rarity]`
 */
export async function handleSalvageBulk(
  userId: string,
  rarity: string
): Promise<{ success: boolean; message?: string; embed?: EmbedBuilder }> {
  const normalizedRarity = rarity.toLowerCase().trim();

  const validRarities = ['normal', 'silver', 'gold', 'diamond'];
  if (!validRarities.includes(normalizedRarity)) {
    return {
      success: false,
      message: `❌ **Invalid Rarity:** Must be one of: \`normal\`, \`silver\`, \`gold\`, \`diamond\`.`,
    };
  }

  const result = await salvageCardsByRarity(userId, normalizedRarity);

  if (!result.success) {
    return {
      success: false,
      message: `❌ **Bulk Salvage Failed:** ${result.error || 'No cards were salvaged.'}`,
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('🔥 Arcane Bulk Salvage Completed!')
    .setDescription(
      `Dismantled **${result.count}** unequipped and unlisted \`${normalizedRarity.toUpperCase()}\` cards.\n\n` +
        `**Total Essence Reclaimed:**\n` +
        `🔮 **+${result.arcaneDustGained} Arcane Dust**\n` +
        `💎 **+${result.crystalsGained} Crystals**\n\n` +
        `**New Balance:** 🔮 \`${result.newBalance?.arcaneDust} Dust\` | 💎 \`${result.newBalance?.crystals} Crystals\``
    )
    .setColor(0xf59e0b);

  return { success: true, embed };
}
