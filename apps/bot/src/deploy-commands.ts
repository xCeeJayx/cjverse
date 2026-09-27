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
