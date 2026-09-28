import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveWorldBoss,
  findWorldBossById,
  getBossContributors,
  checkUserRaidEligibility,
} from '@cjverse/db';
import { validateSessionToken, getDevSessionFromQuery } from '../../../lib/auth-session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const bossIdParam = url.searchParams.get('bossId');
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

    const boss = bossIdParam
      ? await findWorldBossById(bossIdParam) || await getActiveWorldBoss()
      : await getActiveWorldBoss();

    const contributors = await getBossContributors(boss.id, 10);

    const safeTotal = Math.max(1, boss.totalHp);
    const safeCurrent = Math.max(0, Math.min(safeTotal, boss.currentHp));
    const hpPercent = Number(((safeCurrent / safeTotal) * 100).toFixed(2));

    let userEligibility = null;
    if (userId) {
      userEligibility = await checkUserRaidEligibility(boss.id, userId);
    }

    return NextResponse.json({
      boss: {
        ...boss,
        hpPercent,
      },
      contributors,
      userEligibility,
    });
  } catch (err: any) {
    console.error('[API /api/boss Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch World Boss data' },
      { status: 500 }
    );
  }
}
