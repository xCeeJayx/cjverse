import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleLeaderboardCommand,
  formatMedal,
} from '../src/commands/leaderboard';
import { handleInteraction } from '../src/index';
import { db, users, eq } from '@cjverse/db';

describe('Discord Bot /leaderboard Command Handler', () => {
  const user1 = 'leaderboard-test-user-1';
  const user2 = 'leaderboard-test-user-2';
  const user3 = 'leaderboard-test-user-3';

  beforeEach(async () => {
    // Clean up
    await db.delete(users).where(eq(users.id, user1));
    await db.delete(users).where(eq(users.id, user2));
    await db.delete(users).where(eq(users.id, user3));

    // Insert 3 test users with distinct ratings & crystals
    await db.insert(users).values({
      id: user1,
      username: 'AlphaDuelist',
      rating: 2450,
      wins: 20,
      losses: 5,
      crystals: 88000,
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });

    await db.insert(users).values({
      id: user2,
      username: 'BetaChampion',
      rating: 2600,
      wins: 30,
      losses: 2,
      crystals: 77000,
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });

    await db.insert(users).values({
      id: user3,
      username: 'GammaWhale',
      rating: 2200,
      wins: 10,
      losses: 10,
      crystals: 99000,
      activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
    });
  });

  it('orders top players by rating DESC when category is rating', async () => {
    const result = await handleLeaderboardCommand('rating');
    expect(result.category).toBe('rating');
    expect(result.entries.length).toBeGreaterThanOrEqual(3);

    // BetaChampion (2600) should be ranked higher than AlphaDuelist (2450) and GammaWhale (2200)
    const betaIdx = result.entries.findIndex((e) => e.userId === user2);
    const alphaIdx = result.entries.findIndex((e) => e.userId === user1);
    const gammaIdx = result.entries.findIndex((e) => e.userId === user3);

    expect(betaIdx).toBeGreaterThanOrEqual(0);
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(gammaIdx).toBeGreaterThanOrEqual(0);
    expect(betaIdx).toBeLessThan(alphaIdx);
    expect(alphaIdx).toBeLessThan(gammaIdx);
    expect(result.entries[betaIdx].rating).toBe(2600);
    expect(result.entries[betaIdx].wins).toBe(30);
  });

  it('orders top players by crystals DESC when category is crystals', async () => {
    const result = await handleLeaderboardCommand('crystals');
    expect(result.category).toBe('crystals');

    // GammaWhale (99000) should be ranked higher than AlphaDuelist (88000) and BetaChampion (77000)
    const gammaIdx = result.entries.findIndex((e) => e.userId === user3);
    const alphaIdx = result.entries.findIndex((e) => e.userId === user1);
    const betaIdx = result.entries.findIndex((e) => e.userId === user2);

    expect(gammaIdx).toBeGreaterThanOrEqual(0);
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(betaIdx).toBeGreaterThanOrEqual(0);
    expect(gammaIdx).toBeLessThan(alphaIdx);
    expect(alphaIdx).toBeLessThan(betaIdx);
    expect(result.entries[gammaIdx].crystals).toBe(99000);
  });

  it('formats medals correctly for 1st, 2nd, 3rd, and 4th+', () => {
    expect(formatMedal(1)).toBe('🥇');
    expect(formatMedal(2)).toBe('🥈');
    expect(formatMedal(3)).toBe('🥉');
    expect(formatMedal(4)).toBe('#4');
    expect(formatMedal(10)).toBe('#10');
  });

  it('handles /leaderboard interaction with deferReply and editReply embed', async () => {
    let deferred = false;
    let replyPayload: any = null;

    const mockInteraction: any = {
      commandName: 'leaderboard',
      user: { id: user1, username: 'AlphaDuelist' },
      options: {
        getString: (name: string) => (name === 'category' ? 'rating' : null),
      },
      deferReply: async () => {
        deferred = true;
      },
      editReply: async (payload: any) => {
        replyPayload = payload;
      },
    };

    await handleInteraction(mockInteraction);

    expect(deferred).toBe(true);
    expect(replyPayload).toBeDefined();
    expect(replyPayload.embeds).toBeDefined();
    expect(replyPayload.embeds.length).toBe(1);
    const embedData = replyPayload.embeds[0].data;
    expect(embedData.title).toBe('🏆 CJVerse Leaderboard - Top Rated Duelists');
    expect(embedData.description).toContain('BetaChampion');
    expect(embedData.description).toContain('MMR');
    expect(embedData.color).toBe(0xf59e0b);
  });
});
