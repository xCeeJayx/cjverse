// apps/bot/tests/hunt-command.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { handleHuntCommand, resetCooldowns } from '../src/commands/hunt';

describe('Discord Bot /hunt Command Handler', () => {
  beforeEach(() => {
    resetCooldowns();
  });

  it('generates a new card and image buffer for caller', async () => {
    const result = await handleHuntCommand('user-12345', 'HeroPlayer');
    expect(result.success).toBe(true);
    expect(result.card).toBeDefined();
    expect(result.imageBuffer).toBeInstanceOf(Buffer);
  });

  it('enforces 30-minute cooldown on consecutive hunt attempts', async () => {
    await handleHuntCommand('user-12345', 'HeroPlayer');
    const secondAttempt = await handleHuntCommand('user-12345', 'HeroPlayer');
    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.cooldownRemainingMs).toBeGreaterThan(0);
  });
});
