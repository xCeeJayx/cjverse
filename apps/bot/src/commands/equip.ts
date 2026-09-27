import dotenv from 'dotenv';
import path from 'node:path';
import { db, users, cards, UserActiveLineup, CardRecord, eq } from '@cjverse/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export type LineupSlot = 'vanguard' | 'striker' | 'conduit';

export interface EquipResult {
  success: boolean;
  error?: string;
  card?: CardRecord;
  lineup?: UserActiveLineup;
  slot?: LineupSlot;
  embedData?: {
    vanguardCardName: string;
    strikerCardName: string;
    conduitCardName: string;
  };
}

export async function handleEquipCommand(
  userId: string,
  slot: string,
  cardIdPrefix: string
): Promise<EquipResult> {
  const cleanSlot = slot.toLowerCase() as LineupSlot;
  if (!['vanguard', 'striker', 'conduit'].includes(cleanSlot)) {
    return {
      success: false,
      error: `Invalid slot "${slot}". Valid slots are "vanguard", "striker", or "conduit".`,
    };
  }

  try {
    // 1. Fetch user by userId (auto-insert if missing)
    let [userRecord] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userRecord) {
      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          username: userId,
          crystals: 100,
          activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null },
        })
        .returning();
      userRecord = newUser;
    }

    // Query all cards belonging to the user
    const userCards = await db.select().from(cards).where(eq(cards.userId, userId));
    if (!userCards || userCards.length === 0) {
      return {
        success: false,
        error: "You don't own any cards yet! Use `/hunt` to discover your first card before equipping.",
      };
    }

    // 2. Find the requested card by checking card.id (prefix or full match)
    const cleanPrefix = cardIdPrefix.trim().toLowerCase().replace(/^#/, '');
    const targetCard = userCards.find((c) => {
      const id = c.id.toLowerCase();
      return id === cleanPrefix || id.startsWith(cleanPrefix);
    });

    // 3. Return an error if card is not found or does not belong to user
    if (!targetCard) {
      return {
        success: false,
        error: `Card matching "${cardIdPrefix}" was not found in your inventory. Use \`/inventory\` to view your card IDs.`,
      };
    }

    // 4. Ensure card cannot be equipped in multiple slots simultaneously
    const currentLineup: UserActiveLineup = (userRecord?.activeLineup as UserActiveLineup) || {
      vanguardCardId: null,
      strikerCardId: null,
      conduitCardId: null,
    };

    const newLineup: UserActiveLineup = { ...currentLineup };

    // Clear slot if card is already equipped elsewhere
    if (newLineup.vanguardCardId === targetCard.id) {
      newLineup.vanguardCardId = null;
    }
    if (newLineup.strikerCardId === targetCard.id) {
      newLineup.strikerCardId = null;
    }
    if (newLineup.conduitCardId === targetCard.id) {
      newLineup.conduitCardId = null;
    }

    // Assign card to target slot
    if (cleanSlot === 'vanguard') {
      newLineup.vanguardCardId = targetCard.id;
    } else if (cleanSlot === 'striker') {
      newLineup.strikerCardId = targetCard.id;
    } else if (cleanSlot === 'conduit') {
      newLineup.conduitCardId = targetCard.id;
    }

    // 5. Update users.activeLineup in Supabase with new slot assignments
    await db.update(users).set({ activeLineup: newLineup }).where(eq(users.id, userId));

    const getCardLabel = (cardId: string | null) => {
      if (!cardId) return '*[Empty Slot]*';
      const found = userCards.find((c) => c.id === cardId);
      if (!found) return `\`#${cardId.slice(0, 8)}\``;
      return `\`#${found.id.slice(0, 8)}\` **${found.variant.toUpperCase()} ${found.race.toUpperCase()}** (${found.element}, Power: ${found.powerScore})`;
    };

    return {
      success: true,
      card: targetCard,
      lineup: newLineup,
      slot: cleanSlot,
      embedData: {
        vanguardCardName: getCardLabel(newLineup.vanguardCardId),
        strikerCardName: getCardLabel(newLineup.strikerCardId),
        conduitCardName: getCardLabel(newLineup.conduitCardId),
      },
    };
  } catch (err) {
    console.error('[Equip Command Error]:', err);
    return {
      success: false,
      error: 'A database error occurred while updating your lineup. Please try again.',
    };
  }
}
