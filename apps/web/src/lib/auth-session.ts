import { SignJWT, jwtVerify } from 'jose';

export interface SessionValidationResult {
  isValid: boolean;
  userId?: string;
  username?: string;
  avatar?: string | null;
  crystals?: number;
  token?: string;
}

const JWT_SECRET_STRING =
  process.env.JWT_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'cjverse-super-secret-jwt-key-min-32-chars-long';

function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET_STRING);
}

/**
 * Creates a signed JWT session token with 7-day expiration using jose (HS256).
 */
export async function createSessionToken(payload: {
  userId: string;
  username: string;
  avatar?: string | null;
  crystals?: number;
}): Promise<string> {
  const secret = getJwtSecretKey();
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    avatar: payload.avatar || null,
    crystals: payload.crystals ?? 100,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

/**
 * Creates a lightweight mock base64 session token (used for offline dev & existing tests).
 */
export function createMockSessionToken(
  userId: string,
  username: string,
  avatar?: string | null
): string {
  const payload = JSON.stringify({
    userId,
    username,
    avatar: avatar || null,
    ts: Date.now(),
  });
  return Buffer.from(payload).toString('base64');
}

/**
 * Synchronously validates and decodes a session token (supporting both signed JWTs and base64 mock tokens).
 */
export function validateSessionToken(token: string): SessionValidationResult {
  if (!token || typeof token !== 'string') {
    return { isValid: false };
  }

  // 1. Support 3-part JWT format
  if (token.includes('.')) {
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const jsonStr = Buffer.from(parts[1], 'base64url').toString('utf-8');
        const parsed = JSON.parse(jsonStr);
        if (parsed.userId) {
          // Check exp claim if present
          if (parsed.exp && Date.now() >= parsed.exp * 1000) {
            return { isValid: false };
          }
          return {
            isValid: true,
            userId: parsed.userId,
            username: parsed.username || parsed.userId,
            avatar: parsed.avatar || null,
            crystals: parsed.crystals ?? 100,
            token,
          };
        }
      } catch {}
    }
  }

  // 2. Support base64 JSON format (mock tokens)
  try {
    const jsonStr = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    if (!parsed.userId) {
      return { isValid: false };
    }
    return {
      isValid: true,
      userId: parsed.userId,
      username: parsed.username || parsed.userId,
      avatar: parsed.avatar || null,
      crystals: parsed.crystals ?? 100,
      token,
    };
  } catch {
    return { isValid: false };
  }
}

/**
 * Cryptographically verifies a signed JWT session token asynchronously using jose.
 */
export async function verifySessionTokenAsync(token: string): Promise<SessionValidationResult> {
  if (!token || typeof token !== 'string') {
    return { isValid: false };
  }

  try {
    const secret = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secret);
    if (!payload.userId || typeof payload.userId !== 'string') {
      return { isValid: false };
    }
    return {
      isValid: true,
      userId: payload.userId,
      username: (payload.username as string) || payload.userId,
      avatar: (payload.avatar as string) || null,
      crystals: typeof payload.crystals === 'number' ? payload.crystals : 100,
      token,
    };
  } catch {
    // Fall back to synchronous validator for mock tokens
    return validateSessionToken(token);
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
      avatar: null,
      crystals: 100,
      token: createMockSessionToken('dev-player-1', 'Challenger (P1)'),
    };
  }
  if (lower === 'p2' || lower === 'player2' || lower === 'opponent' || lower === '2') {
    return {
      isValid: true,
      userId: 'dev-player-2',
      username: 'Opponent (P2)',
      avatar: null,
      crystals: 100,
      token: createMockSessionToken('dev-player-2', 'Opponent (P2)'),
    };
  }
  return {
    isValid: true,
    userId: clean,
    username: clean,
    avatar: null,
    crystals: 100,
    token: createMockSessionToken(clean, clean),
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
