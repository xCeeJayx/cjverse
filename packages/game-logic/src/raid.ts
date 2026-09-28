import { calculateDamage } from './calculator/damage';

export interface RaidBossConfig {
  id?: string;
  name: string;
  element: string;
  totalHp: number;
  currentHp: number;
  atk: number;
  def: number;
  icon?: string;
  weaknesses?: string[];
  description?: string;
}

export interface RaidCombatCard {
  id: string;
  name: string;
  role: 'vanguard' | 'striker' | 'conduit';
  race?: string;
  variant?: string;
  element?: string;
  level?: number;
  maxHp: number;
  currentHp: number;
  atk: number;
  def: number;
  maxMana: number;
  currentMana: number;
  isAlive: boolean;
}

export interface RaidPlayerActionResult {
  cardId: string;
  cardName: string;
  role: string;
  actionType: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE';
  damage: number;
  isCrit: boolean;
  isWeakness: boolean;
  log: string;
}

export interface RaidBossTurnResult {
  actionType: 'CLEAVE' | 'CATACLYSM' | 'ENRAGED_CLEAVE' | 'ENRAGED_CATACLYSM';
  isEnraged: boolean;
  totalDamage: number;
  targetsHit: Array<{ cardId: string; cardName: string; damage: number; remainingHp: number }>;
  log: string;
}

export interface RaidTurnLog {
  turn: number;
  playerActions: RaidPlayerActionResult[];
  bossAction: RaidBossTurnResult;
  damageThisTurn: number;
  cumulativeDamage: number;
  remainingBossHp: number;
}

export interface RaidRunResult {
  bossId?: string;
  bossName: string;
  totalDamageDealt: number;
  turnsElapsed: number;
  survivedAllTurns: boolean;
  teamWiped: boolean;
  finalCards: RaidCombatCard[];
  turnLogs: RaidTurnLog[];
  logs: string[];
}

export const WORLD_BOSS_PRESETS: RaidBossConfig[] = [
  {
    name: 'Abyssal Leviathan',
    element: 'void',
    totalHp: 500000,
    currentHp: 500000,
    atk: 140,
    def: 70,
    icon: '🐙',
    weaknesses: ['Arcane', 'Light'],
    description: 'An ancient dread rising from the endless void, siphoning life from all who dare oppose it.',
  },
  {
    name: 'Infernal Behemoth',
    element: 'fire',
    totalHp: 500000,
    currentHp: 500000,
    atk: 160,
    def: 60,
    icon: '🌋',
    weaknesses: ['Water', 'Ice'],
    description: 'A towering monstrosity of molten magma and brimstone that incinerates battlefields.',
  },
  {
    name: 'Glacial Titan',
    element: 'ice',
    totalHp: 500000,
    currentHp: 500000,
    atk: 120,
    def: 100,
    icon: '❄️',
    weaknesses: ['Fire', 'Chaos'],
    description: 'An unstoppable glacier entity armored in permafrost, crushing all defenses with glacial fury.',
  },
  {
    name: 'Storm Tempest',
    element: 'lightning',
    totalHp: 500000,
    currentHp: 500000,
    atk: 175,
    def: 55,
    icon: '⚡',
    weaknesses: ['Earth', 'Ground', 'Crystal'],
    description: 'A raging storm deity capable of unleashing catastrophic thunder strikes.',
  },
];

/**
 * Returns elemental weakness multiplier against a raid boss.
 */
export function getBossElementalMultiplier(cardElement?: string, bossElement?: string): {
  multiplier: number;
  isWeakness: boolean;
} {
  const cardElem = (cardElement || '').toLowerCase().trim();
  const bossElem = (bossElement || '').toLowerCase().trim();

  // Fire weaknesses
  if (bossElem === 'fire' && (cardElem === 'water' || cardElem === 'ice')) {
    return { multiplier: 1.5, isWeakness: true };
  }

  // Ice weaknesses
  if (bossElem === 'ice' && (cardElem === 'fire' || cardElem === 'chaos')) {
    return { multiplier: 1.5, isWeakness: true };
  }

  // Void weaknesses
  if (bossElem === 'void' && (cardElem === 'arcane' || cardElem === 'light')) {
    return { multiplier: 1.5, isWeakness: true };
  }

  // Lightning weaknesses
  if (bossElem === 'lightning' && (cardElem === 'earth' || cardElem === 'ground' || cardElem === 'crystal')) {
    return { multiplier: 1.5, isWeakness: true };
  }

  return { multiplier: 1.0, isWeakness: false };
}

/**
 * Resolves a single player card's attack against the raid boss.
 */
export function executeRaidPlayerCardAction(
  card: RaidCombatCard,
  boss: RaidBossConfig,
  actionTypeOverride?: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE'
): RaidPlayerActionResult {
  let action: 'BASIC_ATTACK' | 'ELEMENTAL_BURST' | 'ULTIMATE' = actionTypeOverride || 'BASIC_ATTACK';

  // If no action specified, AI chooses optimal skill based on current mana
  if (!actionTypeOverride) {
    if (card.currentMana >= 70) {
      action = 'ULTIMATE';
    } else if (card.currentMana >= 30) {
      action = 'ELEMENTAL_BURST';
    } else {
      action = 'BASIC_ATTACK';
    }
  }

  let manaCost = 0;
  let skillMultiplier = 1.0;

  if (action === 'ELEMENTAL_BURST') {
    manaCost = 30;
    skillMultiplier = 1.8;
  } else if (action === 'ULTIMATE') {
    manaCost = 70;
    skillMultiplier = 3.0;
  }

  if (card.currentMana < manaCost) {
    action = 'BASIC_ATTACK';
    manaCost = 0;
    skillMultiplier = 1.0;
  }

  card.currentMana = Math.max(0, card.currentMana - manaCost);

  if (action === 'BASIC_ATTACK') {
    card.currentMana = Math.min(card.maxMana || 100, card.currentMana + 15);
  }

  // Elemental affinity
  const affinity = getBossElementalMultiplier(card.element, boss.element);

  // Critical hit check (15% base crit)
  const isCrit = Math.random() < 0.15;
  const critMultiplier = isCrit ? 1.5 : 1.0;

  let damage = calculateDamage(card.atk, skillMultiplier, affinity.multiplier, boss.def);
  damage = Math.floor(damage * critMultiplier);

  const critTag = isCrit ? ' 💥 CRITICAL!' : '';
  const weakTag = affinity.isWeakness ? ' 🎯 WEAKNESS HIT!' : '';
  const log = `🗡️ [${card.role.toUpperCase()}] ${card.name} used ${action.replace('_', ' ')} for ${damage} DMG!${critTag}${weakTag}`;

  return {
    cardId: card.id,
    cardName: card.name,
    role: card.role,
    actionType: action,
    damage,
    isCrit,
    isWeakness: affinity.isWeakness,
    log,
  };
}

/**
 * Resolves the Boss's attack for the current turn.
 * 1. Cleave: Heavy physical swipe against Vanguard (or first living unit).
 * 2. Cataclysm (AoE): Hits all 3 cards simultaneously every 3 turns (turn 3, 6, 9).
 * 3. Enrage: After 10 turns, boss damage increases by 300% (4x multiplier).
 */
export function executeRaidBossTurn(
  boss: RaidBossConfig,
  playerCards: RaidCombatCard[],
  turnNumber: number
): RaidBossTurnResult {
  const isEnraged = turnNumber > 10;
  const enrageMult = isEnraged ? 4.0 : 1.0; // 300% increase = 4x base

  const isCataclysm = turnNumber % 3 === 0;
  const targetsHit: Array<{ cardId: string; cardName: string; damage: number; remainingHp: number }> = [];

  const aliveCards = playerCards.filter((c) => c.isAlive && c.currentHp > 0);
  if (aliveCards.length === 0) {
    return {
      actionType: 'CLEAVE',
      isEnraged,
      totalDamage: 0,
      targetsHit: [],
      log: `💀 ${boss.name} looms over the fallen party.`,
    };
  }

  if (isCataclysm) {
    // AoE attack hitting all living cards
    let totalDmg = 0;
    const actionType = isEnraged ? 'ENRAGED_CATACLYSM' : 'CATACLYSM';

    for (const card of aliveCards) {
      const baseDmg = calculateDamage(boss.atk, 1.4 * enrageMult, 1.0, card.def);
      card.currentHp = Math.max(0, card.currentHp - baseDmg);
      if (card.currentHp === 0) {
        card.isAlive = false;
      }
      totalDmg += baseDmg;
      targetsHit.push({
        cardId: card.id,
        cardName: card.name,
        damage: baseDmg,
        remainingHp: card.currentHp,
      });
    }

    const enragePrefix = isEnraged ? '🔥 [ENRAGED] ' : '';
    const log = `⚡ ${enragePrefix}${boss.name} unleashed CATACLYSM on all units for ${totalDmg} total AoE DMG!`;

    return {
      actionType,
      isEnraged,
      totalDamage: totalDmg,
      targetsHit,
      log,
    };
  }

  // Cleave: Targets Vanguard, or first living unit
  const actionType = isEnraged ? 'ENRAGED_CLEAVE' : 'CLEAVE';
  const vanguard = aliveCards.find((c) => c.role === 'vanguard') || aliveCards[0];

  const cleaveDmg = calculateDamage(boss.atk, 1.8 * enrageMult, 1.0, vanguard.def);
  vanguard.currentHp = Math.max(0, vanguard.currentHp - cleaveDmg);
  if (vanguard.currentHp === 0) {
    vanguard.isAlive = false;
  }

  targetsHit.push({
    cardId: vanguard.id,
    cardName: vanguard.name,
    damage: cleaveDmg,
    remainingHp: vanguard.currentHp,
  });

  const enragePrefix = isEnraged ? '🔥 [ENRAGED] ' : '';
  const log = `⚔️ ${enragePrefix}${boss.name} slammed ${vanguard.name} with CLEAVE for ${cleaveDmg} DMG!`;

  return {
    actionType,
    isEnraged,
    totalDamage: cleaveDmg,
    targetsHit,
    log,
  };
}

/**
 * Simulates a full raid encounter (up to 10 turns or until all 3 cards faint).
 * Returns cumulative damage dealt to the boss during the run.
 */
export function simulateRaidRun(
  cards: RaidCombatCard[],
  boss: RaidBossConfig,
  maxTurns = 10
): RaidRunResult {
  // Clone cards to preserve immutability
  const activeCards: RaidCombatCard[] = cards.map((c) => ({
    ...c,
    currentHp: c.currentHp > 0 ? c.currentHp : c.maxHp,
    currentMana: c.currentMana ?? 50,
    isAlive: true,
  }));

  const turnLogs: RaidTurnLog[] = [];
  const logs: string[] = [
    `🚨 RAID BEGUN against [${boss.element.toUpperCase()}] ${boss.name}!`,
  ];

  let cumulativeDamage = 0;
  let turnsElapsed = 0;

  for (let turn = 1; turn <= maxTurns; turn++) {
    turnsElapsed = turn;
    const playerActions: RaidPlayerActionResult[] = [];
    let damageThisTurn = 0;

    // 1. Living player cards strike
    const livingBeforeBoss = activeCards.filter((c) => c.isAlive && c.currentHp > 0);
    if (livingBeforeBoss.length === 0) break;

    for (const card of livingBeforeBoss) {
      const act = executeRaidPlayerCardAction(card, boss);
      playerActions.push(act);
      damageThisTurn += act.damage;
      logs.push(`[Turn ${turn}] ${act.log}`);
    }

    cumulativeDamage += damageThisTurn;

    // 2. Boss executes turn
    const bossTurn = executeRaidBossTurn(boss, activeCards, turn);
    logs.push(`[Turn ${turn}] ${bossTurn.log}`);

    const remainingLiving = activeCards.filter((c) => c.isAlive && c.currentHp > 0);
    for (const dead of activeCards.filter((c) => !c.isAlive)) {
      if (!logs.some((l) => l.includes(`${dead.name} has fallen`))) {
        logs.push(`💀 [${dead.role.toUpperCase()}] ${dead.name} has fallen!`);
      }
    }

    turnLogs.push({
      turn,
      playerActions,
      bossAction: bossTurn,
      damageThisTurn,
      cumulativeDamage,
      remainingBossHp: Math.max(0, boss.currentHp - cumulativeDamage),
    });

    if (remainingLiving.length === 0) {
      logs.push(`☠️ Party was wiped out on Turn ${turn}!`);
      break;
    }
  }

  const teamWiped = activeCards.every((c) => !c.isAlive || c.currentHp <= 0);
  const survivedAllTurns = turnsElapsed >= maxTurns && !teamWiped;

  if (survivedAllTurns) {
    logs.push(`🛡️ Party survived all ${maxTurns} turns against ${boss.name}!`);
  }

  logs.push(`🏆 Run Complete! Total Damage Contributed: ${cumulativeDamage.toLocaleString()} DMG.`);

  return {
    bossId: boss.id,
    bossName: boss.name,
    totalDamageDealt: cumulativeDamage,
    turnsElapsed,
    survivedAllTurns,
    teamWiped,
    finalCards: activeCards,
    turnLogs,
    logs,
  };
}

/**
 * Formats a visual segmented health bar for Discord embeds or text views.
 */
export function formatBossHpBar(currentHp: number, totalHp: number, segments = 20): string {
  const safeTotal = Math.max(1, totalHp);
  const safeCurrent = Math.max(0, Math.min(safeTotal, currentHp));
  const ratio = safeCurrent / safeTotal;
  const filled = Math.round(ratio * segments);
  const empty = segments - filled;
  const pct = (ratio * 100).toFixed(1);

  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] **${pct}%** (${safeCurrent.toLocaleString()} / ${safeTotal.toLocaleString()} HP)`;
}
