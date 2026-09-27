import { UserActiveLineup } from '@cjverse/db';

export function formatCardLineupTag(cardId: string, lineup: UserActiveLineup): string {
  if (lineup.vanguardCardId === cardId) return '[VANGUARD]';
  if (lineup.strikerCardId === cardId) return '[STRIKER]';
  if (lineup.conduitCardId === cardId) return '[CONDUIT]';
  return '';
}

export function paginateCards<T>(cards: T[], page: number = 1, pageSize: number = 5): {
  pageCards: T[];
  totalPages: number;
  currentPage: number;
} {
  const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, page));
  const startIndex = (currentPage - 1) * pageSize;
  const pageCards = cards.slice(startIndex, startIndex + pageSize);

  return {
    pageCards,
    totalPages,
    currentPage
  };
}
