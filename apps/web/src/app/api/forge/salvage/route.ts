import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, getDevSessionFromQuery } from '../../../../lib/auth-session';
import { salvageCards } from '@cjverse/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
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
    return NextResponse.json(
      { error: 'Unauthorized. Please login to salvage cards.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { cardIds } = body;

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid cardIds. Expected a non-empty array of card IDs.' },
        { status: 400 }
      );
    }

    const result = await salvageCards(userId, cardIds);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to salvage cards.' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API /api/forge/salvage Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while salvaging cards.' },
      { status: 500 }
    );
  }
}
