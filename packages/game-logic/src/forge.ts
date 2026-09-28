import { CardEntity, Variant, Race, ElementTier } from './types/card';
import { ELEMENT_TO_TIER } from './constants/elements';
import { calculatePowerScore } from './calculator/stats';
import { generateCardId } from './generators/card-generator';

export interface SalvageReward {
  arcaneDust: number;
  crystals: number;
}

export const SALVAGE_VALUES: Record<Variant, SalvageReward> = {
  normal: { arcaneDust: 15, crystals: 10 },
  silver: { arcaneDust: 50, crystals: 35 },
  gold: { arcaneDust: 175, crystals: 100 },
  diamond: { arcaneDust: 600, crystals: 350 },
  rainbow: { arcaneDust: 1500, crystals: 800 },
};

export const FUSION_TIER_UPGRADES: Record<string, Variant> = {
  normal: 'silver',
  silver: 'gold',
  gold: 'diamond',
};

/**
 * Calculates cumulative Arcane Dust and Crystals yielded by salvaging given cards.
 */
export function calculateSalvageYield(cardsToSalvage: { variant: string }[]): SalvageReward {
  let arcaneDust = 0;
  let crystals = 0;

  for (const card of cardsToSalvage) {
    const variantKey = (card.variant || 'normal').toLowerCase() as Variant;
    const reward = SALVAGE_VALUES[variantKey] || SALVAGE_VALUES.normal;
    arcaneDust += reward.arcaneDust;
    crystals += reward.crystals;
  }

  return { arcaneDust, crystals };
}

/**
 * Validates whether 3 cards can be fused together.
 */
export function validateFusionCards(
  cardsToFuse: { id: string; variant: string }[]
): { valid: boolean; reason?: string; targetVariant?: Variant } {
  if (!cardsToFuse || cardsToFuse.length !== 3) {
    return {
      valid: false,
      reason: 'Card Fusion requires exactly 3 cards.',
    };
  }

  const ids = new Set(cardsToFuse.map((c) => c.id));
  if (ids.size !== 3) {
    return {
      valid: false,
      reason: 'Cannot fuse duplicate cards.',
    };
  }

  const variant0 = cardsToFuse[0].variant.toLowerCase();
  const variant1 = cardsToFuse[1].variant.toLowerCase();
  const variant2 = cardsToFuse[2].variant.toLowerCase();

  if (variant0 !== variant1 || variant1 !== variant2) {
    return {
      valid: false,
      reason: `All 3 sacrifice cards must share the exact same variant tier (received: ${variant0}, ${variant1}, ${variant2}).`,
    };
  }

  const targetVariant = FUSION_TIER_UPGRADES[variant0];
  if (!targetVariant) {
    return {
      valid: false,
      reason: `Cards of variant '${variant0}' cannot be fused to a higher tier.`,
    };
  }

  return {
    valid: true,
    targetVariant,
  };
}

/**
 * Determines the dominant element among 3 sacrifice cards.
 * If 2 or 3 share an element, that element dominates.
 * If all 3 are distinct, randomly picks one of the 3 sacrifice elements.
 */
export function getDominantElement(elements: string[]): string {
  if (elements.length === 0) return 'fire';

  const counts: Record<string, number> = {};
  for (const el of elements) {
    counts[el] = (counts[el] || 0) + 1;
  }

  // Check if any element has count >= 2
  for (const [el, count] of Object.entries(counts)) {
    if (count >= 2) {
      return el;
    }
  }

  // All 3 distinct -> roll randomly among the 3
  const randomIndex = Math.floor(Math.random() * elements.length);
  return elements[randomIndex];
}

/**
 * Executes fusion of 3 sacrifice cards, returning a newly synthesized card.
 * The resulting card:
 * - Upgrades variant (Normal -> Silver -> Gold -> Diamond)
 * - Inherits dominant element
 * - Starts with +10% power score bonus over base rolls
 * - Has a fresh 6-character alphanumeric ID
 */
export function fuseCards(
  sacrificeCards: {
    id: string;
    race: string;
    variant: string;
    element: string;
  }[]
): CardEntity {
  const validation = validateFusionCards(sacrificeCards);
  if (!validation.valid || !validation.targetVariant) {
    throw new Error(validation.reason || 'Invalid cards for fusion.');
  }

  const targetVariant = validation.targetVariant;
  const elements = sacrificeCards.map((c) => c.element);
  const element = getDominantElement(elements);
  const elementTier: ElementTier = ELEMENT_TO_TIER[element] || 'C';

  // Inherit dominant race or pick randomly from sacrifice cards
  const raceCounts: Record<string, number> = {};
  for (const c of sacrificeCards) {
    raceCounts[c.race] = (raceCounts[c.race] || 0) + 1;
  }
  let chosenRace = sacrificeCards[0].race as Race;
  for (const [r, count] of Object.entries(raceCounts)) {
    if (count >= 2) {
      chosenRace = r as Race;
      break;
    }
  }

  const seed = Math.floor(Math.random() * 1000000);
  const id = generateCardId(6);
  const level = 1;
  const evolutionStage = 1;

  const basePowerScore = calculatePowerScore({
    race: chosenRace,
    variant: targetVariant,
    elementTier,
    evolutionStage,
    level,
  });

  // +10% power score bonus over base rolls
  const powerScore = Math.round(basePowerScore * 1.1);

  return {
    id,
    seed,
    race: chosenRace,
    variant: targetVariant,
    element,
    elementTier,
    evolutionStage,
    level,
    powerScore,
    gender: seed % 2 === 0 ? 'male' : 'female',
  };
}
