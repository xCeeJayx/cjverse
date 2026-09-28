import { EmbedBuilder } from 'discord.js';
import { fuseThreeCards } from '@cjverse/db';
import { cleanCardId } from './market';

/**
 * Handles `/fuse [card1_id] [card2_id] [card3_id]`
 */
export async function handleFuseCommand(
  userId: string,
  rawCard1: string,
  rawCard2: string,
  rawCard3: string
): Promise<{ success: boolean; message?: string; embed?: EmbedBuilder }> {
  const card1 = cleanCardId(rawCard1);
  const card2 = cleanCardId(rawCard2);
  const card3 = cleanCardId(rawCard3);

  const result = await fuseThreeCards(userId, [card1, card2, card3]);

  if (!result.success || !result.fusedCard || !result.sacrificeCards) {
    return {
      success: false,
      message: `❌ **Fusion Failed:** ${result.error || 'Failed to fuse cards.'}`,
    };
  }

  const { fusedCard, sacrificeCards } = result;

  const sacrificeDesc = sacrificeCards
    .map(
      (c, idx) =>
        `\`#${c.id}\` — **${c.variant.toUpperCase()} ${c.race.toUpperCase()}** (${c.element.toUpperCase()} | ⚡${c.powerScore})`
    )
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('⚗️ Arcane Fusion Successful!')
    .setDescription(
      `The Arcane Forge synthesized your sacrificial cards into a higher-tier artifact!\n\n` +
        `**⚡ Newly Synthesized Card:**\n` +
        `🎴 **#${fusedCard.id}** — **${fusedCard.variant.toUpperCase()} ${fusedCard.race.toUpperCase()}**\n` +
        `**Element:** \`${fusedCard.element.toUpperCase()}\` (Tier ${fusedCard.elementTier})\n` +
        `**Power Score:** ⚡ **${fusedCard.powerScore}** *(+10% Fusion Bonus)*\n` +
        `**Evolution:** Stage ${fusedCard.evolutionStage} | Level ${fusedCard.level}`
    )
    .addFields({
      name: '🔥 Sacrificed Offerings',
      value: sacrificeDesc,
    })
    .setColor(0xeab308);

  return { success: true, embed };
}
