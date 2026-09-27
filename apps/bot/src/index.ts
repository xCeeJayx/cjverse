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
  findCardsByUserId,
  createCard,
  upsertUser,
  isLineupComplete,
  UserActiveLineup,
} from '@cjverse/db';
import { handleHuntCommand } from './commands/hunt';
import { paginateCards, formatCardLineupTag } from './commands/inventory';
import { handleDuelCommand } from './commands/duel';

// Load environment variables from apps/bot/.env and root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export * from './services/cooldown';
export * from './commands/hunt';
export * from './commands/inventory';
export * from './commands/duel';
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
    await interaction.deferReply();
    const result = await handleHuntCommand(interaction.user.id, interaction.user.username);

    if (!result.success) {
      const remainingMs = result.cooldownRemainingMs ?? 0;
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
      await interaction.editReply(
        `⏳ You are on hunt cooldown! Please wait **${remainingMinutes}** more minute(s).`
      );
      return;
    }

    const card = result.card!;
    const attachment = new AttachmentBuilder(result.imageBuffer!, {
      name: `card-${card.race}-${card.variant}.png`,
    });

    try {
      await upsertUser(interaction.user.id, interaction.user.username);
      await createCard({
        userId: interaction.user.id,
        race: card.race,
        variant: card.variant,
        element: card.element,
        elementTier: card.elementTier,
        evolutionStage: card.evolutionStage,
        level: card.level,
        powerScore: card.powerScore,
        seed: card.seed,
      });
    } catch (err) {
      console.warn('[DB] Failed to save card to database:', err);
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏹 Hunt Successful: ${card.variant.toUpperCase()} ${card.race.toUpperCase()}`)
      .setDescription(
        `**Element:** ${card.element} (${card.elementTier})\n` +
          `**Level:** ${card.level}\n` +
          `**Power Score:** ${card.powerScore}`
      )
      .setImage(`attachment://${attachment.name}`)
      .setColor(0x5865f2);

    await interaction.editReply({ embeds: [embed], files: [attachment] });
    return;
  }

  if (interaction.commandName === 'inventory') {
    await interaction.deferReply();
    const page = interaction.options.getInteger('page') ?? 1;

    try {
      const userRecord = await findUserById(interaction.user.id);
      const userCards = await findCardsByUserId(interaction.user.id);

      if (!userCards || userCards.length === 0) {
        await interaction.editReply('🎒 Your inventory is empty! Use `/hunt` to discover your first card.');
        return;
      }

      const lineup: UserActiveLineup = userRecord?.activeLineup ?? {
        vanguardCardId: null,
        strikerCardId: null,
        conduitCardId: null,
      };

      const { pageCards, totalPages, currentPage } = paginateCards(userCards, page, 5);

      const embed = new EmbedBuilder()
        .setTitle(`🎒 ${interaction.user.username}'s Inventory (Page ${currentPage}/${totalPages})`)
        .setDescription(
          pageCards
            .map((c, i) => {
              const tag = formatCardLineupTag(c.id, lineup);
              const tagStr = tag ? ` **${tag}**` : '';
              return (
                `**${(currentPage - 1) * 5 + i + 1}. ${c.variant.toUpperCase()} ${c.race.toUpperCase()}**${tagStr}\n` +
                `Element: ${c.element} (${c.elementTier}) | Lv.${c.level} | Power Score: ${c.powerScore}`
              );
            })
            .join('\n\n')
        )
        .setFooter({ text: `Total Cards: ${userCards.length}` })
        .setColor(0x00ff99);

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Inventory] Error querying inventory:', err);
      await interaction.editReply('❌ Failed to retrieve inventory. Please try again later.');
    }
    return;
  }

  if (interaction.commandName === 'duel') {
    const target = interaction.options.getUser('target', true);

    let challengerLineupComplete = false;
    let targetLineupComplete = false;

    try {
      const challenger = await findUserById(interaction.user.id);
      const opponent = await findUserById(target.id);

      challengerLineupComplete = isLineupComplete(challenger?.activeLineup);
      targetLineupComplete = isLineupComplete(opponent?.activeLineup);
    } catch (err) {
      console.warn('[DB] Lineup check query failed:', err);
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const defaultBaseUrl = isDev ? 'http://localhost:3000' : 'https://cjverse.me';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || defaultBaseUrl;

    const result = handleDuelCommand(
      interaction.user.id,
      target.id,
      target.bot,
      challengerLineupComplete,
      targetLineupComplete,
      baseUrl
    );

    if (!result.success) {
      await interaction.reply({
        content: `❌ **Duel Challenge Failed:** ${result.error}`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content:
        `⚔️ **DUEL CHALLENGE!**\n` +
        `<@${interaction.user.id}> has challenged <@${target.id}> to a real-time card duel!\n\n` +
        `👉 **Enter the Arena:** ${result.arenaUrl}`,
    });
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
