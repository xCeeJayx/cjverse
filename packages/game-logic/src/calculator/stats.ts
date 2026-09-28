import { CardEntity, CardStats, Race, BaseStats } from '../types/card';
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

export function getBaseStats(rawRace?: string): BaseStats {
  if (!rawRace) return RACE_BASE.human;
  const clean = rawRace.toLowerCase().trim() as Race;
  if (clean in RACE_BASE) {
    return RACE_BASE[clean];
  }
  // Common lore / RPG aliases
  if (clean === ('draconian' as any)) return RACE_BASE.dragon;
  if (clean === ('abyssal' as any)) return RACE_BASE.troll;
  if (clean === ('celestial' as any)) return RACE_BASE.elf;
  if (clean === ('infernal' as any)) return RACE_BASE.orc;

  return RACE_BASE.human;
}

export function getVariantMultiplier(rawVariant?: string): number {
  if (!rawVariant) return 1.0;
  const clean = rawVariant.toLowerCase().trim();
  return (VARIANT_MULTIPLIERS as Record<string, number>)[clean] ?? 1.0;
}

export function getElementTierBonus(rawTier?: string): number {
  if (!rawTier) return 0;
  const clean = rawTier.toUpperCase().trim();
  return (ELEMENT_TIER_BONUS as Record<string, number>)[clean] ?? 0;
}

export function calculateStats(card: Partial<CardEntity> & { race?: string; variant?: string; elementTier?: string }): CardStats {
  const variantMult = getVariantMultiplier(card.variant);
  const evoMult = getEvolutionMultiplier(card.evolutionStage ?? 1);
  const elemBonus = getElementTierBonus(card.elementTier) * evoMult;
  const lvlBonus = (card.level ?? 1) * 15;
  const base = getBaseStats(card.race);

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
  race?: string;
  variant?: string;
  elementTier?: string;
  evolutionStage?: number;
  level?: number;
}): number {
  const baseStats = getBaseStats(card.race);
  const variantMult = getVariantMultiplier(card.variant);
  const evoMult = getEvolutionMultiplier(card.evolutionStage ?? 1);
  const elemBonus = getElementTierBonus(card.elementTier) * evoMult;
  const lvl = Math.max(1, Math.floor(card.level ?? 1));

  const calculatedAtk = Math.floor((baseStats.atk * variantMult) + elemBonus + (lvl * 15));
  const calculatedHp = Math.floor((baseStats.hp * variantMult) + (lvl * 75));
  const calculatedDef = Math.floor((baseStats.def * variantMult) + (lvl * 7.5));

  return Math.floor(calculatedAtk + (calculatedHp / 10) + calculatedDef);
}
