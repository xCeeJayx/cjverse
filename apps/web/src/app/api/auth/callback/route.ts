import { NextRequest, NextResponse } from 'next/server';
import { createMockSessionToken } from '../../../../lib/auth-session';
import { upsertUser } from '@cjverse/db';

import { exchangeCodeForUser } from '../../../../lib/oauth';

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
