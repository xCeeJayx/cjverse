import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '../../../../lib/auth-session';
import { findUserById } from '@cjverse/db';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const queryUserId = url.searchParams.get('userId');

  // If queryUserId is provided (e.g. for dev session crystals lookup)
  if (queryUserId) {
    try {
      const user = await findUserById(queryUserId);
      return NextResponse.json({
        authenticated: true,
        user: {
          userId: queryUserId,
          username: user?.username || queryUserId,
          avatar: user?.avatarUrl || null,
          crystals: user?.crystals ?? 100,
        },
      });
    } catch {
      return NextResponse.json({
        authenticated: true,
        user: {
          userId: queryUserId,
          username: queryUserId,
          avatar: null,
          crystals: 100,
        },
      });
    }
  }

  const cookie = request.cookies.get('cjverse_session')?.value;
  if (!cookie) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const session = validateSessionToken(cookie);
  if (!session.isValid || !session.userId) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  let crystals = session.crystals ?? 100;
  let avatar = session.avatar;

  try {
    const user = await findUserById(session.userId);
    if (user) {
      crystals = user.crystals ?? crystals;
      avatar = user.avatarUrl || avatar;
    }
  } catch (err) {
    console.warn('[Auth Me] Failed to query user from DB:', err);
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      userId: session.userId,
      username: session.username || session.userId,
      avatar: avatar || null,
      crystals,
    },
  });
}
