import { ActionType } from '../types/protocol';

export interface CombatCardTarget {
  id: string;
  currentHp: number;
  role?: string;
  element?: string;
}

export function determineFallbackAction(
  actor: { id: string; atk: number; currentMana: number; element?: string },
  enemyTeam: CombatCardTarget[]
): { actionType: ActionType; targetCardId: string } {
  const aliveEnemies = enemyTeam.filter(e => e.currentHp > 0);
  if (aliveEnemies.length === 0) {
    return { actionType: 'BASIC_ATTACK', targetCardId: '' };
  }

  // 1. Lowest HP enemy that can be executed
  const sortedByHp = [...aliveEnemies].sort((a, b) => a.currentHp - b.currentHp);
  const target = sortedByHp[0];

  const actionType: ActionType =
    actor.currentMana >= 70 ? 'ULTIMATE' : actor.currentMana >= 30 ? 'ELEMENTAL_BURST' : 'BASIC_ATTACK';

  return {
    actionType,
    targetCardId: target.id
  };
}
