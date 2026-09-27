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
