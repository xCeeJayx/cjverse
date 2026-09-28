export type StatusEffectType =
  | 'burn'
  | 'freeze'
  | 'shock'
  | 'bleed'
  | 'void_siphon'
  | 'divine_shield';

export interface StatusEffect {
  id: string;
  type: StatusEffectType;
  duration: number; // Remaining turns
  potency: number; // e.g. 0.05 for 5% burn, 1.20 for shock, shield absorption amount
  sourceCardId?: string;
  sourcePlayerId?: string;
  name: string;
  icon: string;
  badge: string; // e.g. '🔥 2T'
}

export const STATUS_EFFECT_CONFIG: Record<
  StatusEffectType,
  {
    name: string;
    icon: string;
    defaultDuration: number;
    defaultPotency: number;
    description: string;
  }
> = {
  burn: {
    name: 'Burn',
    icon: '🔥',
    defaultDuration: 2,
    defaultPotency: 0.05, // 5% max HP damage
    description: 'Deals 5% max HP damage at the start of each turn.',
  },
  freeze: {
    name: 'Freeze',
    icon: '❄️',
    defaultDuration: 1,
    defaultPotency: 0.5, // 50% chance to skip turn
    description: '50% chance to skip turn; breaks upon taking heavy physical damage.',
  },
  shock: {
    name: 'Shock',
    icon: '⚡',
    defaultDuration: 2,
    defaultPotency: 0.2, // +20% damage taken
    description: 'Increases damage taken from all subsequent hits by 20%.',
  },
  bleed: {
    name: 'Bleed',
    icon: '🩸',
    defaultDuration: 3,
    defaultPotency: 1, // Stacking counter
    description: 'Stacking damage-over-time that ticks when performing an action.',
  },
  void_siphon: {
    name: 'Void Siphon',
    icon: '🌀',
    defaultDuration: 2,
    defaultPotency: 10, // 10 MP stolen
    description: 'Steals 10 MP from the target and transfers it to the attacker.',
  },
  divine_shield: {
    name: 'Divine Shield',
    icon: '🛡️',
    defaultDuration: 2,
    defaultPotency: 250, // Absorbs up to 25% max HP
    description: 'Absorbs incoming damage up to 25% of max HP.',
  },
};

export interface TargetCardState {
  id: string;
  name?: string;
  currentHp: number;
  maxHp?: number;
  currentMana?: number;
  maxMana?: number;
  statusEffects?: StatusEffect[];
  isAlive?: boolean;
}

/**
 * Applies or refreshes a combat status effect on a target card.
 */
export function applyStatusEffect(
  target: TargetCardState,
  effectType: StatusEffectType,
  duration?: number,
  potency?: number,
  sourceCardId?: string,
  sourcePlayerId?: string
): {
  applied: boolean;
  effect: StatusEffect;
  message: string;
} {
  if (!target.statusEffects) {
    target.statusEffects = [];
  }

  const config = STATUS_EFFECT_CONFIG[effectType];
  const dur = duration !== undefined ? duration : config.defaultDuration;
  let pot = potency !== undefined ? potency : config.defaultPotency;

  if (effectType === 'divine_shield' && potency === undefined) {
    pot = Math.max(50, Math.floor((target.maxHp ?? 1000) * 0.25));
  }

  const existingIdx = target.statusEffects.findIndex((e) => e.type === effectType);

  if (existingIdx !== -1) {
    const existing = target.statusEffects[existingIdx];
    if (effectType === 'bleed') {
      // Stacking bleed: increment potency stack, reset duration
      existing.potency += 1;
      existing.duration = Math.max(existing.duration, dur);
      existing.badge = `${config.icon} x${existing.potency}`;
      return {
        applied: true,
        effect: existing,
        message: `${target.name || 'Card'} bleed intensified to x${existing.potency} stacks!`,
      };
    }

    if (effectType === 'divine_shield') {
      existing.potency = Math.max(existing.potency, pot);
      existing.duration = Math.max(existing.duration, dur);
      existing.badge = `${config.icon} ${existing.duration}T`;
      return {
        applied: true,
        effect: existing,
        message: `${target.name || 'Card'} Divine Shield was refreshed!`,
      };
    }

    // Refresh duration
    existing.duration = Math.max(existing.duration, dur);
    existing.badge = `${config.icon} ${existing.duration}T`;
    return {
      applied: true,
      effect: existing,
      message: `${target.name || 'Card'} ${config.name} was refreshed for ${existing.duration} turns!`,
    };
  }

  const newEffect: StatusEffect = {
    id: `${effectType}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: effectType,
    duration: dur,
    potency: pot,
    sourceCardId,
    sourcePlayerId,
    name: config.name,
    icon: config.icon,
    badge: `${config.icon} ${dur}T`,
  };

  target.statusEffects.push(newEffect);

  return {
    applied: true,
    effect: newEffect,
    message: `${target.name || 'Card'} was afflicted with ${config.name} (${dur} Turns)!`,
  };
}

/**
 * Resolves turn-start damage-over-time, MP drain, and turn skips.
 * Decrements duration and purges expired status effects.
 */
export function processTurnStartEffects(
  card: TargetCardState,
  allCards?: Array<{ id: string; currentMana: number; maxMana?: number; isAlive?: boolean }>
): {
  totalDamage: number;
  mpStolen: number;
  skippedTurn: boolean;
  expiredEffects: StatusEffect[];
  logs: string[];
} {
  const logs: string[] = [];
  let totalDamage = 0;
  let mpStolen = 0;
  let skippedTurn = false;
  const expiredEffects: StatusEffect[] = [];

  if (!card.statusEffects || card.statusEffects.length === 0) {
    return { totalDamage: 0, mpStolen: 0, skippedTurn: false, expiredEffects: [], logs: [] };
  }

  const cardName = card.name || `Unit ${card.id}`;

  for (const effect of card.statusEffects) {
    if (effect.type === 'burn') {
      const maxH = card.maxHp ?? 1000;
      const burnDmg = Math.max(1, Math.floor(maxH * (effect.potency || 0.05)));
      card.currentHp = Math.max(0, card.currentHp - burnDmg);
      totalDamage += burnDmg;
      logs.push(`🔥 ${cardName} took ${burnDmg} Burn damage!`);
    }

    if (effect.type === 'void_siphon') {
      const curM = card.currentMana ?? 0;
      const drainAmt = Math.min(curM, effect.potency || 10);
      if (drainAmt > 0) {
        card.currentMana = Math.max(0, curM - drainAmt);
        mpStolen += drainAmt;

        // Credit to attacker if provided
        if (effect.sourceCardId && allCards) {
          const source = allCards.find((c) => c.id === effect.sourceCardId);
          if (source && (source.isAlive ?? true)) {
            const maxM = source.maxMana || 100;
            source.currentMana = Math.min(maxM, source.currentMana + drainAmt);
          }
        }
        logs.push(`🌀 Void Siphon drained ${drainAmt} MP from ${cardName}!`);
      }
    }

    if (effect.type === 'freeze') {
      // 50% chance to skip turn
      const roll = Math.random();
      if (roll < (effect.potency ?? 0.5)) {
        skippedTurn = true;
        logs.push(`❄️ ${cardName} is frozen solid and cannot move!`);
      }
    }

    // Decrement turn duration
    effect.duration -= 1;
    effect.badge = `${STATUS_EFFECT_CONFIG[effect.type]?.icon || '✨'} ${effect.duration}T`;
  }

  // Purge expired effects
  const activeEffects: StatusEffect[] = [];
  for (const effect of card.statusEffects) {
    if (effect.duration <= 0) {
      expiredEffects.push(effect);
      logs.push(`✨ ${cardName}'s ${effect.name} wore off.`);
    } else {
      activeEffects.push(effect);
    }
  }
  card.statusEffects = activeEffects;

  if (card.currentHp <= 0) {
    card.isAlive = false;
    card.currentHp = 0;
    logs.push(`💀 ${cardName} succumbed to status ailments!`);
  }

  return {
    totalDamage,
    mpStolen,
    skippedTurn,
    expiredEffects,
    logs,
  };
}

/**
 * Resolves bleed damage whenever an afflicted card executes an action.
 */
export function processActionBleed(card: TargetCardState): {
  damage: number;
  log?: string;
} {
  if (!card.statusEffects || card.statusEffects.length === 0) {
    return { damage: 0 };
  }

  const bleedEffect = card.statusEffects.find((e) => e.type === 'bleed');
  if (!bleedEffect) return { damage: 0 };

  const stacks = bleedEffect.potency || 1;
  const maxH = card.maxHp ?? 1000;
  const bleedDmg = Math.max(1, Math.floor(maxH * 0.03 * stacks));
  card.currentHp = Math.max(0, card.currentHp - bleedDmg);

  if (card.currentHp <= 0) {
    card.isAlive = false;
    card.currentHp = 0;
  }

  const log = `🩸 ${card.name || 'Card'} bled for ${bleedDmg} DMG on action (x${stacks} stacks)!`;
  return { damage: bleedDmg, log };
}

/**
 * Resolves Divine Shield damage absorption and Shock damage amplification.
 */
export function modifyIncomingDamageWithStatus(
  target: TargetCardState,
  incomingDamage: number
): {
  finalDamage: number;
  shieldAbsorbed: number;
  shieldBroken: boolean;
  shockBonus: number;
  logs: string[];
} {
  const logs: string[] = [];
  let damage = incomingDamage;
  let shockBonus = 0;
  let shieldAbsorbed = 0;
  let shieldBroken = false;

  if (!target.statusEffects || target.statusEffects.length === 0) {
    return { finalDamage: damage, shieldAbsorbed: 0, shieldBroken: false, shockBonus: 0, logs };
  }

  // 1. Shock effect: +20% damage taken
  const shock = target.statusEffects.find((e) => e.type === 'shock');
  if (shock) {
    shockBonus = Math.floor(damage * (shock.potency || 0.2));
    damage += shockBonus;
    logs.push(`⚡ Shock amplified damage by +${shockBonus}!`);
  }

  // 2. Divine Shield: absorbs up to shield potency
  const shieldIdx = target.statusEffects.findIndex((e) => e.type === 'divine_shield');
  if (shieldIdx !== -1) {
    const shield = target.statusEffects[shieldIdx];
    if (damage <= shield.potency) {
      shieldAbsorbed = damage;
      shield.potency -= damage;
      damage = 0;
      logs.push(`🛡️ Divine Shield absorbed ${shieldAbsorbed} damage! (${shield.potency} shield remaining)`);
      if (shield.potency <= 0) {
        target.statusEffects.splice(shieldIdx, 1);
        shieldBroken = true;
        logs.push(`🛡️ Divine Shield shattered!`);
      }
    } else {
      shieldAbsorbed = shield.potency;
      damage -= shield.potency;
      target.statusEffects.splice(shieldIdx, 1);
      shieldBroken = true;
      logs.push(`🛡️ Divine Shield absorbed ${shieldAbsorbed} damage and shattered!`);
    }
  }

  // 3. Freeze breaks on heavy physical hit (> 100 DMG)
  const freezeIdx = target.statusEffects.findIndex((e) => e.type === 'freeze');
  if (freezeIdx !== -1 && incomingDamage >= 100) {
    target.statusEffects.splice(freezeIdx, 1);
    logs.push(`❄️ Heavy impact shattered the ice on ${target.name || 'Card'}!`);
  }

  return {
    finalDamage: damage,
    shieldAbsorbed,
    shieldBroken,
    shockBonus,
    logs,
  };
}
