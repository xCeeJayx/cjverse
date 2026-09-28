export interface ResonanceBuff {
  id: string;
  name: string;
  badge: string;
  description: string;
  element?: string;
  type: 'dual_element' | 'prismatic';
  atkMultiplier?: number;
  defMultiplier?: number;
  statMultiplier?: number;
  critBonus?: number;
  bonusMaxMana?: number;
  bonusStartingMana?: number;
  lifesteal?: number;
  icon: string;
}

export interface LineupCardItem {
  id?: string;
  element?: string;
  race?: string;
  variant?: string;
  [key: string]: any;
}

/**
 * Calculates active team resonance passives based on card elemental composition.
 */
export function calculateTeamResonance(lineup: LineupCardItem[]): ResonanceBuff[] {
  if (!lineup || lineup.length === 0) return [];

  const buffs: ResonanceBuff[] = [];
  const elementCounts = new Map<string, number>();

  for (const card of lineup) {
    if (!card.element) continue;
    const elem = card.element.toLowerCase().trim();
    elementCounts.set(elem, (elementCounts.get(elem) || 0) + 1);
  }

  // 1. Dual Element Resonances (2+ cards sharing the same element)
  const fireCount = elementCounts.get('fire') || 0;
  if (fireCount >= 2) {
    buffs.push({
      id: 'resonance_fire',
      name: 'Fire Resonance',
      badge: '🔥 Fire Resonance (+15% ATK)',
      description: '+15% Team Attack.',
      element: 'fire',
      type: 'dual_element',
      atkMultiplier: 1.15,
      icon: '🔥',
    });
  }

  const iceCount = elementCounts.get('ice') || 0;
  if (iceCount >= 2) {
    buffs.push({
      id: 'resonance_ice',
      name: 'Ice Resonance',
      badge: '❄️ Ice Resonance (+20% DEF)',
      description: '+20% Team Defense.',
      element: 'ice',
      type: 'dual_element',
      defMultiplier: 1.2,
      icon: '❄️',
    });
  }

  const lightningCount = elementCounts.get('lightning') || 0;
  if (lightningCount >= 2) {
    buffs.push({
      id: 'resonance_lightning',
      name: 'Lightning Resonance',
      badge: '⚡ Lightning Resonance (+15% CRIT)',
      description: '+15% Critical Hit Chance.',
      element: 'lightning',
      type: 'dual_element',
      critBonus: 0.15,
      icon: '⚡',
    });
  }

  const arcaneCount = elementCounts.get('arcane') || 0;
  if (arcaneCount >= 2) {
    buffs.push({
      id: 'resonance_arcane',
      name: 'Arcane Resonance',
      badge: '🔮 Arcane Resonance (+20 Max MP)',
      description: '+20 Max MP to all cards.',
      element: 'arcane',
      type: 'dual_element',
      bonusMaxMana: 20,
      icon: '🔮',
    });
  }

  const shadowCount = elementCounts.get('shadow') || 0;
  if (shadowCount >= 2) {
    buffs.push({
      id: 'resonance_shadow',
      name: 'Shadow Resonance',
      badge: '🌑 Shadow Resonance (10% Lifesteal)',
      description: '10% Lifesteal on Basic Attacks.',
      element: 'shadow',
      type: 'dual_element',
      lifesteal: 0.1,
      icon: '🌑',
    });
  }

  // 2. Prismatic Synergy (All 3 cards have different elements)
  if (lineup.length === 3 && elementCounts.size === 3) {
    buffs.push({
      id: 'resonance_prismatic',
      name: 'Prismatic Synergy',
      badge: '🌈 Prismatic Synergy (+10% All Stats, +5 MP)',
      description: '+10% to all stats and +5 starting MP for each unit.',
      type: 'prismatic',
      statMultiplier: 1.1,
      bonusStartingMana: 5,
      icon: '🌈',
    });
  }

  return buffs;
}

/**
 * Applies active resonance buffs to a card's combat statistics.
 */
export function applyResonanceToCardStats<
  T extends {
    atk: number;
    def: number;
    spd?: number;
    maxHp?: number;
    currentHp?: number;
    maxMana?: number;
    currentMana?: number;
  }
>(stats: T, buffs: ResonanceBuff[]): T {
  let atk = stats.atk;
  let def = stats.def;
  let spd = stats.spd ?? 50;
  let maxHp = stats.maxHp ?? 1000;
  let maxMana = stats.maxMana ?? 100;
  let currentMana = stats.currentMana ?? 50;

  for (const buff of buffs) {
    if (buff.atkMultiplier) {
      atk = Math.round(atk * buff.atkMultiplier);
    }
    if (buff.defMultiplier) {
      def = Math.round(def * buff.defMultiplier);
    }
    if (buff.statMultiplier) {
      atk = Math.round(atk * buff.statMultiplier);
      def = Math.round(def * buff.statMultiplier);
      spd = Math.round(spd * buff.statMultiplier);
      maxHp = Math.round(maxHp * buff.statMultiplier);
    }
    if (buff.bonusMaxMana) {
      maxMana += buff.bonusMaxMana;
    }
    if (buff.bonusStartingMana) {
      currentMana += buff.bonusStartingMana;
    }
  }

  return {
    ...stats,
    atk,
    def,
    spd,
    maxHp,
    currentHp: Math.min(stats.currentHp ?? maxHp, maxHp),
    maxMana,
    currentMana: Math.min(currentMana, maxMana),
  };
}
