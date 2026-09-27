// apps/bot/tests/duel-command.test.ts
import { describe, it, expect } from 'vitest';
import { handleDuelCommand } from '../src/commands/duel';

describe('Discord Bot /duel Command Handler', () => {
  it('generates a match room and cjverse.me arena link for valid opponents', () => {
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
});
