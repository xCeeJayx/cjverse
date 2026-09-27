import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, getDevSessionFromQuery } from '../../../../lib/auth-session';
import {
  findUserById,
  ensureUser,
  findCardById,
  UserActiveLineup,
  db,
  users,
  eq,
} from '@cjverse/db';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const asParam = url.searchParams.get('as') || url.searchParams.get('userId');

  let userId: string | undefined;
  let username: string | undefined;

  if (asParam) {
    const dev = getDevSessionFromQuery(asParam);
    if (dev?.isValid && dev.userId) {
      userId = dev.userId;
      username = dev.username;
    }
  }

  if (!userId) {
    const cookie = request.cookies.get('cjverse_session')?.value;
    if (cookie) {
      const session = validateSessionToken(cookie);
      if (session.isValid && session.userId) {
        userId = session.userId;
        username = session.username;
      }
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Also support dev testing userId in body if not in query/cookie
  if (
    !userId &&
    body?.userId &&
    (body.userId.startsWith('dev-') || process.env.NODE_ENV !== 'production')
  ) {
    userId = body.userId;
    username = body.username || body.userId;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slot, cardId } = body;
  const cleanSlot = typeof slot === 'string' ? slot.toLowerCase() : '';

  if (!['vanguard', 'striker', 'conduit'].includes(cleanSlot)) {
    return NextResponse.json(
      { error: `Invalid slot "${slot}". Valid slots are "vanguard", "striker", or "conduit".` },
      { status: 400 }
    );
  }

  try {
    let user = await findUserById(userId);
    if (!user) {
      user = await ensureUser(userId, username || userId);
    }

    // If cardId is provided, validate that the card exists and belongs to the authenticated user
    if (cardId !== null && cardId !== undefined) {
      if (typeof cardId !== 'string') {
        return NextResponse.json({ error: 'cardId must be a string or null' }, { status: 400 });
      }

      const card = await findCardById(cardId);
      if (!card || card.userId !== userId) {
        return NextResponse.json(
          { error: 'Card not found or does not belong to user' },
          { status: 403 }
        );
      }
    }

    const currentLineup: UserActiveLineup = user.activeLineup || {
      vanguardCardId: null,
      strikerCardId: null,
      conduitCardId: null,
    };

    const newLineup: UserActiveLineup = { ...currentLineup };

    // If cardId is provided, clear it from any other slot first to prevent duplicate cards in lineup
    if (cardId) {
      if (newLineup.vanguardCardId === cardId) newLineup.vanguardCardId = null;
      if (newLineup.strikerCardId === cardId) newLineup.strikerCardId = null;
      if (newLineup.conduitCardId === cardId) newLineup.conduitCardId = null;
    }

    // Assign cardId (or null to unequip) to the target slot
    if (cleanSlot === 'vanguard') {
      newLineup.vanguardCardId = cardId || null;
    } else if (cleanSlot === 'striker') {
      newLineup.strikerCardId = cardId || null;
    } else if (cleanSlot === 'conduit') {
      newLineup.conduitCardId = cardId || null;
    }

    // Update users.activeLineup in Supabase
    await db.update(users).set({ activeLineup: newLineup }).where(eq(users.id, userId));

    return NextResponse.json({
      success: true,
      lineup: newLineup,
      slot: cleanSlot,
      cardId: cardId || null,
    });
  } catch (err) {
    console.error('[API /api/user/lineup Error]:', err);
    return NextResponse.json({ error: 'Failed to update lineup' }, { status: 500 });
  }
}
