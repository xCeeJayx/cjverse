import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, getDevSessionFromQuery } from '../../../../lib/auth-session';
import { claimQuestReward, ensureUser } from '@cjverse/db';

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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { questId } = body;

    if (!questId || typeof questId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid questId' }, { status: 400 });
    }

    await ensureUser(userId, username || userId);
    const result = await claimQuestReward(userId, questId);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to claim quest reward' }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[API /api/quests/claim Error]:', err);
    return NextResponse.json({ error: 'Internal server error claiming quest reward' }, { status: 500 });
  }
}
