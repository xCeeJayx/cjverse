export interface SessionValidationResult {
  isValid: boolean;
  userId?: string;
  username?: string;
}

export function createMockSessionToken(userId: string, username: string): string {
  const payload = JSON.stringify({ userId, username, ts: Date.now() });
  return Buffer.from(payload).toString('base64');
}

export function validateSessionToken(token: string): SessionValidationResult {
  if (!token || typeof token !== 'string') {
    return { isValid: false };
  }

  try {
    const jsonStr = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    if (!parsed.userId) {
      return { isValid: false };
    }
    return {
      isValid: true,
      userId: parsed.userId,
      username: parsed.username
    };
  } catch {
    return { isValid: false };
  }
}
