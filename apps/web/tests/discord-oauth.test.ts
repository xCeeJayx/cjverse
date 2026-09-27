import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as loginGET } from '../src/app/api/auth/discord/login/route';
import { GET as callbackGET } from '../src/app/api/auth/discord/callback/route';
import { GET as meGET } from '../src/app/api/auth/me/route';
import { createSessionToken, validateSessionToken, verifySessionTokenAsync } from '../src/lib/auth-session';

vi.mock('@cjverse/db', () => ({
  upsertUser: vi.fn().mockImplementation((id: string, username: string, avatarUrl?: string | null) => {
    return Promise.resolve({
      id,
      username,
      avatarUrl: avatarUrl || null,
      crystals: 150,
    });
  }),
  findUserById: vi.fn().mockImplementation((id: string) => {
    return Promise.resolve({
      id,
      username: 'DBUser',
      avatarUrl: 'https://cdn.discordapp.com/avatars/db-avatar.png',
      crystals: 250,
    });
  }),
}));

describe('Discord OAuth2 Flow & Route Handlers', () => {
  beforeEach(() => {
    process.env.DISCORD_CLIENT_ID = 'test-client-id';
    process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  describe('Discord Login Route (/api/auth/discord/login)', () => {
    it('redirects to Discord authorization URL with identify & guilds.members.read scopes', async () => {
      const req: any = {
        url: 'http://localhost:3000/api/auth/discord/login?returnTo=/duel/room-999',
        headers: new Headers({
          host: 'localhost:3000',
        }),
      };

      const res = await loginGET(req);
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('https://discord.com/oauth2/authorize');
      expect(location).toContain('client_id=test-client-id');
      expect(location).toContain('response_type=code');
      expect(location).toContain('scope=identify+guilds.members.read');
      expect(location).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fdiscord%2Fcallback');

      // Verify state contains returnTo
      const parsedUrl = new URL(location!);
      const state = parsedUrl.searchParams.get('state');
      expect(state).toBeTruthy();
      const decodedState = JSON.parse(Buffer.from(state!, 'base64url').toString('utf-8'));
      expect(decodedState.returnTo).toBe('/duel/room-999');
    });

    it('derives returnTo from roomId query param if returnTo is not explicitly provided', async () => {
      const req: any = {
        url: 'http://localhost:3000/api/auth/discord/login?roomId=arena-42',
        headers: new Headers({
          host: 'localhost:3000',
        }),
      };

      const res = await loginGET(req);
      const location = res.headers.get('location')!;
      const parsedUrl = new URL(location);
      const state = parsedUrl.searchParams.get('state')!;
      const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      expect(decodedState.returnTo).toBe('/duel/arena-42');
    });
  });

  describe('Signed Session Tokens with jose', () => {
    it('creates and cryptographically verifies signed JWT session tokens with avatar and crystals', async () => {
      const token = await createSessionToken({
        userId: 'discord-user-888',
        username: 'SkyWalker',
        avatar: 'https://cdn.discordapp.com/avatars/888/avatar.png',
        crystals: 300,
      });

      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);

      const verifiedAsync = await verifySessionTokenAsync(token);
      expect(verifiedAsync.isValid).toBe(true);
      expect(verifiedAsync.userId).toBe('discord-user-888');
      expect(verifiedAsync.username).toBe('SkyWalker');
      expect(verifiedAsync.avatar).toBe('https://cdn.discordapp.com/avatars/888/avatar.png');
      expect(verifiedAsync.crystals).toBe(300);

      const syncDecoded = validateSessionToken(token);
      expect(syncDecoded.isValid).toBe(true);
      expect(syncDecoded.userId).toBe('discord-user-888');
      expect(syncDecoded.crystals).toBe(300);
    });
  });

  describe('Session Profile Endpoint (/api/auth/me)', () => {
    it('returns unauthenticated when cjverse_session cookie is absent', async () => {
      const req: any = {
        url: 'http://localhost:3000/api/auth/me',
        cookies: {
          get: () => undefined,
        },
      };

      const res = await meGET(req);
      const data = await res.json();
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
    });

    it('resolves authenticated player profile with crystal balance when session cookie is present', async () => {
      const token = await createSessionToken({
        userId: 'discord-player-1',
        username: 'CeeJay',
        avatar: 'https://cdn.discordapp.com/avatars/1/avatar.png',
        crystals: 100,
      });

      const req: any = {
        url: 'http://localhost:3000/api/auth/me',
        cookies: {
          get: (name: string) => (name === 'cjverse_session' ? { value: token } : undefined),
        },
      };

      const res = await meGET(req);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
      expect(data.user.userId).toBe('discord-player-1');
      expect(data.user.crystals).toBe(250); // fetched from findUserById
    });
  });

  describe('Discord Callback Route (/api/auth/discord/callback)', () => {
    it('redirects with error if code is missing', async () => {
      const req: any = {
        url: 'http://localhost:3000/api/auth/discord/callback?error=access_denied',
      };

      const res = await callbackGET(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('error=access_denied');
    });
  });
});
