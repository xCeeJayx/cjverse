import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
import path from 'node:path';

// Load environment variables from apps/bot/.env and root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const commands = [
  new SlashCommandBuilder()
    .setName('hunt')
    .setDescription('Hunt for a wild card in CJVerse (30m cooldown)'),
  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your card collection and active lineup')
    .addIntegerOption((opt) =>
      opt.setName('page').setDescription('Page number to display').setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Challenge another player to a real-time card duel')
    .addUserOption((opt) =>
      opt.setName('target').setDescription('The opponent you want to challenge').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('equip')
    .setDescription('Equip a card to your active duel lineup (vanguard, striker, conduit)')
    .addStringOption((opt) =>
      opt
        .setName('slot')
        .setDescription('Lineup slot to assign')
        .setRequired(true)
        .addChoices(
          { name: 'Vanguard', value: 'vanguard' },
          { name: 'Striker', value: 'striker' },
          { name: 'Conduit', value: 'conduit' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('card_id')
        .setDescription('Card ID or first 4-8 characters of UUID')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('duel-bot')
    .setDescription('Practice a 3v3 duel against an AI bot with instant arena access'),
  new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('Upgrade a card level using crystals (cost: level * 25 crystals)')
    .addStringOption((opt) =>
      opt
        .setName('card_id')
        .setDescription('Card ID or first 4-8 characters of UUID')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('evolve')
    .setDescription('Evolve a card (Stage 1 -> 2 at Lv.10, Stage 2 -> 3 at Lv.20; cost: 200 crystals)')
    .addStringOption((opt) =>
      opt
        .setName('card_id')
        .setDescription('Card ID or first 4-8 characters of UUID')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View top CJVerse duelists by rating or crystal wealth')
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Rank by Elo rating or crystals')
        .setRequired(false)
        .addChoices(
          { name: 'Rating (MMR)', value: 'rating' },
          { name: 'Crystals', value: 'crystals' }
        )
    ),
  new SlashCommandBuilder()
    .setName('market')
    .setDescription('Browse, list, or purchase cards on the global marketplace')
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List a card for sale on the marketplace')
        .addStringOption((opt) =>
          opt.setName('card_id').setDescription('The 6-character ID of the card to sell').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('price').setDescription('Price in crystals').setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('browse')
        .setDescription('Browse active card listings on the marketplace')
        .addIntegerOption((opt) =>
          opt.setName('page').setDescription('Page number to browse').setRequired(false).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('buy')
        .setDescription('Purchase a card listing with crystals')
        .addStringOption((opt) =>
          opt.setName('listing_id').setDescription('The 8-character ID of the market listing').setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Propose a direct card swap with another player')
    .addUserOption((opt) =>
      opt.setName('target').setDescription('The player you want to trade with').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('your_card_id').setDescription('The ID of your card offered in trade').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('their_card_id').setDescription('The ID of the card you want from them').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily crystal reward and maintain your login streak'),
  new SlashCommandBuilder()
    .setName('quests')
    .setDescription('View and claim your daily quests')
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View your active daily quests and progress')
    )
    .addSubcommand((sub) =>
      sub
        .setName('claim')
        .setDescription('Claim the crystal reward for a completed daily quest')
        .addStringOption((opt) =>
          opt
            .setName('quest_id')
            .setDescription('The ID of the quest to claim')
            .setRequired(true)
            .addChoices(
              { name: 'Hunt 2 Cards (50 Crystals)', value: 'hunt_cards' },
              { name: 'Win 1 Arena Duel (75 Crystals)', value: 'win_duel' },
              { name: 'Upgrade Any Card (60 Crystals)', value: 'upgrade_card' }
            )
        )
    ),
  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse booster packs and purchase them with crystals'),
  new SlashCommandBuilder()
    .setName('pack')
    .setDescription('Buy and open booster packs to summon new cards')
    .addSubcommand((sub) =>
      sub
        .setName('buy')
        .setDescription('Purchase and immediately crack a booster pack')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Booster pack type')
            .setRequired(true)
            .addChoices(
              { name: 'Standard Pack (150 💎 - 3 Cards)', value: 'standard' },
              { name: 'Elemental Hoard (350 💎 - 3 Cards, Guaranteed Silver+)', value: 'elemental' },
              { name: 'Ascendant Vault (750 💎 - 4 Cards, Guaranteed Gold+)', value: 'ascendant' }
            )
        )
    ),
  new SlashCommandBuilder()
    .setName('boss')
    .setDescription('Server-wide Co-op World Boss Raid')
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('View active World Boss status, HP bar, weaknesses, and top contributors')
    )
    .addSubcommand((sub) =>
      sub
        .setName('fight')
        .setDescription('Verify lineup and enter the live World Boss raid arena (3 attempts / 12h)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('spawn')
        .setDescription('Force spawn a new World Boss (Admin only)')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Specific World Boss preset')
            .setRequired(false)
            .addChoices(
              { name: 'Abyssal Leviathan (Void)', value: 'Abyssal Leviathan' },
              { name: 'Infernal Behemoth (Fire)', value: 'Infernal Behemoth' },
              { name: 'Glacial Titan (Ice)', value: 'Glacial Titan' },
              { name: 'Storm Tempest (Lightning)', value: 'Storm Tempest' }
            )
        )
    ),
  new SlashCommandBuilder()
    .setName('salvage')
    .setDescription('Disenchant cards into Arcane Dust and Crystals in the Arcane Forge')
    .addSubcommand((sub) =>
      sub
        .setName('single')
        .setDescription('Dismantle a single unequipped, unlisted card')
        .addStringOption((opt) =>
          opt
            .setName('card_id')
            .setDescription('Card ID to salvage')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('bulk')
        .setDescription('Dismantle all unequipped, unlisted cards of a rarity tier')
        .addStringOption((opt) =>
          opt
            .setName('rarity')
            .setDescription('Rarity tier to bulk dismantle')
            .setRequired(true)
            .addChoices(
              { name: 'Normal (15 Dust + 10 Crystals)', value: 'normal' },
              { name: 'Silver (50 Dust + 35 Crystals)', value: 'silver' },
              { name: 'Gold (175 Dust + 100 Crystals)', value: 'gold' },
              { name: 'Diamond (600 Dust + 350 Crystals)', value: 'diamond' }
            )
        )
    ),
  new SlashCommandBuilder()
    .setName('fuse')
    .setDescription('Synthesize 3 cards of the exact same variant tier into a higher-tier card')
    .addStringOption((opt) =>
      opt
        .setName('card1_id')
        .setDescription('First sacrifice card ID')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('card2_id')
        .setDescription('Second sacrifice card ID')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('card3_id')
        .setDescription('Third sacrifice card ID')
        .setRequired(true)
    ),
].map((cmd) => cmd.toJSON());

export async function deployCommands(): Promise<unknown> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    throw new Error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment variables.');
  }

  const rest = new REST({ version: '10' }).setToken(token);

  console.log(`[Slash Commands] Refreshing ${commands.length} application (/) commands...`);

  let response: unknown;
  if (guildId && guildId.trim().length > 0) {
    console.log('[Slash Commands] Purging duplicate global application (/) commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: [] });

    console.log(`[Slash Commands] Registering to Guild ID: ${guildId}`);
    response = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
  } else {
    console.log('[Slash Commands] Registering globally to Discord...');
    response = await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });
  }

  console.log(
    `[Slash Commands] Successfully registered ${
      Array.isArray(response) ? response.length : 'all'
    } commands.`
  );
  return response;
}

// Auto-run if executed as script directly
if (
  process.env.NODE_ENV !== 'test' &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').includes('deploy-commands')
) {
  deployCommands().catch((err) => {
    console.error('[Slash Commands] Deployment failed:', err);
    process.exit(1);
  });
}
