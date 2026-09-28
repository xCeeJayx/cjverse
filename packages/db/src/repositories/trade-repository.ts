import { eq, and, desc } from 'drizzle-orm';
import { db } from '../client';
import { trades, TradeStatus } from '../schema/trades';
import { cards } from '../schema/cards';
import { users } from '../schema/users';
import { marketListings } from '../schema/market';
import { findUserById } from './user-repository';
import { findCardById } from './card-repository';

export interface CreateTradeProposalParams {
  proposerId: string;
  targetId: string;
  proposerCardId: string;
  targetCardId: string;
}

export interface TradeDetail {
  id: string;
  proposerId: string;
  proposerUsername: string;
  targetId: string;
  targetUsername: string;
  proposerCardId: string;
  targetCardId: string;
  status: TradeStatus;
  createdAt: Date;
  proposerCard?: any;
  targetCard?: any;
}

export async function createTradeProposal(params: CreateTradeProposalParams): Promise<{
  success: boolean;
  trade?: typeof trades.$inferSelect;
  error?: string;
  proposerCardName?: string;
  targetCardName?: string;
}> {
  const { proposerId, targetId, proposerCardId, targetCardId } = params;

  if (proposerId === targetId) {
    return { success: false, error: 'You cannot trade cards with yourself.' };
  }

  // 1. Fetch both users
  const proposer = await findUserById(proposerId);
  const target = await findUserById(targetId);

  if (!proposer) {
    return { success: false, error: 'Proposer account not found.' };
  }
  if (!target) {
    return { success: false, error: 'Target trading partner account not found.' };
  }

  // 2. Fetch both cards
  const pCard = await findCardById(proposerCardId);
  const tCard = await findCardById(targetCardId);

  if (!pCard) {
    return { success: false, error: `Your card (${proposerCardId}) was not found.` };
  }
  if (pCard.userId !== proposerId) {
    return { success: false, error: `You do not own card ${proposerCardId}.` };
  }

  if (!tCard) {
    return { success: false, error: `Target user does not possess card (${targetCardId}).` };
  }
  if (tCard.userId !== targetId) {
    return { success: false, error: `Target user does not own card ${targetCardId}.` };
  }

  // 3. Validate neither card is equipped in active lineup
  const pLineup = proposer.activeLineup;
  if (
    pLineup &&
    (pLineup.vanguardCardId === proposerCardId ||
      pLineup.strikerCardId === proposerCardId ||
      pLineup.conduitCardId === proposerCardId)
  ) {
    return {
      success: false,
      error: `Your card (${proposerCardId}) is currently equipped in your active lineup. Unequip it before trading.`,
    };
  }

  const tLineup = target.activeLineup;
  if (
    tLineup &&
    (tLineup.vanguardCardId === targetCardId ||
      tLineup.strikerCardId === targetCardId ||
      tLineup.conduitCardId === targetCardId)
  ) {
    return {
      success: false,
      error: `Their card (${targetCardId}) is currently equipped in their active lineup.`,
    };
  }

  // 4. Validate neither card is actively listed on market
  const [listed] = await db
    .select()
    .from(marketListings)
    .where(
      and(
        eq(marketListings.status, 'active')
      )
    );

  const activeMarketListings = await db
    .select()
    .from(marketListings)
    .where(eq(marketListings.status, 'active'));

  if (activeMarketListings.some((m) => m.cardId === proposerCardId)) {
    return { success: false, error: 'Your card is currently listed on the marketplace.' };
  }
  if (activeMarketListings.some((m) => m.cardId === targetCardId)) {
    return { success: false, error: "Target's card is currently listed on the marketplace." };
  }

  // 5. Create trade record
  const [newTrade] = await db
    .insert(trades)
    .values({
      proposerId,
      targetId,
      proposerCardId,
      targetCardId,
      status: 'pending',
    })
    .returning();

  return {
    success: true,
    trade: newTrade,
    proposerCardName: `${pCard.variant.toUpperCase()} ${pCard.race.toUpperCase()}`,
    targetCardName: `${tCard.variant.toUpperCase()} ${tCard.race.toUpperCase()}`,
  };
}

export async function findTradeById(tradeId: string): Promise<TradeDetail | null> {
  const [trade] = await db.select().from(trades).where(eq(trades.id, tradeId)).limit(1);
  if (!trade) return null;

  const proposer = await findUserById(trade.proposerId);
  const target = await findUserById(trade.targetId);
  const pCard = await findCardById(trade.proposerCardId);
  const tCard = await findCardById(trade.targetCardId);

  return {
    id: trade.id,
    proposerId: trade.proposerId,
    proposerUsername: proposer?.username ?? 'Unknown',
    targetId: trade.targetId,
    targetUsername: target?.username ?? 'Unknown',
    proposerCardId: trade.proposerCardId,
    targetCardId: trade.targetCardId,
    status: trade.status as TradeStatus,
    createdAt: trade.createdAt,
    proposerCard: pCard,
    targetCard: tCard,
  };
}

export async function acceptTradeProposal(params: {
  tradeId: string;
  targetUserId: string;
}): Promise<{
  success: boolean;
  error?: string;
  proposerCardName?: string;
  targetCardName?: string;
  proposerId?: string;
  targetId?: string;
}> {
  const { tradeId, targetUserId } = params;

  const [trade] = await db.select().from(trades).where(eq(trades.id, tradeId)).limit(1);
  if (!trade) {
    return { success: false, error: 'Trade proposal not found.' };
  }

  if (trade.status !== 'pending') {
    return { success: false, error: `This trade proposal has already been ${trade.status}.` };
  }

  if (trade.targetId !== targetUserId) {
    return { success: false, error: 'Only the recipient of this trade proposal can accept it.' };
  }

  const pCard = await findCardById(trade.proposerCardId);
  const tCard = await findCardById(trade.targetCardId);

  if (!pCard || pCard.userId !== trade.proposerId) {
    return {
      success: false,
      error: 'Proposer no longer owns their offered card.',
    };
  }
  if (!tCard || tCard.userId !== trade.targetId) {
    return {
      success: false,
      error: 'You no longer own the requested card.',
    };
  }

  // Check lineups again
  const proposer = await findUserById(trade.proposerId);
  const target = await findUserById(trade.targetId);

  const pLineup = proposer?.activeLineup;
  if (
    pLineup &&
    (pLineup.vanguardCardId === pCard.id ||
      pLineup.strikerCardId === pCard.id ||
      pLineup.conduitCardId === pCard.id)
  ) {
    return { success: false, error: 'Offered card is currently equipped in active lineup.' };
  }

  const tLineup = target?.activeLineup;
  if (
    tLineup &&
    (tLineup.vanguardCardId === tCard.id ||
      tLineup.strikerCardId === tCard.id ||
      tLineup.conduitCardId === tCard.id)
  ) {
    return { success: false, error: 'Requested card is currently equipped in active lineup.' };
  }

  // Atomic swap
  await db.transaction(async (tx) => {
    // Proposer card goes to target
    await tx
      .update(cards)
      .set({ userId: trade.targetId })
      .where(eq(cards.id, trade.proposerCardId));

    // Target card goes to proposer
    await tx
      .update(cards)
      .set({ userId: trade.proposerId })
      .where(eq(cards.id, trade.targetCardId));

    // Mark trade accepted
    await tx
      .update(trades)
      .set({ status: 'accepted' })
      .where(eq(trades.id, tradeId));
  });

  return {
    success: true,
    proposerCardName: `${pCard.variant.toUpperCase()} ${pCard.race.toUpperCase()}`,
    targetCardName: `${tCard.variant.toUpperCase()} ${tCard.race.toUpperCase()}`,
    proposerId: trade.proposerId,
    targetId: trade.targetId,
  };
}

export async function declineTradeProposal(params: {
  tradeId: string;
  targetUserId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { tradeId, targetUserId } = params;

  const [trade] = await db.select().from(trades).where(eq(trades.id, tradeId)).limit(1);
  if (!trade) {
    return { success: false, error: 'Trade proposal not found.' };
  }

  if (trade.status !== 'pending') {
    return { success: false, error: `This trade proposal has already been ${trade.status}.` };
  }

  if (trade.targetId !== targetUserId && trade.proposerId !== targetUserId) {
    return { success: false, error: 'You are not a participant in this trade.' };
  }

  await db
    .update(trades)
    .set({ status: 'declined' })
    .where(eq(trades.id, tradeId));

  return { success: true };
}
