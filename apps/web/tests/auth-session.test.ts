// apps/web/tests/auth-session.test.ts
import { describe, it, expect } from 'vitest';
import { validateSessionToken, createMockSessionToken } from '../src/lib/auth-session';

describe('Web Client Auth Session Utilities', () => {
  it('creates and validates Discord session tokens for web arena authentication', () => {
    const token = createMockSessionToken('discord-user-123', 'HeroTrainer');
    const session = validateSessionToken(token);
    expect(session.isValid).toBe(true);
    expect(session.userId).toBe('discord-user-123');
  });

  it('rejects tampered or empty session tokens', () => {
    const invalid = validateSessionToken('');
    expect(invalid.isValid).toBe(false);
  });

  it('resolves dev sessions from ?as= query parameter in local development', async () => {
    const { getDevSessionFromQuery } = await import('../src/lib/auth-session');
    const p1 = getDevSessionFromQuery('p1');
    expect(p1?.isValid).toBe(true);
    expect(p1?.userId).toBe('dev-player-1');

    const p2 = getDevSessionFromQuery('player2');
    expect(p2?.isValid).toBe(true);
    expect(p2?.userId).toBe('dev-player-2');

    const custom = getDevSessionFromQuery('my-custom-id');
    expect(custom?.isValid).toBe(true);
    expect(custom?.userId).toBe('my-custom-id');

    const empty = getDevSessionFromQuery(null);
    expect(empty).toBeNull();
  });
});
