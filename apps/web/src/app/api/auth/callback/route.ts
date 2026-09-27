import { NextRequest, NextResponse } from 'next/server';
import { createMockSessionToken } from '../../../../lib/auth-session';
import { upsertUser } from '@cjverse/db';

export interface DiscordUser {
  id: string;
  username: string;
  avatar?: string | null;
}

export async function exchangeCodeForUser(
  code: string,
  redirectUri: string,
  fetchFn: typeof fetch = fetch
): Promise<DiscordUser> {
  const clientId = process.env.DISCORD_CLIENT_ID || '';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || '';

  const tokenRes = await fetchFn('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text().catch(() => '');
    throw new Error(`Token exchange failed: ${tokenRes.status} ${errorText}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  const accessToken = tokenData.access_token;

  const userRes = await fetchFn('https://discord.com/api/v10/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userRes.ok) {
    throw new Error(`Failed to fetch Discord user: ${userRes.status}`);
  }

  const userData = (await userRes.json()) as DiscordUser;
  return userData;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error || 'missing_code')}`, request.url)
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
  const redirectUri = `${baseUrl.replace(/\/+$/, '')}/api/auth/callback`;

  try {
    const discordUser = await exchangeCodeForUser(code, redirectUri);

    try {
      await upsertUser(discordUser.id, discordUser.username);
    } catch (err) {
      console.warn('[OAuth Callback] User DB upsert warning:', err);
    }

    const sessionToken = createMockSessionToken(discordUser.id, discordUser.username);

    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('cjverse_session', sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error('[OAuth Callback] Authentication error:', err);
    return NextResponse.redirect(new URL('/?error=oauth_failed', request.url));
  }
}
