import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getLeaderboard } from '../src/app/api/leaderboard/route';
import { db, users, matchRooms, eq } from '@cjverse/db';

describe('Web Leaderboard & Match History API (/api/leaderboard)', () => {
  const p1Id = 'test-web-p1';
  const p2Id = 'test-web-p2';
  const testRoomId = 'test-room-history-1';

  beforeEach(async () => {
    await db.delete(matchRooms).where(eq(matchRooms.id, testRoomId));
    await db.delete(users).where(eq(users.id, p1Id));
    await db.delete(users).where(eq(users.id, p2Id));

    await db.insert(users).values({
      id: p1Id,
      username: 'ApexPredator',
      rating: 1550,
      wins: 45,
      losses: 5,
      crystals: 800,
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });

    await db.insert(users).values({
      id: p2Id,
      username: 'BronzeHero',
      rating: 980,
      wins: 2,
      losses: 8,
      crystals: 50,
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });

    await db.insert(matchRooms).values({
      id: testRoomId,
      player1Id: p1Id,
      player2Id: p2Id,
      status: 'COMPLETED',
      winnerId: p1Id,
      combatLogs: ['Turn 1: Strike', 'Turn 2: Victory!'],
      summary: {
        winnerId: p1Id,
        loserId: p2Id,
        winnerDelta: 16,
        loserDelta: 16,
        crystalsWon: 50,
        turnsCount: 2,
      },
    });
  });

  it('returns rankings ordered by rating descending with rank tiers and win rates', async () => {
    const mockReq: any = {
      url: 'http://localhost:3000/api/leaderboard',
    };

    const res = await getLeaderboard(mockReq);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.rankings).toBeInstanceOf(Array);
    expect(data.rankings.length).toBeGreaterThanOrEqual(2);

    const apexIdx = data.rankings.findIndex((r: any) => r.id === p1Id);
    const bronzeIdx = data.rankings.findIndex((r: any) => r.id === p2Id);

    expect(apexIdx).toBeLessThan(bronzeIdx);

    const apex = data.rankings[apexIdx];
    expect(apex.rating).toBe(1550);
    expect(apex.tier).toBe('Diamond');
    expect(apex.wins).toBe(45);
    expect(apex.losses).toBe(5);
    expect(apex.winRate).toBe(90);

    const bronze = data.rankings[bronzeIdx];
    expect(bronze.rating).toBe(980);
    expect(bronze.tier).toBe('Bronze');
    expect(bronze.winRate).toBe(20);
  });

  it('returns recent completed match rooms with enriched player details', async () => {
    const mockReq: any = {
      url: 'http://localhost:3000/api/leaderboard',
    };

    const res = await getLeaderboard(mockReq);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.recentMatches).toBeInstanceOf(Array);
    expect(data.recentMatches.length).toBeGreaterThanOrEqual(1);

    const match = data.recentMatches.find((m: any) => m.id === testRoomId);
    expect(match).toBeDefined();
    expect(match.player1.id).toBe(p1Id);
    expect(match.player1.username).toBe('ApexPredator');
    expect(match.player2.id).toBe(p2Id);
    expect(match.player2.username).toBe('BronzeHero');
    expect(match.winnerId).toBe(p1Id);
    expect(match.isPlayer1Winner).toBe(true);
    expect(match.summary?.winnerDelta).toBe(16);
    expect(match.summary?.crystalsWon).toBe(50);
  });
});
