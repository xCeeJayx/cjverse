import { CardEntity, CardStats } from '../types/card';
import { RACE_BASE } from '../constants/races';
import { VARIANT_MULTIPLIERS } from '../constants/variants';
import { ELEMENT_TIER_BONUS, getEvolutionMultiplier } from '../constants/elements';

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
