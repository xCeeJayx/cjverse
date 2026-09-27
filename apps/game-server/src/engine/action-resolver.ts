import { calculateDamage } from '@cjverse/game-logic';
import { ActionType, ActionResolvedPayload } from '../types/protocol';

export function resolveAction(
  actionType: ActionType,
  actor: { id: string; atk: number; currentMana: number; element?: string },
  target: { id: string; def: number; currentHp: number }
): ActionResolvedPayload {
  let cost = 0;
  let multiplier = 1.0;

  if (actionType === 'ELEMENTAL_BURST') {
    cost = 30;
    multiplier = 1.8;
  } else if (actionType === 'ULTIMATE') {
    cost = 70;
    multiplier = 3.0;
  }

  // Check mana and fallback to basic attack if insufficient
  if (actor.currentMana < cost) {
    cost = 0;
    multiplier = 1.0;
  }

  actor.currentMana = Math.max(0, actor.currentMana - cost);

  const damage = calculateDamage(actor.atk, multiplier, 1.0, target.def);
  target.currentHp = Math.max(0, target.currentHp - damage);

  return {
    actorCardId: actor.id,
    targetCardId: target.id,
    damage,
    isCrit: false,
    targetRemainingHp: target.currentHp,
    animations: actionType === 'BASIC_ATTACK' ? ['SLASH'] : ['SPARK_BURST', 'SHAKE']
  };
}
