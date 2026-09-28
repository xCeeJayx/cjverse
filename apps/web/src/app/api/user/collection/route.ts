import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, getDevSessionFromQuery } from '../../../../lib/auth-session';
import {
  findUserById,
  ensureUser,
  findCardsByUserId,
  createCard,
  generateCardId,
} from '@cjverse/db';
import { generateCardFromSeed } from '@cjverse/game-logic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const asParam = url.searchParams.get('as') || url.searchParams.get('userId');

  let userId: string | undefined;
  let username: string | undefined;
  let avatarUrl: string | null = null;

  if (asParam) {
    const dev = getDevSessionFromQuery(asParam);
    if (dev?.isValid && dev.userId) {
      userId = dev.userId;
      username = dev.username;
    }
  }

  if (!userId) {
    const cookie = request.cookies.get('cjverse_session')?.value;
    if (cookie) {
      const session = validateSessionToken(cookie);
      if (session.isValid && session.userId) {
        userId = session.userId;
        username = session.username;
        avatarUrl = session.avatar || null;
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let user = await findUserById(userId);
    if (!user) {
      user = await ensureUser(userId, username || userId, avatarUrl);
    }

    let userCards = await findCardsByUserId(userId);

    // If dev user has no cards, automatically seed starter cards for testing
    if (
      userCards.length === 0 &&
      (userId.startsWith('dev-') || process.env.NODE_ENV !== 'production')
    ) {
      const starterSeeds = [120, 340, 560, 780, 910, 420, 850];
      const starterVariants: ('Normal' | 'Silver' | 'Gold' | 'Diamond' | 'Rainbow')[] = [
        'Rainbow',
        'Diamond',
        'Gold',
        'Silver',
        'Silver',
        'Normal',
        'Normal',
      ];
      for (let i = 0; i < starterSeeds.length; i++) {
        const seed = starterSeeds[i];
        const gen = generateCardFromSeed(seed, 1 + (i % 5));
        const cId = generateCardId();
        try {
          await createCard({
            id: cId,
            userId,
            race: gen.race,
            variant: starterVariants[i] || gen.variant,
            element: gen.element,
            elementTier: gen.elementTier,
            evolutionStage: gen.evolutionStage,
            level: gen.level,
            powerScore: gen.powerScore,
            seed: gen.seed,
          });
        } catch (err) {
          console.warn('[Collection] Failed to insert starter card:', err);
        }
      }
      userCards = await findCardsByUserId(userId);
    }

    const lineup = user.activeLineup || {
      vanguardCardId: null,
      strikerCardId: null,
      conduitCardId: null,
    };

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        crystals: user.crystals,
        arcaneDust: user.arcaneDust,
      },
      cards: userCards,
      lineup,
    });
  } catch (err) {
    console.error('[API /api/user/collection Error]:', err);
    return NextResponse.json({ error: 'Failed to retrieve collection' }, { status: 500 });
  }
}
