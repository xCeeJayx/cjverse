import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { findUserById, ensureUser } from '@cjverse/db';
import { BOOSTER_PACKS } from '@cjverse/game-logic';

export async function handleShopCommand(userId: string): Promise<{
  success: boolean;
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  let user = await findUserById(userId);
  if (!user) {
    user = await ensureUser(userId, userId);
  }

  const crystals = user.crystals ?? 0;

  const embed = new EmbedBuilder()
    .setTitle('🏪 CJVerse Crystal & Booster Pack Shop')
    .setDescription(
      `Welcome to the Crystal Emporium! Purchase booster packs to expand your card collection, discover legendary elementals, and ascend your duel team.\n\n` +
      `💎 **Your Crystal Balance:** **${crystals.toLocaleString()} Crystals**`
    )
    .setColor(0x06b6d4)
    .addFields(
      {
        name: '📦 Standard Booster Pack — 💎 150 Crystals',
        value:
          `• **Cards:** 3\n` +
          `• **Distribution:** 75% Normal, 20% Silver, 4.5% Gold, 0.5% Diamond\n` +
          `• **Best for:** Rapid binder expansion & early deckbuilding\n` +
          `• **Command:** \`/pack buy type:standard\``,
        inline: false,
      },
      {
        name: '🔮 Elemental Hoard — 💎 350 Crystals',
        value:
          `• **Cards:** 3\n` +
          `• **Guaranteed:** 1+ Silver or higher rarity\n` +
          `• **Bonus:** Boosted chance for rare Arcane, Shadow, Blood, & Void elements\n` +
          `• **Command:** \`/pack buy type:elemental\``,
        inline: false,
      },
      {
        name: '👑 Ascendant Vault — 💎 750 Crystals',
        value:
          `• **Cards:** 4\n` +
          `• **Guaranteed:** 1+ Gold or Diamond variant card\n` +
          `• **Bonus:** Boosted base level (Lv.3-6) and massive power scores\n` +
          `• **Command:** \`/pack buy type:ascendant\``,
        inline: false,
      }
    )
    .setFooter({
      text: 'Click a button below or use /pack buy [type] to open a pack immediately!',
    });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('shop_buy_standard')
      .setLabel('Buy Standard (150 💎)')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(crystals < BOOSTER_PACKS.standard.cost),
    new ButtonBuilder()
      .setCustomId('shop_buy_elemental')
      .setLabel('Buy Elemental (350 💎)')
      .setStyle(ButtonStyle.Success)
      .setDisabled(crystals < BOOSTER_PACKS.elemental.cost),
    new ButtonBuilder()
      .setCustomId('shop_buy_ascendant')
      .setLabel('Buy Ascendant (750 💎)')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(crystals < BOOSTER_PACKS.ascendant.cost)
  );

  return {
    success: true,
    embed,
    components: [row],
  };
}
