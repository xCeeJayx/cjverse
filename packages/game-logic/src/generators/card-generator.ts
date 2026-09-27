import { CardEntity, Race, Variant, ElementTier } from '../types/card';
import { ELEMENT_TO_TIER } from '../constants/elements';
import { calculatePowerScore } from '../calculator/stats';

const RACES: Race[] = ['dragon', 'elf', 'human', 'dwarf', 'orc', 'troll', 'goblin'];

const VARIANTS: { variant: Variant; weight: number }[] = [
  { variant: 'normal', weight: 60 },
  { variant: 'silver', weight: 25 },
  { variant: 'gold', weight: 10 },
  { variant: 'diamond', weight: 4 },
  { variant: 'rainbow', weight: 1 }
];

const ELEMENTS = Object.keys(ELEMENT_TO_TIER);

export function generateCardId(length = 6): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Alphanumeric without ambiguous characters (0, O, 1, I)
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

  const powerScore = calculatePowerScore({
    race,
    variant,
    elementTier,
    evolutionStage,
    level: clampedLevel,
  });

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
