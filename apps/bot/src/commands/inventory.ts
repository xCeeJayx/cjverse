import dotenv from 'dotenv';
import path from 'node:path';
import { db, users, cards, UserActiveLineup, CardRecord, eq } from '@cjverse/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export function formatCardLineupTag(cardId: string, lineup?: UserActiveLineup | null): string {
  if (!lineup) return '';
  if (lineup.vanguardCardId === cardId) return '[VANGUARD]';
  if (lineup.strikerCardId === cardId) return '[STRIKER]';
  if (lineup.conduitCardId === cardId) return '[CONDUIT]';
  return '';
}

export function paginateCards<T>(
  cardsList: T[],
  page: number = 1,
  pageSize: number = 5
): {
  pageCards: T[];
  totalPages: number;
  currentPage: number;
} {
  const totalPages = Math.max(1, Math.ceil(cardsList.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, page));
  const startIndex = (currentPage - 1) * pageSize;
  const pageCards = cardsList.slice(startIndex, startIndex + pageSize);

  return {
    pageCards,
    totalPages,
    currentPage,
  };
}

export interface InventoryQueryResult {
  isEmpty: boolean;
  cards: CardRecord[];
  totalCards: number;
  currentPage?: number;
  totalPages?: number;
  lineup?: UserActiveLineup;
  empty?: boolean;
  success?: boolean;
  message?: string;
  pageCards?: CardRecord[];
}

export async function handleInventoryCommand(
  userId: string,
  pageOrUsername?: number | string,
  maybePage?: number
): Promise<InventoryQueryResult> {
  const page =
    typeof pageOrUsername === 'number'
      ? pageOrUsername
      : typeof maybePage === 'number'
      ? maybePage
      : 1;
  // 1. Query users by userId to obtain their current activeLineup
  let lineup: UserActiveLineup = {
    vanguardCardId: null,
    strikerCardId: null,
    conduitCardId: null,
  };

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user?.activeLineup) {
      lineup = user.activeLineup as UserActiveLineup;
    }
  } catch (err) {
    console.error('[Inventory Command Error - User Query]:', err);
  }

  // 2. Query cards by eq(cards.userId, userId) from Supabase
  let allCards: CardRecord[] = [];
  try {
    allCards = await db
      .select()
      .from(cards)
      .where(eq(cards.userId, userId));
  } catch (err) {
    console.error('[Inventory Command Error - Cards Query]:', err);
  }

  // 3. If 0 cards are returned, return { isEmpty: true, cards: [], totalCards: 0 }
  if (!allCards || allCards.length === 0) {
    return {
      isEmpty: true,
      cards: [],
      totalCards: 0,
      empty: true,
      success: true,
      message: "You don't own any cards yet! Use `/hunt` to discover your first card.",
      pageCards: [],
      currentPage: 1,
      totalPages: 1,
      lineup,
    };
  }

  // 4. Paginate cards (5 cards per page)
  const { pageCards, totalPages, currentPage } = paginateCards(allCards, page, 5);

  return {
    isEmpty: false,
    cards: pageCards,
    totalCards: allCards.length,
    currentPage,
    totalPages,
    lineup,
    empty: false,
    success: true,
    pageCards,
  };
}
