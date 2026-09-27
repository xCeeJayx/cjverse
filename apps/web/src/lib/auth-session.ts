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

export function getDevSessionFromQuery(asParam: string | null): SessionValidationResult | null {
  if (!asParam) return null;
  const clean = asParam.trim();
  const lower = clean.toLowerCase();
  if (lower === 'p1' || lower === 'player1' || lower === 'challenger' || lower === '1') {
    return {
      isValid: true,
      userId: 'dev-player-1',
      username: 'Challenger (P1)',
    };
  }
  if (lower === 'p2' || lower === 'player2' || lower === 'opponent' || lower === '2') {
    return {
      isValid: true,
      userId: 'dev-player-2',
      username: 'Opponent (P2)',
    };
  }
  return {
    isValid: true,
    userId: clean,
    username: clean,
  };
}

export function getClientSessionCookie(): SessionValidationResult {
  if (typeof document === 'undefined') return { isValid: false };
  const cookies = document.cookie.split(';');
  for (const c of cookies) {
    const parts = c.trim().split('=');
    if (parts[0] === 'cjverse_session' && parts[1]) {
      const res = validateSessionToken(parts[1]);
      if (res.isValid) return res;
    }
  }
  return { isValid: false };
}
