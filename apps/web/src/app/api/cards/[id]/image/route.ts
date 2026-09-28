import { NextRequest, NextResponse } from 'next/server';
import { findCardById } from '@cjverse/db';
import { renderCardComposite } from '@cjverse/asset-pipeline';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const cardId = params.id?.replace(/^#/, '').trim().toUpperCase();
    if (!cardId) {
      return new NextResponse('Card ID missing', { status: 400 });
    }

    const card = await findCardById(cardId);
    if (!card) {
      return new NextResponse('Card not found', { status: 404 });
    }

    const pngBuffer = await renderCardComposite({
      id: card.id,
      race: card.race as any,
      variant: card.variant as any,
      element: card.element,
      elementTier: card.elementTier as any,
      evolutionStage: card.evolutionStage,
      level: card.level,
      powerScore: card.powerScore,
      seed: card.seed,
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('[Card Image API Error]:', err);
    return new NextResponse('Failed to generate card image', { status: 500 });
  }
}
