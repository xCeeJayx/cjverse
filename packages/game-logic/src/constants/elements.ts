import { ElementTier } from '../types/card';

export const ELEMENT_TIER_BONUS: Record<ElementTier, number> = {
  S: 200,
  A: 120,
  B: 80,
  C: 50
};

export const ELEMENT_TO_TIER: Record<string, ElementTier> = {
  // S-Tier (Legendary)
  void: 'S',
  time: 'S',
  cosmic: 'S',
  arcane: 'S',
  chaos: 'S',

  // A-Tier
  fire: 'A',
  ice: 'A',
  lightning: 'A',
  shadow: 'A',
  light: 'A',
  nature: 'A',
  blood: 'A',

  // B-Tier
  water: 'B',
  wind: 'B',
  earth: 'B',
  poison: 'B',
  sound: 'B',
  metal: 'B',

  // C-Tier
  sand: 'C',
  mist: 'C',
  smoke: 'C',
  crystal: 'C',
  acid: 'C'
};

export function getEvolutionMultiplier(stage: number): number {
  const clampedStage = Math.max(1, Math.min(5, Math.floor(stage)));
  return 1.0 + (clampedStage - 1) * 0.6;
}
