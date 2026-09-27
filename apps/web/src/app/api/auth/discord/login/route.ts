import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Missing DISCORD_CLIENT_ID configuration' }, { status: 500 });
  }

  const url = new URL(request.url);
  let returnTo = url.searchParams.get('returnTo');
  const roomId = url.searchParams.get('roomId');

  if (!returnTo && roomId) {
    returnTo = `/duel/${roomId}`;
  }
  if (!returnTo) {
    returnTo = '/';
  }

  // Base URL calculation
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
  const redirectUri = `${baseUrl.replace(/\/+$/, '')}/api/auth/discord/callback`;

  // Encode returnTo into state
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64url');

  const discordAuthUrl = new URL('https://discord.com/oauth2/authorize');
  discordAuthUrl.searchParams.set('client_id', clientId);
  discordAuthUrl.searchParams.set('response_type', 'code');
  discordAuthUrl.searchParams.set('redirect_uri', redirectUri);
  discordAuthUrl.searchParams.set('scope', 'identify guilds.members.read');
  discordAuthUrl.searchParams.set('state', state);
  discordAuthUrl.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(discordAuthUrl);
}
