import {
  calculateDamage,
  StatusEffectType,
  StatusEffect,
  applyStatusEffect,
  modifyIncomingDamageWithStatus,
  processActionBleed,
  ResonanceBuff,
} from '@cjverse/game-logic';
import { ActionType, ActionResolvedPayload } from '../types/protocol';

export interface CombatActor {
  id: string;
  name?: string;
  atk: number;
  currentMana: number;
  maxMana?: number;
  currentHp?: number;
  maxHp?: number;
  element?: string;
  statusEffects?: StatusEffect[];
  playerId?: string;
  critBonus?: number;
  lifesteal?: number;
}

export interface CombatTarget {
  id: string;
  name?: string;
  def: number;
  currentHp: number;
  maxHp?: number;
  currentMana?: number;
  maxMana?: number;
  statusEffects?: StatusEffect[];
  isAlive?: boolean;
}

export interface ResolveActionOptions {
  teamResonance?: ResonanceBuff[];
  forceStatusSuccess?: boolean; // Useful for deterministic testing
  forceCrit?: boolean;
}

export function getElementStatusEffect(element?: string): StatusEffectType {
  const elem = (element || '').toLowerCase().trim();
  switch (elem) {
    case 'fire':
      return 'burn';
    case 'ice':
      return 'freeze';
    case 'lightning':
      return 'shock';
    case 'blood':
    case 'poison':
      return 'bleed';
    case 'void':
    case 'time':
    case 'chaos':
      return 'void_siphon';
    case 'arcane':
    case 'light':
      return 'divine_shield';
    default:
      return 'burn';
  }
}

export function resolveAction(
  actionType: ActionType,
  actor: CombatActor,
  target: CombatTarget,
  options?: ResolveActionOptions
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

  // If basic attack, generate 10 mana
  if (cost === 0 && actionType === 'BASIC_ATTACK') {
    const maxM = actor.maxMana || 100;
    actor.currentMana = Math.min(maxM, actor.currentMana + 10);
  }

  // 1. Process Bleed on actor performing action
  if (actor.statusEffects && actor.statusEffects.length > 0) {
    processActionBleed(actor as any);
  }

  // 2. Base Damage Calculation
  let damage = calculateDamage(actor.atk, multiplier, 1.0, target.def);

  // 3. Critical Hit Check
  const critChance = (actor.critBonus ?? 0.05);
  const isCrit = options?.forceCrit ?? Math.random() < critChance;
  if (isCrit) {
    damage = Math.floor(damage * 1.5);
  }

  // 4. Modify Damage with Target Status Effects (Shock amplification & Divine Shield absorption)
  const statusMod = modifyIncomingDamageWithStatus(target, damage);
  const finalDamage = statusMod.finalDamage;
  target.currentHp = Math.max(0, target.currentHp - finalDamage);

  // 5. Lifesteal (e.g. from Shadow Resonance on Basic Attack)
  let lifestealHealed = 0;
  if (actor.lifesteal && actionType === 'BASIC_ATTACK' && finalDamage > 0) {
    lifestealHealed = Math.floor(finalDamage * actor.lifesteal);
    const maxH = actor.maxHp || 1000;
    actor.currentHp = Math.min(maxH, (actor.currentHp ?? maxH) + lifestealHealed);
  }

  // 6. Status Effect Application
  let statusApplied: StatusEffect | undefined;
  const statusType = getElementStatusEffect(actor.element);

  if (actionType === 'ELEMENTAL_BURST') {
    // 60% chance to inflict signature status effect
    const shouldApply = options?.forceStatusSuccess ?? Math.random() < 0.6;
    if (shouldApply) {
      if (statusType === 'divine_shield') {
        // Divine Shield applies to self/actor
        const res = applyStatusEffect(actor as any, 'divine_shield', 2);
        statusApplied = res.effect;
      } else {
        const res = applyStatusEffect(
          target,
          statusType,
          2,
          undefined,
          actor.id,
          actor.playerId
        );
        statusApplied = res.effect;
      }
    }
  } else if (actionType === 'ULTIMATE') {
    // 100% chance to inflict enhanced status effect (3-turn duration)
    if (statusType === 'divine_shield') {
      const res = applyStatusEffect(actor as any, 'divine_shield', 3);
      statusApplied = res.effect;
    } else {
      const res = applyStatusEffect(
        target,
        statusType,
        3,
        undefined,
        actor.id,
        actor.playerId
      );
      statusApplied = res.effect;
    }
  }

  const animations: string[] = [];
  if (actionType === 'BASIC_ATTACK') {
    animations.push('SLASH');
  } else if (actionType === 'ELEMENTAL_BURST') {
    animations.push('SPARK_BURST', 'SHAKE');
  } else {
    animations.push('HEAVY_SLAM', 'SCREEN_FLASH', 'SHAKE');
  }

  if (isCrit) animations.push('CRIT_IMPACT');
  if (statusApplied) animations.push(`STATUS_${statusApplied.type.toUpperCase()}`);

  return {
    actorCardId: actor.id,
    targetCardId: target.id,
    damage: finalDamage,
    isCrit,
    targetRemainingHp: target.currentHp,
    animations,
    statusApplied,
    shieldAbsorbed: statusMod.shieldAbsorbed,
    lifestealHealed,
  };
}
