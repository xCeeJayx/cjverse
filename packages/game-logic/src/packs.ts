import { Variant, CardEntity } from './types/card';
import { generateCardFromSeed, generateCardId } from './generators/card-generator';
import { ELEMENT_TO_TIER } from './constants/elements';

export type BoosterPackType = 'standard' | 'elemental' | 'ascendant';

export interface BoosterPackConfig {
  id: BoosterPackType;
  name: string;
  cost: number;
  cardCount: number;
  description: string;
  badge: string;
  guaranteedDescription: string;
  glowColor: string;
  accentColor: string;
}

export const BOOSTER_PACKS: Record<BoosterPackType, BoosterPackConfig> = {
  standard: {
    id: 'standard',
    name: 'Standard Booster Pack',
    cost: 150,
    cardCount: 3,
    description: 'A balanced booster pack containing 3 cards with standard rarity distribution.',
    badge: 'Standard Edition',
    guaranteedDescription: '75% Normal, 20% Silver, 4.5% Gold, 0.5% Diamond',
    glowColor: 'cyan',
    accentColor: '#06b6d4',
  },
  elemental: {
    id: 'elemental',
    name: 'Elemental Hoard',
    cost: 350,
    cardCount: 3,
    description: 'Infused with primal leylines. Guaranteed rare element chances and higher rarities.',
    badge: 'Primal Infusion',
    guaranteedDescription: 'Guaranteed 1+ Silver or higher; boosted Arcane, Shadow, Blood, & Void affinity',
    glowColor: 'purple',
    accentColor: '#a855f7',
  },
  ascendant: {
    id: 'ascendant',
    name: 'Ascendant Vault',
    cost: 750,
    cardCount: 4,
    description: 'Treasures of ancient titans. 4 high-tier cards with boosted levels and power scores.',
    badge: 'Legendary Cache',
    guaranteedDescription: 'Guaranteed 1+ Gold or Diamond variant; boosted base levels & power',
    glowColor: 'amber',
    accentColor: '#f59e0b',
  },
};

export interface GeneratedCard extends CardEntity {
  id: string;
}

const RARE_ELEMENTS = ['arcane', 'shadow', 'blood', 'void'];
const ALL_ELEMENTS = Object.keys(ELEMENT_TO_TIER);

/**
 * Rolls cards for a booster pack deterministically or pseudo-randomly.
 */
export function openBoosterPack(
  packType: BoosterPackType,
  baseSeed?: number
): GeneratedCard[] {
  const config = BOOSTER_PACKS[packType] || BOOSTER_PACKS.standard;
  const cards: GeneratedCard[] = [];
  const startSeed =
    baseSeed !== undefined
      ? Math.abs(Math.floor(baseSeed))
      : Math.floor(Math.random() * 10_000_000);

  let hasSilverOrHigher = false;
  let hasGoldOrHigher = false;

  for (let i = 0; i < config.cardCount; i++) {
    const cardSeed = (startSeed + (i + 1) * 7919) % 100_000_000;
    const cardId = generateCardId();
    const isLastCard = i === config.cardCount - 1;

    let variant: Variant = 'normal';
    let element: string | undefined;
    let level = 1;

    if (packType === 'standard') {
      // 75% Normal, 20% Silver, 4.5% Gold, 0.5% Diamond
      const roll = ((cardSeed * 13 + i * 37) % 1000) / 10; // 0.0 - 99.9
      if (roll < 75) {
        variant = 'normal';
      } else if (roll < 95) {
        variant = 'silver';
      } else if (roll < 99.5) {
        variant = 'gold';
      } else {
        variant = 'diamond';
      }
      level = 1;
    } else if (packType === 'elemental') {
      // Guaranteed at least 1 Silver or higher
      const roll = (cardSeed * 13 + i * 37) % 100;
      if (isLastCard && !hasSilverOrHigher) {
        variant = roll < 70 ? 'silver' : roll < 95 ? 'gold' : 'diamond';
      } else {
        if (roll < 45) {
          variant = 'normal';
        } else if (roll < 80) {
          variant = 'silver';
        } else if (roll < 96) {
          variant = 'gold';
        } else {
          variant = 'diamond';
        }
      }

      // Boosted chance for rare element tiers (Arcane, Shadow, Blood, Void)
      const elementRoll = (cardSeed * 31 + i * 17) % 100;
      if (elementRoll < 55) {
        element = RARE_ELEMENTS[cardSeed % RARE_ELEMENTS.length];
      } else {
        element = ALL_ELEMENTS[cardSeed % ALL_ELEMENTS.length];
      }

      level = 1 + (cardSeed % 3); // Level 1 - 3
    } else if (packType === 'ascendant') {
      // Guaranteed at least 1 Gold or Diamond variant; boosted base level and power scores
      const roll = (cardSeed * 13 + i * 37) % 100;
      if (isLastCard && !hasGoldOrHigher) {
        variant = roll < 80 ? 'gold' : 'diamond';
      } else {
        if (roll < 20) {
          variant = 'normal';
        } else if (roll < 55) {
          variant = 'silver';
        } else if (roll < 85) {
          variant = 'gold';
        } else {
          variant = 'diamond';
        }
      }

      // Boosted base level: 3 to 6
      level = 3 + (cardSeed % 4);
    }

    if (variant !== 'normal') {
      hasSilverOrHigher = true;
    }
    if (variant === 'gold' || variant === 'diamond') {
      hasGoldOrHigher = true;
    }

    const card = generateCardFromSeed(cardSeed, level, {
      variant,
      element,
    });

    cards.push({
      ...card,
      id: cardId,
    });
  }

  return cards;
}
