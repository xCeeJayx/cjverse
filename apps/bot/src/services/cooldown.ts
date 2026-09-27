const cooldownMap = new Map<string, number>();

export const HUNT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export function checkAndSetCooldown(userId: string, durationMs: number = HUNT_COOLDOWN_MS): { allowed: boolean; remainingMs: number } {
  const now = Date.now();
  const expiresAt = cooldownMap.get(userId) || 0;

  if (now < expiresAt) {
    return {
      allowed: false,
      remainingMs: expiresAt - now
    };
  }

  cooldownMap.set(userId, now + durationMs);
  return {
    allowed: true,
    remainingMs: 0
  };
}

export function resetCooldowns() {
  cooldownMap.clear();
}
