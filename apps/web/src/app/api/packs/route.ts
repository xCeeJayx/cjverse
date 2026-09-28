import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, getDevSessionFromQuery } from '../../../lib/auth-session';
import { findUserById, ensureUser } from '@cjverse/db';
import { BOOSTER_PACKS } from '@cjverse/game-logic';

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  let userCrystals = 0;
  if (userId) {
    let user = await findUserById(userId);
    if (!user) {
      user = await ensureUser(userId, username || userId);
    }
    userCrystals = user.crystals ?? 0;
  }

  return NextResponse.json({
    packs: Object.values(BOOSTER_PACKS),
    userCrystals,
    authenticated: !!userId,
    userId: userId || null,
    purchaseLimits: {
      standard: null,
      elemental: null,
      ascendant: null,
    },
  });
}
