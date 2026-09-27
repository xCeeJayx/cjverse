import { CardEntity, CardStats } from '../types/card';
import { RACE_BASE } from '../constants/races';
import { VARIANT_MULTIPLIERS } from '../constants/variants';
import { ELEMENT_TIER_BONUS, getEvolutionMultiplier } from '../constants/elements';

export const EVOLUTION_STAGE_NAMES: Record<number, string> = {
  1: 'Base',
  2: 'Ascended',
  3: 'Transcendent',
  4: 'Mythic',
  5: 'Cosmic',
};

export function getEvolutionStageName(stage: number): string {
  return EVOLUTION_STAGE_NAMES[stage] || `Stage ${stage}`;
}

export function calculateStats(card: CardEntity): CardStats {
  const variantMult = VARIANT_MULTIPLIERS[card.variant] ?? 1.0;
  const evoMult = getEvolutionMultiplier(card.evolutionStage);
  const elemBonus = (ELEMENT_TIER_BONUS[card.elementTier] ?? 0) * evoMult;
  const lvlBonus = (card.level ?? 1) * 15;
  const base = RACE_BASE[card.race];

  const maxHp = Math.floor((base.hp * variantMult) + (lvlBonus * 5));

  return {
    maxHp,
    currentHp: maxHp,
    atk: Math.floor((base.atk * variantMult) + elemBonus + lvlBonus),
    def: Math.floor((base.def * variantMult) + (lvlBonus * 0.5)),
    spd: Math.floor(base.spd + (variantMult * 10)),
    maxMana: Math.floor((base.mana * variantMult) + (elemBonus * 0.5)),
    currentMana: 50 // starting combat mana
  };
}

export function calculatePowerScore(card: {
  race: CardEntity['race'];
  variant: CardEntity['variant'];
  elementTier: CardEntity['elementTier'];
  evolutionStage?: number;
  level?: number;
}): number {
  const baseStats = RACE_BASE[card.race];
  const variantMult = VARIANT_MULTIPLIERS[card.variant] ?? 1.0;
  const evoMult = getEvolutionMultiplier(card.evolutionStage ?? 1);
  const elemBonus = (ELEMENT_TIER_BONUS[card.elementTier] ?? 0) * evoMult;
  const lvl = Math.max(1, Math.floor(card.level ?? 1));

  const calculatedAtk = Math.floor((baseStats.atk * variantMult) + elemBonus + (lvl * 15));
  const calculatedHp = Math.floor((baseStats.hp * variantMult) + (lvl * 75));
  const calculatedDef = Math.floor((baseStats.def * variantMult) + (lvl * 7.5));

  return Math.floor(calculatedAtk + (calculatedHp / 10) + calculatedDef);
}
