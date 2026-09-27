export interface DuelResult {
  success: boolean;
  roomId?: string;
  arenaUrl?: string;
  error?: string;
}

export function handleDuelCommand(
  challengerId: string,
  targetId: string,
  isTargetBot: boolean,
  challengerLineupComplete: boolean,
  targetLineupComplete: boolean
): DuelResult {
  if (challengerId === targetId) {
    return {
      success: false,
      error: 'Challenger and opponent must be distinct users.'
    };
  }

  if (isTargetBot) {
    return {
      success: false,
      error: 'Cannot challenge a bot to a duel.'
    };
  }

  if (!challengerLineupComplete) {
    return {
      success: false,
      error: 'You must have all 3 cards in active lineup before dueling.'
    };
  }

  if (!targetLineupComplete) {
    return {
      success: false,
      error: 'Opponent must have all 3 cards in active lineup before dueling.'
    };
  }

  // Generate unique room ID
  const roomId = Math.random().toString(36).substring(2, 10);
  const arenaUrl = `https://cjverse.me/duel/${roomId}`;

  return {
    success: true,
    roomId,
    arenaUrl
  };
}
