import { NextRequest, NextResponse } from 'next/server';
import { findActiveListings } from '@cjverse/db';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const element = url.searchParams.get('element') || undefined;
  const variant = url.searchParams.get('variant') || undefined;
  const maxPriceParam = url.searchParams.get('maxPrice');
  const maxPrice = maxPriceParam ? parseInt(maxPriceParam, 10) : undefined;
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = Math.max(0, (page - 1) * limit);

  try {
    const listings = await findActiveListings({
      element,
      variant,
      maxPrice: Number.isNaN(maxPrice) ? undefined : maxPrice,
      limit,
      offset,
    });

    return NextResponse.json({
      listings,
      total: listings.length,
      page,
      limit,
    });
  } catch (err) {
    console.error('[API /api/market Error]:', err);
    return NextResponse.json({ error: 'Failed to retrieve market listings' }, { status: 500 });
  }
}
