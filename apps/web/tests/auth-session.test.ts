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
});
