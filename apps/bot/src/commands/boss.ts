import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  getActiveWorldBoss,
  findWorldBossById,
  spawnWorldBoss,
  getBossContributors,
  checkUserRaidEligibility,
  WorldBoss,
} from '@cjverse/db';
import {
  formatBossHpBar,
  WORLD_BOSS_PRESETS,
} from '@cjverse/game-logic';

export function getBossColor(element: string): number {
  switch (element.toLowerCase()) {
    case 'fire':
      return 0xef4444; // Crimson
    case 'ice':
    case 'water':
      return 0x38bdf8; // Sky Cyan
    case 'lightning':
      return 0xeab308; // Amber / Gold
    case 'void':
      return 0x8b5cf6; // Purple
    case 'shadow':
      return 0x475569; // Slate
    case 'arcane':
    case 'light':
      return 0xc084fc; // Violet
    default:
      return 0xa855f7;
  }
}

export function getBossWeaknesses(element: string): string {
  const elem = element.toLowerCase();
  if (elem === 'fire') return '💧 Water, ❄️ Ice';
  if (elem === 'ice') return '🔥 Fire, 💥 Chaos';
  if (elem === 'void') return '🔮 Arcane, ✨ Light';
  if (elem === 'lightning') return '⛰️ Earth, 💎 Crystal';
  if (elem === 'water') return '⚡ Lightning, 🌿 Nature';
  return 'None';
}

/**
 * Handles `/boss status` subcommand
 */
export async function handleBossStatusCommand(bossId?: string): Promise<{
  success: boolean;
  embed: EmbedBuilder;
}> {
  const boss = bossId
    ? (await findWorldBossById(bossId)) || (await getActiveWorldBoss())
    : await getActiveWorldBoss();
  const contributors = await getBossContributors(boss.id, 5);

  const hpBar = formatBossHpBar(boss.currentHp, boss.totalHp, 16);
  const color = getBossColor(boss.element);
  const weaknesses = getBossWeaknesses(boss.element);

  const timeRemainingStr = boss.expiresAt
    ? `<t:${Math.floor(new Date(boss.expiresAt).getTime() / 1000)}:R>`
    : 'Ongoing Event';

  // Format top 5 contributors
  let topRankings = '*No duelists have attacked this boss yet. Be the first to strike!*';
  if (contributors.length > 0) {
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    topRankings = contributors
      .map(
        (c, idx) =>
          `${medals[idx] || '▫️'} **${c.username}** — \`${c.totalDamage.toLocaleString()} DMG\` (${c.attemptsCount} ${
            c.attemptsCount === 1 ? 'run' : 'runs'
          })`
      )
      .join('\n');
  }

  const preset = WORLD_BOSS_PRESETS.find(
    (p) => p.name.toLowerCase() === boss.name.toLowerCase()
  );
  const icon = preset?.icon || '💀';

  const embed = new EmbedBuilder()
    .setTitle(`${icon} World Boss Raid: ${boss.name}`)
    .setDescription(
      `${preset?.description || 'A colossal entity threatening the entire CJVerse realm!'}\n\n` +
      `**Status:** \`${boss.status.toUpperCase()}\` | **Element:** \`${boss.element.toUpperCase()}\`\n` +
      `**Time Remaining:** ${timeRemainingStr}\n` +
      `**Elemental Weaknesses:** ${weaknesses}\n\n` +
      `**Raid Boss Health:**\n${hpBar}`
    )
    .addFields({
      name: '🏆 Top 5 Damage Contributors',
      value: topRankings,
    })
    .setFooter({
      text: 'Limit: 3 Raid Attempts per 12 hours | Use /boss fight to enter the raid!',
    })
    .setColor(color);

  return { success: true, embed };
}

/**
 * Handles `/boss fight` subcommand
 */
export async function handleBossFightCommand(
  userId: string,
  bossId?: string
): Promise<{
  success: boolean;
  message?: string;
  embed?: EmbedBuilder;
  components?: ActionRowBuilder<ButtonBuilder>[];
}> {
  const boss = bossId
    ? (await findWorldBossById(bossId)) || (await getActiveWorldBoss())
    : await getActiveWorldBoss();

  if (boss.status !== 'active') {
    return {
      success: false,
      message: `❌ **Cannot Enter Raid:** ${boss.name} is currently **${boss.status}**. Check back when a new boss spawns!`,
    };
  }

  const eligibility = await checkUserRaidEligibility(boss.id, userId);

  if (!eligibility.canFight) {
    return {
      success: false,
      message: `❌ **Raid Entry Denied:** ${eligibility.reason}`,
    };
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BASE_URL ||
    'http://localhost:3000';
  const raidUrl = `${baseUrl}/boss/${boss.id}?as=${userId}`;

  const preset = WORLD_BOSS_PRESETS.find(
    (p) => p.name.toLowerCase() === boss.name.toLowerCase()
  );
  const icon = preset?.icon || '💀';

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Enter Raid Arena: ${icon} ${boss.name}`)
    .setDescription(
      `Your active lineup has been verified for the Co-op World Boss Raid!\n\n` +
      `**Boss:** \`${boss.name}\` (${boss.element.toUpperCase()})\n` +
      `**Current HP:** \`${boss.currentHp.toLocaleString()} / ${boss.totalHp.toLocaleString()}\`\n` +
      `**Raid Attempts Remaining:** **${eligibility.attemptsRemaining} / ${eligibility.maxAttempts}** (Resets every 12h)\n\n` +
      `Click the button below to launch the **Live Web Raid Arena** and contribute your damage!`
    )
    .setColor(getBossColor(boss.element));

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Enter Raid Arena')
      .setStyle(ButtonStyle.Link)
      .setURL(raidUrl)
      .setEmoji('⚔️')
  );

  return {
    success: true,
    embed,
    components: [row],
  };
}

/**
 * Handles `/boss spawn` (Admin-only subcommand)
 */
export async function handleBossSpawnCommand(
  userId: string,
  presetName?: string
): Promise<{
  success: boolean;
  message?: string;
  embed?: EmbedBuilder;
}> {
  try {
    const newBoss = await spawnWorldBoss(presetName);

    const embed = new EmbedBuilder()
      .setTitle(`🚨 A New World Boss Has Awakened!`)
      .setDescription(
        `**${newBoss.name}** has emerged into the CJVerse realm!\n\n` +
        `**Element:** \`${newBoss.element.toUpperCase()}\`\n` +
        `**Total Health:** \`${newBoss.totalHp.toLocaleString()} HP\`\n` +
        `**Duration:** \`24 Hours\`\n\n` +
        `All duelists are summoned to rally their teams and strike down this terror with \`/boss fight\`!`
      )
      .setColor(getBossColor(newBoss.element));

    return {
      success: true,
      embed,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `❌ Failed to spawn World Boss: ${err.message}`,
    };
  }
}
