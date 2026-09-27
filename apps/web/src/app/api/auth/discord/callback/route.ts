import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '../../../../../lib/auth-session';
import { exchangeCodeForUser, getDiscordAvatarUrl } from '../../../../../lib/oauth';
import { upsertUser } from '@cjverse/db';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Resolve target return URL from state parameter
  let returnTo = '/';
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      if (decoded.returnTo && typeof decoded.returnTo === 'string' && decoded.returnTo.startsWith('/')) {
        returnTo = decoded.returnTo;
      }
    } catch {
      if (state.startsWith('/')) {
        returnTo = state;
      }
    }
  }

  if (error || !code) {
    const errorParam = encodeURIComponent(error || 'missing_code');
    const redirectTarget = returnTo.includes('?')
      ? `${returnTo}&error=${errorParam}`
      : `${returnTo}?error=${errorParam}`;
    return NextResponse.redirect(new URL(redirectTarget, request.url));
  }

  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
  const redirectUri = `${baseUrl.replace(/\/+$/, '')}/api/auth/discord/callback`;

  try {
    const discordUser = await exchangeCodeForUser(code, redirectUri);
    const avatarUrl = getDiscordAvatarUrl(discordUser.id, discordUser.avatar);

    let userRecord = null;
    try {
      userRecord = await upsertUser(discordUser.id, discordUser.username, avatarUrl);
    } catch (err) {
      console.warn('[OAuth Callback] User DB upsert warning:', err);
    }

    const sessionToken = await createSessionToken({
      userId: discordUser.id,
      username: discordUser.username,
      avatar: avatarUrl,
      crystals: userRecord?.crystals ?? 100,
    });

    const response = NextResponse.redirect(new URL(returnTo, request.url));
    response.cookies.set('cjverse_session', sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err) {
    console.error('[OAuth Callback] Authentication error:', err);
    const redirectTarget = returnTo.includes('?')
      ? `${returnTo}&error=oauth_failed`
      : `${returnTo}?error=oauth_failed`;
    return NextResponse.redirect(new URL(redirectTarget, request.url));
  }
}
