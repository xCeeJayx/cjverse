import { UserActiveLineup } from '../schema/users';

export function validateLineup(lineup: UserActiveLineup): { valid: boolean; error?: string } {
  const slots = [lineup.vanguardCardId, lineup.strikerCardId, lineup.conduitCardId].filter(
    (id): id is string => Boolean(id)
  );

  const uniqueSlots = new Set(slots);
  if (uniqueSlots.size !== slots.length) {
    return {
      valid: false,
      error: 'Duplicate card IDs found in active lineup.'
    };
  }

  return { valid: true };
}

export function isLineupComplete(lineup: UserActiveLineup): boolean {
  return Boolean(lineup.vanguardCardId && lineup.strikerCardId && lineup.conduitCardId);
}
