import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, getDevSessionFromQuery } from '../../../../lib/auth-session';
import { buyAndOpenBoosterPack, ensureUser } from '@cjverse/db';
import { BoosterPackType } from '@cjverse/game-logic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const asParam = url.searchParams.get('as') || url.searchParams.get('userId');

  let userId: string | undefined;
  let username: string | undefined;

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
      }
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Please login to purchase booster packs.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { packType } = body;

    if (
      !packType ||
      !['standard', 'elemental', 'ascendant'].includes(packType)
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid or missing packType. Available options: standard, elemental, ascendant.',
        },
        { status: 400 }
      );
    }

    await ensureUser(userId, username || userId);
    const result = await buyAndOpenBoosterPack(
      userId,
      packType as BoosterPackType
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to purchase booster pack' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      packType: result.packType,
      packName: result.packName,
      cost: result.cost,
      cards: result.cards,
      remainingCrystals: result.remainingCrystals,
    });
  } catch (err) {
    console.error('[API /api/packs/open Error]:', err);
    return NextResponse.json(
      { error: 'Internal server error while opening booster pack' },
      { status: 500 }
    );
  }
}
