// apps/web/tests/auth-callback.test.ts
import { describe, it, expect, vi } from 'vitest';
import { exchangeCodeForUser, GET } from '../src/app/api/auth/callback/route';
import { validateSessionToken } from '../src/lib/auth-session';

describe('Discord OAuth2 Web Callback Route', () => {
  it('exchanges code for user profile successfully with mock fetch', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/oauth2/token')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-access-token' }),
        });
      }
      if (url.includes('/users/@me')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'discord-987',
              username: 'OAuthGamer',
              avatar: 'avatar123',
            }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });

    const user = await exchangeCodeForUser('valid-code', 'http://localhost:3000/api/auth/callback', mockFetch as any);
    expect(user.id).toBe('discord-987');
    expect(user.username).toBe('OAuthGamer');
  });

  it('redirects with error parameter when code is missing', async () => {
    const mockRequest: any = {
      url: 'http://localhost:3000/api/auth/callback',
    };

    const res = await GET(mockRequest);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('error=missing_code');
  });

  it('redirects with error parameter when oauth returns error', async () => {
    const mockRequest: any = {
      url: 'http://localhost:3000/api/auth/callback?error=access_denied',
    };

    const res = await GET(mockRequest);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('error=access_denied');
  });
});
