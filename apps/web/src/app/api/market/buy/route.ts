import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, getDevSessionFromQuery } from '../../../../lib/auth-session';
import { buyMarketListing, findUserById } from '@cjverse/db';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const asParam = url.searchParams.get('as') || url.searchParams.get('userId');

  let buyerId: string | undefined;

  if (asParam) {
    const dev = getDevSessionFromQuery(asParam);
    if (dev?.isValid && dev.userId) {
      buyerId = dev.userId;
    }
  }

  if (!buyerId) {
    const cookie = request.cookies.get('cjverse_session')?.value;
    if (cookie) {
      const session = validateSessionToken(cookie);
      if (session.isValid && session.userId) {
        buyerId = session.userId;
      }
    }
  }

  if (!buyerId) {
    return NextResponse.json({ error: 'Unauthorized. Please login to purchase cards.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { listingId } = body;

    if (!listingId || typeof listingId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid listingId' }, { status: 400 });
    }

    const result = await buyMarketListing({
      buyerId,
      listingId: listingId.trim().toUpperCase(),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      cardName: result.cardName,
      price: result.price,
      buyerCrystalsRemaining: result.buyerCrystalsRemaining,
    });
  } catch (err) {
    console.error('[API /api/market/buy Error]:', err);
    return NextResponse.json({ error: 'Internal server error processing purchase' }, { status: 500 });
  }
}
