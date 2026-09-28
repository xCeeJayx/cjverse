import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, getDevSessionFromQuery } from '../../../lib/auth-session';
import { getUserDailyQuests, ensureUser } from '@cjverse/db';

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

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureUser(userId, username || userId);
    const data = await getUserDailyQuests(userId);

    const now = Date.now();
    const lastClaim = data.lastDailyClaim ? new Date(data.lastDailyClaim).getTime() : null;
    const cooldownMs = 20 * 60 * 60 * 1000; // 20 hours

    let canClaim = true;
    let remainingMs = 0;
    let remainingHours = 0;
    let remainingMinutes = 0;
    let remainingSeconds = 0;

    if (lastClaim) {
      const elapsedMs = now - lastClaim;
      if (elapsedMs < cooldownMs) {
        canClaim = false;
        remainingMs = cooldownMs - elapsedMs;
        remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        remainingSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
      }
    }

    return NextResponse.json({
      streak: data.dailyStreak,
      lastDailyClaim: data.lastDailyClaim ? new Date(data.lastDailyClaim).toISOString() : null,
      cooldown: {
        canClaim,
        remainingMs,
        remainingHours,
        remainingMinutes,
        remainingSeconds,
      },
      quests: data.userDailyQuests.quests,
      lastResetDate: data.userDailyQuests.lastResetDate,
      crystals: data.crystals,
    });
  } catch (err) {
    console.error('[API /api/quests Error]:', err);
    return NextResponse.json({ error: 'Failed to fetch quest status' }, { status: 500 });
  }
}
