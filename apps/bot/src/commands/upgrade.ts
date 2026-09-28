import dotenv from 'dotenv';
import path from 'node:path';
import { db, users, cards, CardRecord, eq, recordQuestProgress } from '@cjverse/db';
import {
  calculateStats,
  calculatePowerScore,
} from '@cjverse/game-logic';
import { renderCardComposite } from '@cjverse/asset-pipeline';
import { resolveCardById, getCardNotFoundError } from '../services/card-resolver';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export interface UpgradeResult {
  success: boolean;
  error?: string;
  card?: CardRecord;
  oldLevel?: number;
  newLevel?: number;
  oldPowerScore?: number;
  newPowerScore?: number;
  cost?: number;
  remainingCrystals?: number;
  oldStats?: { maxHp: number; atk: number; def: number; spd: number; maxMana: number };
  newStats?: { maxHp: number; atk: number; def: number; spd: number; maxMana: number };
  imageBuffer?: Buffer;
}

export async function handleUpgradeCommand(
  userId: string,
  cardIdInput: string
): Promise<UpgradeResult> {
  try {
    // 1. Fetch user record
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return {
        success: false,
        error: 'You are not registered in the database yet. Use `/hunt` to discover your first card!',
      };
    }

    // 2. Fetch cards owned by user
    const userCards = (await db
      .select()
      .from(cards)
      .where(eq(cards.userId, userId))) as CardRecord[];

    if (!userCards || userCards.length === 0) {
      return {
        success: false,
        error: 'You do not own any cards yet! Use `/hunt` to discover a card first.',
      };
    }

    // 3. Find card by sanitized case-insensitive match
    const targetCard = resolveCardById(userCards, cardIdInput);

    if (!targetCard) {
      return {
        success: false,
        error: getCardNotFoundError(cardIdInput),
      };
    }

    // 4. Verify crystals (cost formula: card.level * 25 crystals)
    const cost = targetCard.level * 25;
    if ((user.crystals ?? 0) < cost) {
      return {
        success: false,
        error: `Insufficient crystals! Upgrading from Level ${targetCard.level} to ${
          targetCard.level + 1
        } requires **${cost} crystals**, but you only have **${
          user.crystals ?? 0
        } crystals**.`,
      };
    }

    // 5. Calculate new level, stats, and power score
    const oldLevel = targetCard.level;
    const newLevel = oldLevel + 1;
    const oldStats = calculateStats(targetCard as any);
    const oldPowerScore = targetCard.powerScore;

    const newPowerScore = calculatePowerScore({
      race: targetCard.race as any,
      variant: targetCard.variant as any,
      elementTier: targetCard.elementTier as any,
      evolutionStage: targetCard.evolutionStage,
      level: newLevel,
    });

    const newStats = calculateStats({
      ...targetCard,
      level: newLevel,
      powerScore: newPowerScore,
    } as any);

    // 6. Deduct crystals from users.crystals and update cards table
    const remainingCrystals = user.crystals - cost;
    await db
      .update(users)
      .set({ crystals: remainingCrystals })
      .where(eq(users.id, userId));

    const [updatedCard] = (await db
      .update(cards)
      .set({
        level: newLevel,
        powerScore: newPowerScore,
      })
      .where(eq(cards.id, targetCard.id))
      .returning()) as CardRecord[];

    // Quest Progression Hook: Upgrade Card
    try {
      await recordQuestProgress(userId, 'upgrade_card', 1);
    } catch (questErr) {
      console.warn('[Upgrade Command] Failed to update upgrade_card quest progress:', questErr);
    }

    const finalCard = updatedCard || {
      ...targetCard,
      level: newLevel,
      powerScore: newPowerScore,
    };

    // Render composite card image
    let imageBuffer: Buffer | undefined;
    try {
      imageBuffer = await renderCardComposite(finalCard as any);
    } catch (err) {
      console.warn('[Upgrade Command] Failed to render composite:', err);
    }

    return {
      success: true,
      card: finalCard,
      oldLevel,
      newLevel,
      oldPowerScore,
      newPowerScore,
      cost,
      remainingCrystals,
      oldStats,
      newStats,
      imageBuffer,
    };
  } catch (err) {
    console.error('[Upgrade Command Error]:', err);
    return {
      success: false,
      error: 'An unexpected database error occurred while upgrading your card.',
    };
  }
}
