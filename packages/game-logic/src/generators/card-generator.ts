import { CardEntity, Race, Variant, ElementTier } from '../types/card';
import { RACE_BASE } from '../constants/races';
import { VARIANT_MULTIPLIERS } from '../constants/variants';
import { ELEMENT_TO_TIER, ELEMENT_TIER_BONUS } from '../constants/elements';

const RACES: Race[] = ['dragon', 'elf', 'human', 'dwarf', 'orc', 'troll', 'goblin'];

const VARIANTS: { variant: Variant; weight: number }[] = [
  { variant: 'normal', weight: 60 },
  { variant: 'silver', weight: 25 },
  { variant: 'gold', weight: 10 },
  { variant: 'diamond', weight: 4 },
  { variant: 'rainbow', weight: 1 }
];

const ELEMENTS = Object.keys(ELEMENT_TO_TIER);

export function generateCardFromSeed(seed: number, level = 1): CardEntity {
  const absSeed = Math.abs(Math.floor(seed));

  // Deterministic race selection
  const race = RACES[absSeed % RACES.length];

  // Deterministic variant selection (weighted 100)
  const variantRoll = (absSeed * 17) % 100;
  let currentWeight = 0;
  let variant: Variant = 'normal';
  for (const item of VARIANTS) {
    currentWeight += item.weight;
    if (variantRoll < currentWeight) {
      variant = item.variant;
      break;
    }
  }

  // Deterministic element selection
  const element = ELEMENTS[(absSeed * 31) % ELEMENTS.length];
  const elementTier: ElementTier = ELEMENT_TO_TIER[element];

  const evolutionStage = 1;
  const clampedLevel = Math.max(1, Math.floor(level));

  // Compute power score from base stats * variant + element bonus + level
  const baseStats = RACE_BASE[race];
  const variantMult = VARIANT_MULTIPLIERS[variant];
  const elemBonus = ELEMENT_TIER_BONUS[elementTier];
  const calculatedAtk = Math.floor((baseStats.atk * variantMult) + elemBonus + (clampedLevel * 15));
  const calculatedHp = Math.floor((baseStats.hp * variantMult) + (clampedLevel * 75));
  const calculatedDef = Math.floor((baseStats.def * variantMult) + (clampedLevel * 7.5));

  const powerScore = Math.floor(calculatedAtk + (calculatedHp / 10) + calculatedDef);

  return {
    seed: absSeed,
    race,
    variant,
    element,
    elementTier,
    evolutionStage,
    level: clampedLevel,
    powerScore
  };
}
