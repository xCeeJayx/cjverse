import { NextRequest, NextResponse } from 'next/server';
import { db, users, matchRooms, desc, eq, inArray } from '@cjverse/db';
import { getRankTier, calculateWinRate } from '@cjverse/game-logic';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Fetch top 50 ranked players ordered by rating DESC
    const topUsers = await db
      .select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        rating: users.rating,
        wins: users.wins,
        losses: users.losses,
        crystals: users.crystals,
      })
      .from(users)
      .orderBy(desc(users.rating))
      .limit(50);

    const rankings = topUsers.map((u, idx) => {
      const wins = u.wins ?? 0;
      const losses = u.losses ?? 0;
      const rating = u.rating ?? 1000;
      const tierInfo = getRankTier(rating);
      const winRate = calculateWinRate(wins, losses);

      return {
        rank: idx + 1,
        id: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        rating,
        wins,
        losses,
        winRate,
        tier: tierInfo.tier,
        tierInfo,
        crystals: u.crystals ?? 100,
      };
    });

    // 2. Fetch 10 most recent completed match rooms
    const completedRooms = await db
      .select()
      .from(matchRooms)
      .where(eq(matchRooms.status, 'COMPLETED'))
      .orderBy(desc(matchRooms.createdAt))
      .limit(10);

    // Collect all involved player IDs to hydrate player names and avatars
    const userIds = new Set<string>();
    for (const r of completedRooms) {
      if (r.player1Id) userIds.add(r.player1Id);
      if (r.player2Id) userIds.add(r.player2Id);
      if (r.winnerId) userIds.add(r.winnerId);
    }

    const playerMap = new Map<
      string,
      { username: string; avatarUrl: string | null }
    >();

    if (userIds.size > 0) {
      const dbPlayers = await db
        .select({
          id: users.id,
          username: users.username,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(inArray(users.id, Array.from(userIds)));

      for (const p of dbPlayers) {
        playerMap.set(p.id, {
          username: p.username,
          avatarUrl: p.avatarUrl,
        });
      }
    }

    const recentMatches = completedRooms.map((room) => {
      const p1Info = playerMap.get(room.player1Id) || {
        username: room.player1Id.startsWith('BOT') ? 'Bot AI Trainer' : room.player1Id,
        avatarUrl: null,
      };

      const p2Info = playerMap.get(room.player2Id) || {
        username: room.player2Id.startsWith('BOT') ? 'Bot AI Trainer' : room.player2Id,
        avatarUrl: null,
      };

      return {
        id: room.id,
        player1: {
          id: room.player1Id,
          username: p1Info.username,
          avatarUrl: p1Info.avatarUrl,
        },
        player2: {
          id: room.player2Id,
          username: p2Info.username,
          avatarUrl: p2Info.avatarUrl,
        },
        winnerId: room.winnerId,
        isPlayer1Winner: room.winnerId === room.player1Id,
        summary: room.summary || null,
        combatLogsCount: Array.isArray(room.combatLogs) ? room.combatLogs.length : 0,
        createdAt: room.createdAt,
      };
    });

    return NextResponse.json({
      rankings,
      recentMatches,
      totalPlayersCount: rankings.length,
      recentMatchesCount: recentMatches.length,
    });
  } catch (err) {
    console.error('[API /api/leaderboard Error]:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve leaderboard data' },
      { status: 500 }
    );
  }
}
