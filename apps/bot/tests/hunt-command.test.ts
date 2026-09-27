// apps/bot/tests/hunt-command.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleHuntCommand, resetCooldowns } from '../src/commands/hunt';

// Mock DB queries so unit tests execute in milliseconds without external network latency
vi.mock('@cjverse/db', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'user-12345' }]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue([]),
          returning: vi.fn().mockResolvedValue([
            {
              id: 'mock-card-uuid-123',
              userId: 'user-12345',
              race: 'dragon',
              variant: 'gold',
              element: 'fire',
              elementTier: 'A',
              evolutionStage: 1,
              level: 1,
              powerScore: 100,
              seed: 12345,
            },
          ]),
        }),
      }),
    },
  };
});

describe('Discord Bot /hunt Command Handler', () => {
  beforeEach(() => {
    resetCooldowns();
  });

  it('generates a new card and image buffer for caller', async () => {
    const result = await handleHuntCommand('user-12345', 'HeroPlayer');
    expect(result.success).toBe(true);
    expect(result.card).toBeDefined();
    expect(result.card?.id).toBe('mock-card-uuid-123');
    expect(result.imageBuffer).toBeInstanceOf(Buffer);
  });

  it('enforces 30-minute cooldown on consecutive hunt attempts', async () => {
    await handleHuntCommand('user-12345', 'HeroPlayer');
    const secondAttempt = await handleHuntCommand('user-12345', 'HeroPlayer');
    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.cooldownRemainingMs).toBeGreaterThan(0);
  });
});
