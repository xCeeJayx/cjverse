import { CardEntity, Race, Variant, ElementTier, Gender } from '../types/card';
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

export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    let s = (Math.abs(seed) || 12345) >>> 0;
    // SplitMix32 mixer to distribute consecutive seed values uniformly
    s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0;
    s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0;
    this.state = (s ^ (s >>> 16)) >>> 0;
  }

  nextFloat(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
}

export function generateCardId(length = 6): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Alphanumeric without ambiguous characters (0, O, 1, I)
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateCardFromSeed(
  seed: number,
  level = 1,
  overrides?: {
    variant?: Variant;
    element?: string;
    race?: Race;
    evolutionStage?: number;
    gender?: Gender;
  }
): CardEntity {
  const absSeed = Math.abs(Math.floor(seed));
  const rng = new SeededRNG(absSeed);

  // Deterministic race selection
  const race = overrides?.race || RACES[absSeed % RACES.length];

  // Deterministic variant selection (weighted 100) or override
  let variant: Variant = overrides?.variant || 'normal';
  if (!overrides?.variant) {
    const variantRoll = (absSeed * 17) % 100;
    let currentWeight = 0;
    for (const item of VARIANTS) {
      currentWeight += item.weight;
      if (variantRoll < currentWeight) {
        variant = item.variant;
        break;
      }
    }
  }

  // Deterministic element selection or override
  const element = overrides?.element || ELEMENTS[(absSeed * 31) % ELEMENTS.length];
  const elementTier: ElementTier = ELEMENT_TO_TIER[element] || 'C';

  // Deterministic gender roll (50/50)
  const gender: 'male' | 'female' = overrides?.gender || (rng.nextFloat() < 0.5 ? 'male' : 'female');

  const evolutionStage = overrides?.evolutionStage || 1;
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
    powerScore,
    gender,
  };
}
