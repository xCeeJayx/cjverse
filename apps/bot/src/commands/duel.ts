import dotenv from 'dotenv';
import path from 'node:path';
import { db, users, cards, matchRooms, UserActiveLineup, CardRecord, eq } from '@cjverse/db';
import { generateCardFromSeed, generateCardId } from '@cjverse/game-logic';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export interface DuelResult {
  success: boolean;
  roomId?: string;
  arenaUrl?: string;
  error?: string;
}

export function handleDuelCommand(
  challengerId: string,
  targetId: string,
  isTargetBot: boolean,
  challengerLineupComplete: boolean,
  targetLineupComplete: boolean,
  baseUrl?: string
): DuelResult;
export function handleDuelCommand(
  challengerId: string,
  targetId: string,
  isTargetBot: boolean,
  baseUrl?: string
): Promise<DuelResult>;
export function handleDuelCommand(
  challengerId: string,
  targetId: string,
  isTargetBot: boolean,
  arg4?: boolean | string,
  arg5?: boolean,
  arg6?: string
): DuelResult | Promise<DuelResult> {
  // 1. Validate opponent is not self and not a bot
  if (challengerId === targetId) {
    return {
      success: false,
      error: 'Challenger and opponent must be distinct users.',
    };
  }

  if (isTargetBot) {
    return {
      success: false,
      error: 'Cannot challenge a bot to a duel.',
    };
  }

  // Synchronous overload branch (for fast unit testing or provided flags)
  if (typeof arg4 === 'boolean') {
    const challengerLineupComplete = arg4;
    const targetLineupComplete = Boolean(arg5);
    const customBase =
      typeof arg6 === 'string'
        ? arg6
        : 'https://cjverse.me';

    if (!challengerLineupComplete) {
      return {
        success: false,
        error: 'You must have all 3 cards in active lineup before dueling.',
      };
    }

    if (!targetLineupComplete) {
      return {
        success: false,
        error: 'Opponent must have all 3 cards in active lineup before dueling.',
      };
    }

    const roomId = Math.random().toString(36).substring(2, 10);
    const cleanBase = customBase.replace(/\/+$/, '');
    const arenaUrl = `${cleanBase}/duel/${roomId}`;

    // Background insert into match_rooms
    db.insert(matchRooms)
      .values({
        id: roomId,
        player1Id: challengerId,
        player2Id: targetId,
        status: 'WAITING',
      })
      .catch(() => {});

    return {
      success: true,
      roomId,
      arenaUrl,
    };
  }

  // Async database-backed branch
  const baseUrlParam = typeof arg4 === 'string' ? arg4 : undefined;
  return (async (): Promise<DuelResult> => {
    try {
      // 2. Check that both players exist in users
      const [challenger] = await db
        .select()
        .from(users)
        .where(eq(users.id, challengerId))
        .limit(1);

      if (!challenger) {
        return {
          success: false,
          error: 'You are not registered in the database yet. Use `/hunt` to discover your first card!',
        };
      }

      const [opponent] = await db
        .select()
        .from(users)
        .where(eq(users.id, targetId))
        .limit(1);

      if (!opponent) {
        return {
          success: false,
          error: 'Your opponent is not registered yet. They must hunt and equip cards first!',
        };
      }

      // 3. Verify both players have all 3 slots filled
      const chLineup = challenger.activeLineup as UserActiveLineup | null;
      if (!chLineup?.vanguardCardId || !chLineup?.strikerCardId || !chLineup?.conduitCardId) {
        return {
          success: false,
          error: 'You must have all 3 cards in active lineup before dueling. Use `/equip` to assign your cards.',
        };
      }

      const opLineup = opponent.activeLineup as UserActiveLineup | null;
      if (!opLineup?.vanguardCardId || !opLineup?.strikerCardId || !opLineup?.conduitCardId) {
        return {
          success: false,
          error: 'Opponent must have all 3 cards in active lineup before dueling.',
        };
      }

      // Verify cards exist in cards table
      const chCards = await db
        .select({ id: cards.id })
        .from(cards)
        .where(eq(cards.userId, challengerId));
      const chCardIds = new Set(chCards.map((c) => c.id));
      if (
        !chCardIds.has(chLineup.vanguardCardId) ||
        !chCardIds.has(chLineup.strikerCardId) ||
        !chCardIds.has(chLineup.conduitCardId)
      ) {
        return {
          success: false,
          error: 'One or more cards in your active lineup were not found. Please re-equip with `/equip`.',
        };
      }

      const opCards = await db
        .select({ id: cards.id })
        .from(cards)
        .where(eq(cards.userId, targetId));
      const opCardIds = new Set(opCards.map((c) => c.id));
      if (
        !opCardIds.has(opLineup.vanguardCardId) ||
        !opCardIds.has(opLineup.strikerCardId) ||
        !opCardIds.has(opLineup.conduitCardId)
      ) {
        return {
          success: false,
          error: "One or more cards in the opponent's active lineup do not exist.",
        };
      }

      // 4. Insert a new record into match_rooms via db.insert(matchRooms)
      const roomId = Math.random().toString(36).substring(2, 10);
      await db.insert(matchRooms).values({
        id: roomId,
        player1Id: challengerId,
        player2Id: targetId,
        status: 'WAITING',
      });

      // 5. Generate local duel URL fallback (localhost)
      const baseUrl =
        baseUrlParam || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const arenaUrl = `${cleanBase}/duel/${roomId}`;

      return {
        success: true,
        roomId,
        arenaUrl,
      };
    } catch (err) {
      console.error('[Duel Command Error]:', err);
      return {
        success: false,
        error: 'An error occurred while creating the match room in the database.',
      };
    }
  })();
}

export async function handleDuelBotCommand(
  userId: string,
  username?: string,
  baseUrlParam?: string
): Promise<DuelResult> {
  try {
    // 1. Ensure user exists and has a complete lineup
    const [challenger] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!challenger) {
      return {
        success: false,
        error: 'You are not registered in the database yet. Use `/hunt` to discover your first card!',
      };
    }

    const chLineup = challenger.activeLineup as UserActiveLineup | null;
    if (!chLineup?.vanguardCardId || !chLineup?.strikerCardId || !chLineup?.conduitCardId) {
      return {
        success: false,
        error: 'You must have all 3 cards in your active lineup before entering the arena. Use `/equip` to assign your cards.',
      };
    }

    // 2. Ensure AI Bot user exists in users table
    const botUserId = 'bot-ai-trainer';
    let [botUser] = await db.select().from(users).where(eq(users.id, botUserId)).limit(1);

    if (!botUser) {
      const [newBot] = await db
        .insert(users)
        .values({
          id: botUserId,
          username: 'AI Training Bot',
          crystals: 9999,
          activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
        })
        .returning();
      botUser = newBot;
    }

    // 3. Ensure bot has 3 tier-1 cards in cards table and equipped
    let botLineup = botUser?.activeLineup as UserActiveLineup | null;
    if (!botLineup?.vanguardCardId || !botLineup?.strikerCardId || !botLineup?.conduitCardId) {
      const botCards = await db.select().from(cards).where(eq(cards.userId, botUserId)).limit(3);
      const cardIds: string[] = botCards.map((c) => c.id);

      while (cardIds.length < 3) {
        const seed = 5000 + cardIds.length * 100;
        const gen = generateCardFromSeed(seed, 1);
        const botCardId = generateCardId();
        const [saved] = (await db
          .insert(cards)
          .values({
            id: botCardId,
            userId: botUserId,
            race: gen.race,
            variant: gen.variant,
            element: gen.element,
            elementTier: gen.elementTier,
            evolutionStage: gen.evolutionStage,
            level: gen.level,
            powerScore: gen.powerScore,
            seed: gen.seed,
          })
          .returning()) as CardRecord[];
        if (saved) {
          cardIds.push(saved.id);
        }
      }

      botLineup = {
        vanguardCardId: cardIds[0],
        strikerCardId: cardIds[1],
        conduitCardId: cardIds[2],
      };

      await db
        .update(users)
        .set({ activeLineup: botLineup })
        .where(eq(users.id, botUserId));
    }

    // 4. Create match room in match_rooms
    const roomId = Math.random().toString(36).substring(2, 10);
    await db.insert(matchRooms).values({
      id: roomId,
      player1Id: userId,
      player2Id: botUserId,
      status: 'WAITING',
    });

    // 5. Generate arena URL with ?as=p1
    const baseUrl =
      baseUrlParam || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const arenaUrl = `${cleanBase}/duel/${roomId}?as=p1`;

    return {
      success: true,
      roomId,
      arenaUrl,
    };
  } catch (err) {
    console.error('[Duel-Bot Command Error]:', err);
    return {
      success: false,
      error: 'Failed to create practice duel room in the database.',
    };
  }
}

