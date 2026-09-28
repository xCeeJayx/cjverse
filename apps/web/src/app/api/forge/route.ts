import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, getDevSessionFromQuery } from '../../../lib/auth-session';
import { findUserById } from '@cjverse/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const asParam = url.searchParams.get('as') || url.searchParams.get('userId');

  let userId: string | undefined;

  if (asParam) {
    const dev = getDevSessionFromQuery(asParam);
    if (dev?.isValid && dev.userId) {
      userId = dev.userId;
    }
  }

  if (!userId) {
    const cookie = request.cookies.get('cjverse_session')?.value;
    if (cookie) {
      const session = validateSessionToken(cookie);
      if (session.isValid && session.userId) {
        userId = session.userId;
      }
    }
  }

  if (!userId) {
    return NextResponse.json({
      authenticated: false,
      arcaneDust: 0,
      crystals: 0,
    });
  }

  try {
    const user = await findUserById(userId);
    return NextResponse.json({
      authenticated: true,
      userId: user?.id,
      username: user?.username,
      arcaneDust: user?.arcaneDust ?? 0,
      crystals: user?.crystals ?? 0,
    });
  } catch (err: any) {
    console.error('[API /api/forge Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch forge state' },
      { status: 500 }
    );
  }
}
