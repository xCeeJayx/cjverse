import dotenv from 'dotenv';
import path from 'node:path';
import { generateCardFromSeed, CardEntity } from '@cjverse/game-logic';
import { renderCardComposite } from '@cjverse/asset-pipeline';
import { db, users, cards, CardRecord } from '@cjverse/db';
import { eq } from 'drizzle-orm';
import { checkAndSetCooldown, resetCooldowns } from '../services/cooldown';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export { resetCooldowns };

export interface HuntResult {
  success: boolean;
  card?: CardEntity | CardRecord;
  imageBuffer?: Buffer;
  cooldownRemainingMs?: number;
}

export async function handleHuntCommand(userId: string, username: string): Promise<HuntResult> {
  const cd = checkAndSetCooldown(userId);
  if (!cd.allowed) {
    return {
      success: false,
      cooldownRemainingMs: cd.remainingMs,
    };
  }

  // 1. Ensure user exists in users table
  try {
    const existingUsers = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existingUsers || existingUsers.length === 0) {
      await db
        .insert(users)
        .values({
          id: userId,
          username,
          crystals: 100,
          activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
        })
        .onConflictDoNothing();
    }
  } catch (err) {
    console.error('[Hunt Command Error - Ensure User]:', err);
  }

  // 2. Generate procedural card from random seed
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const card = generateCardFromSeed(seed);

  // 3. Insert card into PostgreSQL database
  let savedCard: CardEntity | CardRecord = card;
  try {
    const [persistedCard] = await db
      .insert(cards)
      .values({
        userId,
        race: card.race,
        variant: card.variant,
        element: card.element,
        elementTier: card.elementTier,
        evolutionStage: card.evolutionStage,
        level: card.level,
        powerScore: card.powerScore,
        seed: card.seed,
      })
      .returning();

    if (persistedCard) {
      savedCard = persistedCard;
    }
  } catch (err) {
    console.error('[Hunt Command Error - Insert Card]:', err);
  }

  // 4. Pass persisted card to renderCardComposite
  const imageBuffer = await renderCardComposite(savedCard as CardEntity);

  return {
    success: true,
    card: savedCard,
    imageBuffer,
  };
}
