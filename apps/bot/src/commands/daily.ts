import { EmbedBuilder } from 'discord.js';
import { claimDailyReward } from '@cjverse/db';

export async function handleDailyCommand(userId: string): Promise<{
  success: boolean;
  onCooldown?: boolean;
  embed: EmbedBuilder;
}> {
  const result = await claimDailyReward(userId);

  if (result.onCooldown) {
    const embed = new EmbedBuilder()
      .setTitle('⏳ Daily Reward Cooldown')
      .setDescription(
        `You have already claimed your daily crystals!\n\n` +
        `⏰ **Next Claim Available:** in **${result.remainingHours}h ${result.remainingMinutes}m**\n` +
        `🔥 **Current Streak:** **${result.streak} Days**\n\n` +
        `*Come back after 20 hours to keep your login streak alive!*`
      )
      .setColor(0x64748b);

    return { success: false, onCooldown: true, embed };
  }

  if (!result.success) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Daily Claim Failed')
      .setDescription(result.error || 'Failed to claim daily reward. Please try again.')
      .setColor(0xef4444);

    return { success: false, embed };
  }

  const embed = new EmbedBuilder()
    .setTitle('🔥 Daily Login Reward Claimed!')
    .setDescription(
      `Congratulations! You received **💎 ${result.crystalsAwarded} Crystals**!\n\n` +
      `**Reward Breakdown:**\n` +
      `• Base Reward: **100 Crystals**\n` +
      `• Streak Bonus (+${result.streakBonus} 💎): **${result.streak} Day Streak** 🔥\n\n` +
      `💰 **Total Crystals:** **💎 ${result.newTotalCrystals?.toLocaleString()}**`
    )
    .setColor(0xf59e0b)
    .setFooter({
      text: `Daily Streak: ${result.streak} Days • Claim again in 20 hours!`,
    });

  return { success: true, embed };
}
