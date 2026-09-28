import { NextRequest, NextResponse } from 'next/server';
import {
  submitBossDamage,
  findWorldBossById,
  checkUserRaidEligibility,
} from '@cjverse/db';
import { validateSessionToken, getDevSessionFromQuery } from '../../../../lib/auth-session';

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
      { error: 'Unauthorized. Please login to submit raid damage.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { bossId, damageDealt } = body;

    if (!bossId || typeof bossId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid bossId.' },
        { status: 400 }
      );
    }

    if (damageDealt === undefined || typeof damageDealt !== 'number' || damageDealt < 0) {
      return NextResponse.json(
        { error: 'Invalid damageDealt. Must be a non-negative number.' },
        { status: 400 }
      );
    }

    const boss = await findWorldBossById(bossId);
    if (!boss) {
      return NextResponse.json(
        { error: `World Boss ${bossId} not found.` },
        { status: 404 }
      );
    }

    if (boss.status !== 'active') {
      return NextResponse.json(
        { error: `World Boss is already ${boss.status}. No more damage can be submitted.` },
        { status: 400 }
      );
    }

    // Verify user eligibility
    const eligibility = await checkUserRaidEligibility(bossId, userId);
    if (!eligibility.canFight) {
      return NextResponse.json(
        { error: eligibility.reason || 'You are not eligible to raid this boss.' },
        { status: 403 }
      );
    }

    // Atomically submit damage
    const result = await submitBossDamage(bossId, userId, damageDealt);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API /api/boss/submit-damage Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to submit boss damage.' },
      { status: 500 }
    );
  }
}
