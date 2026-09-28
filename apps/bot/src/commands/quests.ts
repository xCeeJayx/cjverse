import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  getUserDailyQuests,
  claimQuestReward,
  DailyQuestItem,
} from '@cjverse/db';

export function renderProgressBar(current: number, target: number, length = 8): string {
  const percent = Math.min(1, Math.max(0, current / target));
  const filled = Math.round(percent * length);
  const empty = length - filled;
  return `[${'■'.repeat(filled)}${'□'.repeat(empty)}]`;
}

export async function handleQuestsCommand(userId: string): Promise<{
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const { userDailyQuests, dailyStreak } = await getUserDailyQuests(userId);

  const questLines = userDailyQuests.quests.map((q) => {
    const bar = renderProgressBar(q.current, q.target, 8);
    const status = q.claimed
      ? '✅ **Claimed**'
      : q.completed
      ? '🎁 **Ready to Claim!**'
      : '⏳ In Progress';

    return (
      `**${q.title}** — 💎 **+${q.reward} Crystals**\n` +
      `> \`${bar}\` **${q.current}/${q.target}** • ${status}`
    );
  });

  const embed = new EmbedBuilder()
    .setTitle('📜 CJVerse Daily Quests')
    .setDescription(
      `Complete your daily objectives to earn bonus crystals!\n` +
      `🔥 **Current Login Streak:** **${dailyStreak} Days**\n\n` +
      questLines.join('\n\n')
    )
    .setColor(0x06b6d4)
    .setFooter({ text: `Quests reset daily at 00:00 UTC • Today: ${userDailyQuests.lastResetDate}` });

  // Buttons for completed and unclaimed quests
  const claimable = userDailyQuests.quests.filter((q) => q.completed && !q.claimed);
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (claimable.length > 0) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const q of claimable) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`quest_claim_${q.id}`)
          .setLabel(`Claim ${q.reward} 💎 (${q.title})`)
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎁')
      );
    }
    components.push(row);
  }

  return { embed, components };
}

export async function handleQuestClaimCommand(
  userId: string,
  questId: string
): Promise<{ success: boolean; message: string; embed?: EmbedBuilder }> {
  const result = await claimQuestReward(userId, questId);

  if (!result.success || !result.quest) {
    return {
      success: false,
      message: `❌ **Quest Claim Failed:** ${result.error}`,
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('🎁 Daily Quest Reward Claimed!')
    .setDescription(
      `You completed **${result.quest.title}** and claimed **💎 ${result.crystalsAwarded} Crystals**!\n\n` +
      `💰 **New Total Crystals:** **💎 ${result.newTotalCrystals?.toLocaleString()}**`
    )
    .setColor(0x10b981);

  return {
    success: true,
    message: `Claimed +${result.crystalsAwarded} Crystals!`,
    embed,
  };
}
