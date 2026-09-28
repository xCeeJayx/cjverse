import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getCardImage } from '../src/app/api/cards/[id]/image/route';
import { db, users, cards, eq } from '@cjverse/db';

describe('Web Card Image API Endpoint (/api/cards/[id]/image)', () => {
  const testUserId = 'web-card-image-user';
  const testCardId = 'IMG999';

  beforeEach(async () => {
    await db.delete(cards).where(eq(cards.id, testCardId));
    await db.delete(users).where(eq(users.id, testUserId));

    await db.insert(users).values({
      id: testUserId,
      username: 'ArtCollector',
      crystals: 100,
    });

    await db.insert(cards).values({
      id: testCardId,
      userId: testUserId,
      race: 'Dragon',
      variant: 'Diamond',
      element: 'fire',
      elementTier: 'Legendary',
      evolutionStage: 2,
      level: 15,
      powerScore: 850,
      seed: 123456,
    });
  });

  it('returns 404 if the card does not exist', async () => {
    const mockReq: any = {
      url: 'http://localhost:3000/api/cards/NONEXIST/image',
    };

    const res = await getCardImage(mockReq, { params: { id: 'NONEXIST' } });
    expect(res.status).toBe(404);
  });

  it('generates composited PNG with Cache-Control header and valid PNG signature', async () => {
    const mockReq: any = {
      url: `http://localhost:3000/api/cards/${testCardId}/image`,
    };

    const res = await getCardImage(mockReq, { params: { id: testCardId } });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toContain('max-age=86400');

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // PNG signature: 137 80 78 71 13 10 26 10
    expect(buffer.slice(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  });
});
