import { eq, inArray, and, sql } from 'drizzle-orm';
import { db } from '../client';
import { users, cards, marketListings } from '../schema';
import { findUserById, ensureUser } from './user-repository';
import {
  calculateSalvageYield,
  validateFusionCards,
  fuseCards,
  SalvageReward,
} from '@cjverse/game-logic';

export interface SalvageResult {
  success: boolean;
  error?: string;
  count?: number;
  arcaneDustGained?: number;
  crystalsGained?: number;
  deletedCardIds?: string[];
  newBalance?: {
    arcaneDust: number;
    crystals: number;
  };
}

export interface FusionResult {
  success: boolean;
  error?: string;
  fusedCard?: typeof cards.$inferSelect;
  sacrificeCards?: (typeof cards.$inferSelect)[];
}

/**
 * Checks whether any card in the given IDs is equipped in user's active lineup or listed on market.
 */
async function checkLocks(
  userId: string,
  cardIds: string[]
): Promise<{ hasLocked: boolean; reason?: string }> {
  const user = await findUserById(userId);
  if (!user) {
    return { hasLocked: true, reason: 'User not found.' };
  }

  const lineup = user.activeLineup;
  const equippedIds = new Set(
    [lineup?.vanguardCardId, lineup?.strikerCardId, lineup?.conduitCardId].filter(
      Boolean
    ) as string[]
  );

  for (const id of cardIds) {
    if (equippedIds.has(id)) {
      return {
        hasLocked: true,
        reason: `Card ${id} is currently equipped in your active lineup. Unequip it before salvaging or fusing.`,
      };
    }
  }

  const activeListings = await db
    .select({ cardId: marketListings.cardId })
    .from(marketListings)
    .where(
      and(
        inArray(marketListings.cardId, cardIds),
        eq(marketListings.status, 'active')
      )
    );

  if (activeListings.length > 0) {
    return {
      hasLocked: true,
      reason: `Card ${activeListings[0].cardId} is currently listed on the marketplace. Cancel listing before salvaging or fusing.`,
    };
  }

  return { hasLocked: false };
}

/**
 * Salvages specific card IDs belonging to user, granting Arcane Dust and Crystals.
 */
export async function salvageCards(
  userId: string,
  cardIds: string[]
): Promise<SalvageResult> {
  if (!cardIds || cardIds.length === 0) {
    return { success: false, error: 'No cards specified for salvaging.' };
  }

  const user = await findUserById(userId);
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  // Deduplicate IDs
  const uniqueCardIds = Array.from(new Set(cardIds));

  // Fetch cards
  const userCards = await db
    .select()
    .from(cards)
    .where(and(eq(cards.userId, userId), inArray(cards.id, uniqueCardIds)));

  if (userCards.length !== uniqueCardIds.length) {
    return {
      success: false,
      error: 'One or more cards could not be found or do not belong to you.',
    };
  }

  // Check lineup & marketplace locks
  const lockCheck = await checkLocks(userId, uniqueCardIds);
  if (lockCheck.hasLocked) {
    return { success: false, error: lockCheck.reason };
  }

  // Calculate yield
  const yieldResult = calculateSalvageYield(userCards);

  // Execute deletion & credit dust/crystals in transaction
  const [updatedUser] = await db.transaction(async (tx) => {
    await tx.delete(cards).where(inArray(cards.id, uniqueCardIds));

    return tx
      .update(users)
      .set({
        arcaneDust: sql`${users.arcaneDust} + ${yieldResult.arcaneDust}`,
        crystals: sql`${users.crystals} + ${yieldResult.crystals}`,
      })
      .where(eq(users.id, userId))
      .returning();
  });

  return {
    success: true,
    count: uniqueCardIds.length,
    arcaneDustGained: yieldResult.arcaneDust,
    crystalsGained: yieldResult.crystals,
    deletedCardIds: uniqueCardIds,
    newBalance: {
      arcaneDust: updatedUser.arcaneDust,
      crystals: updatedUser.crystals,
    },
  };
}

/**
 * Salvages all unequipped, unlisted cards of a given rarity tier belonging to user.
 */
export async function salvageCardsByRarity(
  userId: string,
  variant: string
): Promise<SalvageResult> {
  const user = await findUserById(userId);
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const normalizedVariant = variant.toLowerCase().trim();

  // Fetch all cards of this variant for the user
  const allVariantCards = await db
    .select()
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.variant, normalizedVariant)));

  if (allVariantCards.length === 0) {
    return {
      success: false,
      error: `No cards of rarity tier '${variant}' found in your inventory.`,
    };
  }

  // Filter out equipped cards
  const lineup = user.activeLineup;
  const equippedIds = new Set(
    [lineup?.vanguardCardId, lineup?.strikerCardId, lineup?.conduitCardId].filter(
      Boolean
    ) as string[]
  );

  // Filter out listed cards
  const allCardIds = allVariantCards.map((c) => c.id);
  const activeListings = await db
    .select({ cardId: marketListings.cardId })
    .from(marketListings)
    .where(
      and(
        inArray(marketListings.cardId, allCardIds),
        eq(marketListings.status, 'active')
      )
    );
  const listedIds = new Set(activeListings.map((l) => l.cardId));

  const eligibleCards = allVariantCards.filter(
    (c) => !equippedIds.has(c.id) && !listedIds.has(c.id)
  );

  if (eligibleCards.length === 0) {
    return {
      success: false,
      error: `All ${variant} cards are currently equipped in your active lineup or listed on the market.`,
    };
  }

  const eligibleCardIds = eligibleCards.map((c) => c.id);
  const yieldResult = calculateSalvageYield(eligibleCards);

  const [updatedUser] = await db.transaction(async (tx) => {
    await tx.delete(cards).where(inArray(cards.id, eligibleCardIds));

    return tx
      .update(users)
      .set({
        arcaneDust: sql`${users.arcaneDust} + ${yieldResult.arcaneDust}`,
        crystals: sql`${users.crystals} + ${yieldResult.crystals}`,
      })
      .where(eq(users.id, userId))
      .returning();
  });

  return {
    success: true,
    count: eligibleCards.length,
    arcaneDustGained: yieldResult.arcaneDust,
    crystalsGained: yieldResult.crystals,
    deletedCardIds: eligibleCardIds,
    newBalance: {
      arcaneDust: updatedUser.arcaneDust,
      crystals: updatedUser.crystals,
    },
  };
}

/**
 * Fuses 3 cards of the exact same variant tier into a higher tier card.
 */
export async function fuseThreeCards(
  userId: string,
  cardIds: [string, string, string]
): Promise<FusionResult> {
  const user = await findUserById(userId);
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  if (!cardIds || cardIds.length !== 3) {
    return { success: false, error: 'Fusion requires exactly 3 cards.' };
  }

  const uniqueIds = Array.from(new Set(cardIds));
  if (uniqueIds.length !== 3) {
    return { success: false, error: 'Cannot fuse duplicate cards.' };
  }

  // Fetch sacrifice cards
  const sacrificeCards = await db
    .select()
    .from(cards)
    .where(and(eq(cards.userId, userId), inArray(cards.id, uniqueIds)));

  if (sacrificeCards.length !== 3) {
    return {
      success: false,
      error: 'One or more sacrifice cards could not be found or do not belong to you.',
    };
  }

  // Check lineup & marketplace locks
  const lockCheck = await checkLocks(userId, uniqueIds);
  if (lockCheck.hasLocked) {
    return { success: false, error: lockCheck.reason };
  }

  // Validate fusion rules
  const validation = validateFusionCards(sacrificeCards);
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  // Generate newly synthesized card
  const newCardEntity = fuseCards(sacrificeCards);

  // In a transaction: delete 3 sacrifice cards and insert new card
  const [fusedCard] = await db.transaction(async (tx) => {
    await tx.delete(cards).where(inArray(cards.id, uniqueIds));

    return tx
      .insert(cards)
      .values({
        id: newCardEntity.id!,
        userId,
        race: newCardEntity.race,
        variant: newCardEntity.variant,
        element: newCardEntity.element,
        elementTier: newCardEntity.elementTier,
        evolutionStage: newCardEntity.evolutionStage,
        level: newCardEntity.level,
        powerScore: newCardEntity.powerScore,
        seed: newCardEntity.seed,
      })
      .returning();
  });

  return {
    success: true,
    fusedCard,
    sacrificeCards,
  };
}
