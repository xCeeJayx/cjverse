import dotenv from 'dotenv';
import path from 'node:path';
import { db, users, cards, CardRecord, eq } from '@cjverse/db';
import {
  calculatePowerScore,
  getEvolutionStageName,
} from '@cjverse/game-logic';
import { resolveCardById, getCardNotFoundError } from '../services/card-resolver';
import { renderCardComposite } from '@cjverse/asset-pipeline';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export interface EvolveResult {
  success: boolean;
  error?: string;
  card?: CardRecord;
  oldStage?: number;
  newStage?: number;
  oldStageName?: string;
  newStageName?: string;
  oldPowerScore?: number;
  newPowerScore?: number;
  cost?: number;
  remainingCrystals?: number;
  imageBuffer?: Buffer;
}

export async function handleEvolveCommand(
  userId: string,
  cardIdInput: string
): Promise<EvolveResult> {
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

    // 4. Check evolution gates
    const currentStage = targetCard.evolutionStage ?? 1;
    if (currentStage >= 3) {
      return {
        success: false,
        error: 'This card is already at maximum evolution (**Stage 3 — Transcendent**)!',
      };
    }

    // Evolution requires card level 10 (Base -> Ascended) or level 20 (Ascended -> Transcendent) plus 200 crystals
    const requiredLevel = currentStage === 1 ? 10 : 20;
    const targetStageName = currentStage === 1 ? 'Ascended' : 'Transcendent';

    if (targetCard.level < requiredLevel) {
      return {
        success: false,
        error: `Evolution to **${targetStageName}** requires **Level ${requiredLevel}**, but this card is currently **Level ${targetCard.level}**. Use \`/upgrade\` to level up your card first.`,
      };
    }

    const evolveCost = 200;
    if ((user.crystals ?? 0) < evolveCost) {
      return {
        success: false,
        error: `Insufficient crystals! Evolution to **${targetStageName}** requires **200 crystals**, but you only have **${
          user.crystals ?? 0
        } crystals**.`,
      };
    }

    // 5. Apply evolution progression
    const nextStage = currentStage + 1;
    const oldPowerScore = targetCard.powerScore;
    const newPowerScore = calculatePowerScore({
      race: targetCard.race as any,
      variant: targetCard.variant as any,
      elementTier: targetCard.elementTier as any,
      evolutionStage: nextStage,
      level: targetCard.level,
    });

    const remainingCrystals = user.crystals - evolveCost;

    // 6. Update database
    await db
      .update(users)
      .set({ crystals: remainingCrystals })
      .where(eq(users.id, userId));

    const [updatedCard] = (await db
      .update(cards)
      .set({
        evolutionStage: nextStage,
        powerScore: newPowerScore,
      })
      .where(eq(cards.id, targetCard.id))
      .returning()) as CardRecord[];

    const finalCard = updatedCard || {
      ...targetCard,
      evolutionStage: nextStage,
      powerScore: newPowerScore,
    };

    // 7. Render refreshed composite card image
    let imageBuffer: Buffer | undefined;
    try {
      imageBuffer = await renderCardComposite({
        seed: finalCard.seed,
        race: finalCard.race as any,
        variant: finalCard.variant as any,
        element: finalCard.element,
        elementTier: finalCard.elementTier as any,
        evolutionStage: finalCard.evolutionStage,
        level: finalCard.level,
        powerScore: finalCard.powerScore,
      });
    } catch (err) {
      console.warn('[Evolve Command] Image generation failed:', err);
    }

    return {
      success: true,
      card: finalCard,
      oldStage: currentStage,
      newStage: nextStage,
      oldStageName: getEvolutionStageName(currentStage),
      newStageName: getEvolutionStageName(nextStage),
      oldPowerScore,
      newPowerScore,
      cost: evolveCost,
      remainingCrystals,
      imageBuffer,
    };
  } catch (err) {
    console.error('[Evolve Command Error]:', err);
    return {
      success: false,
      error: 'An unexpected database error occurred while evolving your card.',
    };
  }
}
