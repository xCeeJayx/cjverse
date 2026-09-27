import {
  Client,
  GatewayIntentBits,
  Events,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  EmbedBuilder,
} from 'discord.js';
import dotenv from 'dotenv';
import path from 'node:path';
import {
  db,
  users,
  cards,
  findUserById,
  isLineupComplete,
  UserActiveLineup,
} from '@cjverse/db';
import { handleHuntCommand } from './commands/hunt';
import {
  handleInventoryCommand,
  paginateCards,
  formatCardLineupTag,
} from './commands/inventory';
import { handleDuelCommand, handleDuelBotCommand } from './commands/duel';
import { handleEquipCommand } from './commands/equip';
import { handleUpgradeCommand } from './commands/upgrade';
import { handleEvolveCommand } from './commands/evolve';

// Safe environment variable loading from root and bot .env files
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export * from './services/cooldown';
export * from './commands/hunt';
export * from './commands/inventory';
export * from './commands/duel';
export * from './commands/equip';
export * from './commands/upgrade';
export * from './commands/evolve';
export * from './services/card-resolver';
export * from './deploy-commands';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on(Events.ClientReady, (readyClient) => {
  console.log(`[Bot Gateway] Logged in as ${readyClient.user.tag}!`);
});

export async function handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName === 'hunt') {
    // 1. Immediately defer reply to avoid Discord's 3-second gateway interaction timeout
    await interaction.deferReply();

    try {
      // 2. Generate card, insert card into DB, render composite image
      const result = await handleHuntCommand(interaction.user.id, interaction.user.username);

      if (!result.success) {
        const remainingMs = result.cooldownRemainingMs ?? 0;
        const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
        await interaction.editReply(
          `⏳ You are on hunt cooldown! Please wait **${remainingSeconds}s** before hunting again.`
        );
        return;
      }

      const card = result.card!;
      const attachment = new AttachmentBuilder(result.imageBuffer!, {
        name: `card-${card.race}-${card.variant}.png`,
      });

      const cardIdDisplay = card.id ? `\`${card.id}\`` : 'Generated';

      const embed = new EmbedBuilder()
        .setTitle(`🏹 Hunt Successful: ${card.variant.toUpperCase()} ${card.race.toUpperCase()}`)
        .setDescription(
          `**Card ID:** ${cardIdDisplay}\n` +
            `**Element:** ${card.element} (${card.elementTier})\n` +
            `**Level:** ${card.level}\n` +
            `**Power Score:** ${card.powerScore}`
        )
        .setImage(`attachment://${attachment.name}`)
        .setColor(0x5865f2);

      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error('[Hunt Command Error]:', err);
      await interaction
        .editReply({
          content: '❌ An error occurred while generating your hunt card. Please try again.',
        })
        .catch(() => {});
    }
    return;
  }

  if (interaction.commandName === 'inventory') {
    await interaction.deferReply();
    const page = interaction.options.getInteger('page') ?? 1;

    try {
      const result = await handleInventoryCommand(interaction.user.id, page);

      if (result.isEmpty || !result.cards || result.cards.length === 0) {
        await interaction.editReply(
          "🎒 You don't own any cards yet! Use `/hunt` to discover your first card."
        );
        return;
      }

      const lineup = result.lineup ?? {
        vanguardCardId: null,
        strikerCardId: null,
        conduitCardId: null,
      };

      const embed = new EmbedBuilder()
        .setTitle(
          `🎒 ${interaction.user.username}'s Inventory (Page ${result.currentPage}/${result.totalPages})`
        )
        .setDescription(
          result.cards
            .map((c, i) => {
              const tag = formatCardLineupTag(c.id, lineup);
              const tagStr = tag ? ` **${tag}**` : '';
              return (
                `**${(result.currentPage! - 1) * 5 + i + 1}.** **${c.variant.toUpperCase()} ${c.race.toUpperCase()}**${tagStr}\n` +
                `> Element: ${c.element} | Power: ${c.powerScore} | ID: ${c.id}`
              );
            })
            .join('\n\n')
        )
        .setFooter({
          text: `Page ${result.currentPage} of ${result.totalPages} • Total Cards: ${result.totalCards}`,
        })
        .setColor(0x00ff99);

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Inventory Command Error]:', err);
      await interaction.editReply('❌ Failed to retrieve inventory. Please try again later.');
    }
    return;
  }

  if (interaction.commandName === 'equip') {
    await interaction.deferReply();
    const slot = interaction.options.getString('slot', true);
    const cardId = interaction.options.getString('card_id', true);

    try {
      const result = await handleEquipCommand(interaction.user.id, slot, cardId);

      if (!result.success) {
        await interaction.editReply(`❌ **Equip Failed:** ${result.error}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('⚔️ Active Lineup Updated!')
        .setDescription(
          `Successfully equipped card into your **${slot.toUpperCase()}** slot!\n\n` +
            `**Current Active Lineup:**\n` +
            `🛡️ **VANGUARD:** ${result.embedData?.vanguardCardName}\n` +
            `⚔️ **STRIKER:** ${result.embedData?.strikerCardName}\n` +
            `🔮 **CONDUIT:** ${result.embedData?.conduitCardName}`
        )
        .setColor(0x00ff99);

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Equip Command Error]:', err);
      await interaction.editReply('❌ An error occurred while equipping your card.');
    }
    return;
  }

  if (interaction.commandName === 'duel') {
    const target = interaction.options.getUser('target', true);

    if (interaction.user.id === target.id) {
      await interaction.reply({
        content: '❌ **Duel Challenge Failed:** Challenger and opponent must be distinct users.',
        ephemeral: true,
      });
      return;
    }

    if (target.bot) {
      await interaction.reply({
        content: '❌ **Duel Challenge Failed:** Cannot challenge a bot to a duel.',
        ephemeral: true,
      });
      return;
    }

    if (typeof interaction.deferReply === 'function') {
      await interaction.deferReply();
    }

    try {
      const result = await handleDuelCommand(interaction.user.id, target.id, target.bot);

      if (!result.success) {
        if (interaction.deferred) {
          await interaction.editReply(`❌ **Duel Challenge Failed:** ${result.error}`);
        } else {
          await interaction.reply({
            content: `❌ **Duel Challenge Failed:** ${result.error}`,
            ephemeral: true,
          });
        }
        return;
      }

      const replyContent =
        `⚔️ **DUEL CHALLENGE ACCEPTED!**\n` +
        `<@${interaction.user.id}> has challenged <@${target.id}> to a real-time card duel!\n\n` +
        `👉 **Enter the Arena:** ${result.arenaUrl}`;

      if (interaction.deferred) {
        await interaction.editReply(replyContent);
      } else {
        await interaction.reply(replyContent);
      }
    } catch (err) {
      console.error('[Duel Command Error]:', err);
      if (interaction.deferred) {
        await interaction.editReply('❌ An error occurred while creating the duel match room.');
      } else {
        await interaction.reply({
          content: '❌ An error occurred while creating the duel match room.',
          ephemeral: true,
        });
      }
    }
    return;
  }

  if (interaction.commandName === 'duel-bot') {
    if (typeof interaction.deferReply === 'function') {
      await interaction.deferReply();
    }

    try {
      const result = await handleDuelBotCommand(interaction.user.id, interaction.user.username);

      if (!result.success) {
        if (interaction.deferred || typeof interaction.editReply === 'function') {
          await interaction.editReply(`❌ **Practice Duel Failed:** ${result.error}`);
        } else if (typeof interaction.reply === 'function') {
          await interaction.reply({
            content: `❌ **Practice Duel Failed:** ${result.error}`,
            ephemeral: true,
          });
        }
        return;
      }

      const replyContent =
        `🤖 **PRACTICE DUEL CREATED!**\n` +
        `<@${interaction.user.id}> vs **AI Training Bot** (3v3)\n\n` +
        `👉 **Enter the Arena:** ${result.arenaUrl}`;

      if (interaction.deferred || typeof interaction.editReply === 'function') {
        await interaction.editReply(replyContent);
      } else if (typeof interaction.reply === 'function') {
        await interaction.reply(replyContent);
      }
    } catch (err) {
      console.error('[Duel-Bot Command Error]:', err);
      if (interaction.deferred || typeof interaction.editReply === 'function') {
        await interaction.editReply('❌ An error occurred while creating the practice duel.').catch(() => {});
      } else if (typeof interaction.reply === 'function') {
        await interaction.reply({
          content: '❌ An error occurred while creating the practice duel.',
          ephemeral: true,
        }).catch(() => {});
      }
    }
    return;
  }

  if (interaction.commandName === 'upgrade') {
    if (typeof interaction.deferReply === 'function') {
      await interaction.deferReply();
    }
    const cardId = interaction.options.getString('card_id', true);

    try {
      const result = await handleUpgradeCommand(interaction.user.id, cardId);

      if (!result.success) {
        const errMsg = `❌ **Upgrade Failed:** ${result.error}`;
        if (interaction.deferred || typeof interaction.editReply === 'function') {
          await interaction.editReply(errMsg);
        } else if (typeof interaction.reply === 'function') {
          await interaction.reply({ content: errMsg, ephemeral: true });
        }
        return;
      }

      const card = result.card!;
      const embed = new EmbedBuilder()
        .setTitle(`✨ Card Upgraded: ${card.variant.toUpperCase()} ${card.race.toUpperCase()}`)
        .setDescription(
          `**Card ID:** \`${card.id}\`\n` +
          `**Element:** ${card.element} (${card.elementTier})\n\n` +
          `📈 **Level:** Lv. ${result.oldLevel} ➔ **Lv. ${result.newLevel}**\n` +
          `⚡ **Power Score:** ${result.oldPowerScore} ➔ **${result.newPowerScore}** (+${(result.newPowerScore ?? 0) - (result.oldPowerScore ?? 0)})\n\n` +
          `**Stat Growth Breakdown:**\n` +
          `• **HP:** ${result.oldStats?.maxHp} ➔ **${result.newStats?.maxHp}** (+${(result.newStats?.maxHp ?? 0) - (result.oldStats?.maxHp ?? 0)})\n` +
          `• **ATK:** ${result.oldStats?.atk} ➔ **${result.newStats?.atk}** (+${(result.newStats?.atk ?? 0) - (result.oldStats?.atk ?? 0)})\n` +
          `• **DEF:** ${result.oldStats?.def} ➔ **${result.newStats?.def}** (+${(result.newStats?.def ?? 0) - (result.oldStats?.def ?? 0)})\n\n` +
          `💎 **Upgrade Cost:** -${result.cost} Crystals (Remaining: **${result.remainingCrystals}**)`
        )
        .setColor(0x00ff99);

      if (interaction.deferred || typeof interaction.editReply === 'function') {
        await interaction.editReply({ embeds: [embed] });
      } else if (typeof interaction.reply === 'function') {
        await interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('[Upgrade Interaction Error]:', err);
      const errFallback = '❌ An error occurred while upgrading your card.';
      if (interaction.deferred || typeof interaction.editReply === 'function') {
        await interaction.editReply(errFallback).catch(() => {});
      } else if (typeof interaction.reply === 'function') {
        await interaction.reply({ content: errFallback, ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  if (interaction.commandName === 'evolve') {
    if (typeof interaction.deferReply === 'function') {
      await interaction.deferReply();
    }
    const cardId = interaction.options.getString('card_id', true);

    try {
      const result = await handleEvolveCommand(interaction.user.id, cardId);

      if (!result.success) {
        const errMsg = `❌ **Evolution Failed:** ${result.error}`;
        if (interaction.deferred || typeof interaction.editReply === 'function') {
          await interaction.editReply(errMsg);
        } else if (typeof interaction.reply === 'function') {
          await interaction.reply({ content: errMsg, ephemeral: true });
        }
        return;
      }

      const card = result.card!;
      const embed = new EmbedBuilder()
        .setTitle(`🌟 Evolution Complete: ${card.variant.toUpperCase()} ${card.race.toUpperCase()}`)
        .setDescription(
          `**Card ID:** \`${card.id}\`\n` +
          `**Element:** ${card.element} (${card.elementTier})\n\n` +
          `🧬 **Evolution Stage:** ${result.oldStageName} (Stage ${result.oldStage}) ➔ **${result.newStageName} (Stage ${result.newStage})**\n` +
          `⚡ **Power Score:** ${result.oldPowerScore} ➔ **${result.newPowerScore}** (+${(result.newPowerScore ?? 0) - (result.oldPowerScore ?? 0)})\n\n` +
          `💎 **Evolution Cost:** -${result.cost} Crystals (Remaining: **${result.remainingCrystals}**)`
        )
        .setColor(0x9b59b6);

      if (result.imageBuffer) {
        const attachment = new AttachmentBuilder(result.imageBuffer, {
          name: `evolved-${card.race}-${card.variant}.png`,
        });
        embed.setImage(`attachment://${attachment.name}`);
        if (interaction.deferred || typeof interaction.editReply === 'function') {
          await interaction.editReply({ embeds: [embed], files: [attachment] });
        } else if (typeof interaction.reply === 'function') {
          await interaction.reply({ embeds: [embed], files: [attachment] });
        }
      } else {
        if (interaction.deferred || typeof interaction.editReply === 'function') {
          await interaction.editReply({ embeds: [embed] });
        } else if (typeof interaction.reply === 'function') {
          await interaction.reply({ embeds: [embed] });
        }
      }
    } catch (err) {
      console.error('[Evolve Interaction Error]:', err);
      const errFallback = '❌ An error occurred while evolving your card.';
      if (interaction.deferred || typeof interaction.editReply === 'function') {
        await interaction.editReply(errFallback).catch(() => {});
      } else if (typeof interaction.reply === 'function') {
        await interaction.reply({ content: errFallback, ephemeral: true }).catch(() => {});
      }
    }
    return;
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleInteraction(interaction);
  } catch (err) {
    console.error('[Bot Gateway] Interaction handling error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction
        .editReply({
          content: 'An unexpected error occurred while executing this command.',
        })
        .catch(() => {});
    } else {
      await interaction
        .reply({
          content: 'An unexpected error occurred while executing this command.',
          ephemeral: true,
        })
        .catch(() => {});
    }
  }
});

// Auto-login when executed in runtime (non-test environment)
if (process.env.NODE_ENV !== 'test' && process.env.DISCORD_TOKEN) {
  client.login(process.env.DISCORD_TOKEN).catch((err) => {
    console.error('[Bot Gateway] Failed to login to Discord:', err);
  });
}
