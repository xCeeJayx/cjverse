import { eq } from 'drizzle-orm';
import { db } from '../client';
import { users } from '../schema/users';
import { cards } from '../schema/cards';
import {
  openBoosterPack,
  BOOSTER_PACKS,
  BoosterPackType,
  GeneratedCard,
} from '@cjverse/game-logic';
import { findUserById, ensureUser } from './user-repository';

export interface PackPurchaseResult {
  success: boolean;
  packType?: BoosterPackType;
  packName?: string;
  cost?: number;
  cards?: GeneratedCard[];
  remainingCrystals?: number;
  error?: string;
}

/**
 * Validates crystal balance, deducts crystals, rolls booster pack cards,
 * and inserts newly generated cards into the database.
 */
export async function buyAndOpenBoosterPack(
  userId: string,
  packType: BoosterPackType
): Promise<PackPurchaseResult> {
  const packConfig = BOOSTER_PACKS[packType];
  if (!packConfig) {
    return {
      success: false,
      error: `Invalid booster pack type: "${packType}". Available packs: standard, elemental, ascendant.`,
    };
  }

  let user = await findUserById(userId);
  if (!user) {
    user = await ensureUser(userId, userId);
  }

  const currentCrystals = user.crystals ?? 0;
  if (currentCrystals < packConfig.cost) {
    return {
      success: false,
      error: `Insufficient crystals! "${packConfig.name}" costs 💎 ${packConfig.cost}, but you currently have 💎 ${currentCrystals}.`,
    };
  }

  // Roll booster pack cards
  const generatedCards = openBoosterPack(packType);
  const remainingCrystals = currentCrystals - packConfig.cost;

  // Deduct crystals & insert cards
  await db
    .update(users)
    .set({ crystals: remainingCrystals })
    .where(eq(users.id, userId));

  for (const card of generatedCards) {
    await db.insert(cards).values({
      id: card.id,
      userId,
      race: card.race,
      variant: card.variant,
      element: card.element,
      elementTier: card.elementTier,
      evolutionStage: card.evolutionStage,
      level: card.level,
      powerScore: card.powerScore,
      seed: card.seed,
    });
  }

  return {
    success: true,
    packType,
    packName: packConfig.name,
    cost: packConfig.cost,
    cards: generatedCards,
    remainingCrystals,
  };
}
