import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, getDevSessionFromQuery } from '../../../../lib/auth-session';
import {
  findUserById,
  ensureUser,
  findCardsByUserId,
  createCard,
  generateCardId,
  db,
  users,
  cards,
  matchRooms,
  eq,
} from '@cjverse/db';
import { generateCardFromSeed } from '@cjverse/game-logic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const asParam = url.searchParams.get('as') || url.searchParams.get('userId');

  let userId: string = 'dev-player-1';
  let username: string = 'Challenger (P1)';
  let avatarUrl: string | null = null;

  if (asParam) {
    const dev = getDevSessionFromQuery(asParam);
    if (dev?.isValid && dev.userId) {
      userId = dev.userId;
      username = dev.username || dev.userId;
    }
  } else {
    const cookie = request.cookies.get('cjverse_session')?.value;
    if (cookie) {
      const session = validateSessionToken(cookie);
      if (session.isValid && session.userId) {
        userId = session.userId;
        username = session.username || session.userId;
        avatarUrl = session.avatar || null;
      }
    }
  }

  try {
    let user = await findUserById(userId);
    if (!user) {
      user = await ensureUser(userId, username, avatarUrl);
    }

    // 1. Ensure user has at least 3 cards and complete active lineup
    let userCards = await findCardsByUserId(userId);
    if (userCards.length < 3) {
      const needed = 3 - userCards.length;
      for (let i = 0; i < needed; i++) {
        const seed = 1000 + (userCards.length + i) * 31;
        const gen = generateCardFromSeed(seed, 1);
        const cId = generateCardId();
        await createCard({
          id: cId,
          userId,
          race: gen.race,
          variant: i === 0 ? 'Gold' : 'Silver',
          element: gen.element,
          elementTier: gen.elementTier,
          evolutionStage: gen.evolutionStage,
          level: gen.level,
          powerScore: gen.powerScore,
          seed: gen.seed,
        });
      }
      userCards = await findCardsByUserId(userId);
    }

    // Ensure active lineup has 3 cards
    const currentLineup = { ...(user.activeLineup || {}) };
    if (!currentLineup.vanguardCardId) currentLineup.vanguardCardId = userCards[0]?.id || null;
    if (!currentLineup.strikerCardId) {
      currentLineup.strikerCardId =
        userCards.find((c) => c.id !== currentLineup.vanguardCardId)?.id || userCards[1]?.id || null;
    }
    if (!currentLineup.conduitCardId) {
      currentLineup.conduitCardId =
        userCards.find(
          (c) => c.id !== currentLineup.vanguardCardId && c.id !== currentLineup.strikerCardId
        )?.id ||
        userCards[2]?.id ||
        null;
    }

    await db.update(users).set({ activeLineup: currentLineup }).where(eq(users.id, userId));

    // 2. Ensure BOT user exists with cards & lineup
    const botUserId = 'BOT-AI-TRAINER';
    let botUser = await findUserById(botUserId);
    if (!botUser) {
      botUser = await ensureUser(botUserId, 'Bot AI Trainer');
    }

    let botCards = await findCardsByUserId(botUserId);
    if (botCards.length < 3) {
      for (let i = 0; i < 3; i++) {
        const seed = 9000 + i * 47;
        const gen = generateCardFromSeed(seed, 1);
        const cId = generateCardId();
        await createCard({
          id: cId,
          userId: botUserId,
          race: gen.race,
          variant: 'Silver',
          element: gen.element,
          elementTier: gen.elementTier,
          evolutionStage: gen.evolutionStage,
          level: gen.level,
          powerScore: gen.powerScore,
          seed: gen.seed,
        });
      }
      botCards = await findCardsByUserId(botUserId);
    }

    const botLineup = {
      vanguardCardId: botCards[0]?.id || null,
      strikerCardId: botCards[1]?.id || null,
      conduitCardId: botCards[2]?.id || null,
    };
    await db.update(users).set({ activeLineup: botLineup }).where(eq(users.id, botUserId));

    // 3. Create match room in match_rooms
    const roomId = 'bot-' + Math.random().toString(36).substring(2, 8);
    await db.insert(matchRooms).values({
      id: roomId,
      player1Id: userId,
      player2Id: botUserId,
      status: 'WAITING',
    });

    const asParamSuffix = asParam ? `?as=${encodeURIComponent(asParam)}` : '';
    const arenaUrl = `/duel/${roomId}${asParamSuffix}`;

    return NextResponse.json({
      success: true,
      roomId,
      arenaUrl,
    });
  } catch (err) {
    console.error('[API Practice Duel Error]:', err);
    // Fallback room ID if DB fails
    const fallbackRoomId = 'bot-' + Math.random().toString(36).substring(2, 8);
    return NextResponse.json({
      success: true,
      roomId: fallbackRoomId,
      arenaUrl: `/duel/${fallbackRoomId}`,
    });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
