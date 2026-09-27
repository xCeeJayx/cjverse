import { CardRecord } from '@cjverse/db';

/**
 * Sanitizes user-inputted card IDs by removing any accidental '#' symbols,
 * trimming leading/trailing whitespace, and normalizing to uppercase.
 */
export function sanitizeCardIdInput(inputId: string): string {
  if (!inputId) return '';
  return inputId.replace(/#/g, '').trim().toUpperCase();
}

/**
 * Finds a matching card in the user's inventory by case-insensitive 6-character ID match,
 * or prefix match for user flexibility.
 */
export function resolveCardById(userCards: CardRecord[], inputId: string): CardRecord | undefined {
  const cleanInput = sanitizeCardIdInput(inputId);
  if (!cleanInput) return undefined;

  return userCards.find((c) => {
    const cardIdUpper = (c.id || '').toUpperCase();
    return cardIdUpper === cleanInput || cardIdUpper.startsWith(cleanInput);
  });
}

/**
 * Generates the standardized not-found error message for card IDs.
 */
export function getCardNotFoundError(inputId: string): string {
  const cleanInput = sanitizeCardIdInput(inputId) || inputId;
  return `Card ${cleanInput} was not found in your inventory. Use /inventory to view your 6-character card IDs.`;
}
