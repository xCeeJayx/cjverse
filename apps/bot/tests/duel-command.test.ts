// apps/bot/tests/duel-command.test.ts
import { describe, it, expect, vi } from 'vitest';

const { mockInsertedRooms } = vi.hoisted(() => ({
  mockInsertedRooms: [] as any[],
}));

vi.mock('@cjverse/db', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'player-valid',
                activeLineup: {
                  vanguardCardId: 'c1',
                  strikerCardId: 'c2',
                  conduitCardId: 'c3',
                },
              },
            ]),
            then: (resolve: any) => resolve([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]),
            [Symbol.iterator]: function* () {
              yield { id: 'c1' };
              yield { id: 'c2' };
              yield { id: 'c3' };
            },
          })),
        })),
      })),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((room) => {
          mockInsertedRooms.push(room);
          return {
            catch: vi.fn(),
            then: (resolve: any) => resolve([room]),
            returning: vi.fn().mockResolvedValue([{ id: 'mock-bot-card-id' }]),
          };
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
  };
});

import { handleDuelCommand, handleDuelBotCommand } from '../src/commands/duel';

describe('Discord Bot /duel Command Handler', () => {
  it('generates a match room and cjverse.me arena link for valid opponents in synchronous mode', () => {
    const result = handleDuelCommand('user-1', 'user-2', false, true, true);
    expect(result.success).toBe(true);
    expect(result.roomId).toBeDefined();
    expect(result.arenaUrl).toContain('https://cjverse.me/duel/');
  });

  it('rejects duel challenge against oneself or a bot', () => {
    const selfDuel = handleDuelCommand('user-1', 'user-1', false, true, true);
    expect(selfDuel.success).toBe(false);
    expect(selfDuel.error).toContain('distinct');

    const botDuel = handleDuelCommand('user-1', 'bot-99', true, true, true);
    expect(botDuel.success).toBe(false);
    expect(botDuel.error).toContain('bot');
  });

  // Review Focus Check: Incomplete Lineup Challenge
  it('rejects duel challenge if target player lacks 3 cards in active lineup', () => {
    const result = handleDuelCommand('user-1', 'user-2', false, true, false);
    expect(result.success).toBe(false);
    expect(result.error).toContain('3 cards in active lineup');
  });

  it('creates match room in database and generates localhost:3000 duel link in async mode', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const result = await handleDuelCommand('player-1', 'player-2', false);
    expect(result.success).toBe(true);
    expect(result.roomId).toBeDefined();
    expect(result.arenaUrl).toContain('http://localhost:3000/duel/');
  });

  it('creates practice duel room against AI bot with ?as=p1 link via handleDuelBotCommand', async () => {
    const result = await handleDuelBotCommand('player-1', 'PracticePlayer');
    expect(result.success).toBe(true);
    expect(result.roomId).toBeDefined();
    expect(result.arenaUrl).toContain('/duel/');
    expect(result.arenaUrl).toContain('?as=p1');
  });
});
