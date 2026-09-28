import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  createTradeProposal,
  acceptTradeProposal,
  declineTradeProposal,
  findTradeById,
} from '@cjverse/db';

import { cleanCardId } from './market';

export async function handleTradePropose(params: {
  proposerId: string;
  targetId: string;
  rawProposerCardId: string;
  rawTargetCardId: string;
}): Promise<{
  success: boolean;
  message?: string;
  embed?: EmbedBuilder;
  components?: ActionRowBuilder<ButtonBuilder>[];
}> {
  const { proposerId, targetId, rawProposerCardId, rawTargetCardId } = params;

  if (proposerId === targetId) {
    return {
      success: false,
      message: '❌ **Trade Proposal Failed:** You cannot propose a trade with yourself.',
    };
  }

  const proposerCardId = cleanCardId(rawProposerCardId);
  const targetCardId = cleanCardId(rawTargetCardId);

  const result = await createTradeProposal({
    proposerId,
    targetId,
    proposerCardId,
    targetCardId,
  });

  if (!result.success || !result.trade) {
    return {
      success: false,
      message: `❌ **Trade Proposal Failed:** ${result.error}`,
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('🤝 Card Trade Proposal')
    .setDescription(
      `<@${proposerId}> has proposed a card swap with <@${targetId}>!\n\n` +
      `📤 **Offered by <@${proposerId}>:**\n` +
      `> **${result.proposerCardName}** (\`${proposerCardId}\`)\n\n` +
      `📥 **Requested from <@${targetId}>:**\n` +
      `> **${result.targetCardName}** (\`${targetCardId}\`)\n\n` +
      `⚠️ *Both cards will be instantly transferred upon acceptance. Only <@${targetId}> can accept or decline this offer.*`
    )
    .setColor(0x3b82f6)
    .setFooter({ text: `Trade ID: ${result.trade.id}` });

  const acceptBtn = new ButtonBuilder()
    .setCustomId(`trade_accept_${result.trade.id}`)
    .setLabel('Accept Trade')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const declineBtn = new ButtonBuilder()
    .setCustomId(`trade_decline_${result.trade.id}`)
    .setLabel('Decline')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, declineBtn);

  return {
    success: true,
    embed,
    components: [row],
  };
}

export async function handleTradeAccept(
  tradeId: string,
  targetUserId: string
): Promise<{
  success: boolean;
  message: string;
  embed?: EmbedBuilder;
}> {
  const result = await acceptTradeProposal({
    tradeId,
    targetUserId,
  });

  if (!result.success) {
    return {
      success: false,
      message: `❌ **Trade Failed:** ${result.error}`,
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Card Trade Completed!')
    .setDescription(
      `The trade was accepted! Ownership of both cards has been transferred.\n\n` +
      `🔄 **<@${result.targetId}>** received **${result.proposerCardName}**\n` +
      `🔄 **<@${result.proposerId}>** received **${result.targetCardName}**`
    )
    .setColor(0x10b981)
    .setFooter({ text: `Trade ID: ${tradeId} • Completed` });

  return {
    success: true,
    message: 'Trade accepted successfully.',
    embed,
  };
}

export async function handleTradeDecline(
  tradeId: string,
  targetUserId: string
): Promise<{
  success: boolean;
  message: string;
  embed?: EmbedBuilder;
}> {
  const result = await declineTradeProposal({
    tradeId,
    targetUserId,
  });

  if (!result.success) {
    return {
      success: false,
      message: `❌ **Failed to decline trade:** ${result.error}`,
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('❌ Trade Proposal Declined')
    .setDescription(`This trade proposal was declined by <@${targetUserId}>.`)
    .setColor(0xef4444)
    .setFooter({ text: `Trade ID: ${tradeId} • Declined` });

  return {
    success: true,
    message: 'Trade declined.',
    embed,
  };
}
