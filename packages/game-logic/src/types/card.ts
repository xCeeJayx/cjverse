export type Race = 'dragon' | 'elf' | 'human' | 'dwarf' | 'orc' | 'troll' | 'goblin';

export type Variant = 'normal' | 'silver' | 'gold' | 'diamond' | 'rainbow';

export type ElementTier = 'S' | 'A' | 'B' | 'C';

export type Gender = 'male' | 'female';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  mana: number;
}

export interface CardEntity {
  id?: string;
  seed: number;
  race: Race;
  variant: Variant;
  element: string;
  elementTier: ElementTier;
  evolutionStage: number;
  level: number;
  powerScore: number;
  gender?: Gender;
  assetPaths?: {
    raceSlice: string;
    elementSlice: string;
    frameSlice: string;
  };
}

export interface CardStats {
  maxHp: number;
  currentHp: number;
  atk: number;
  def: number;
  spd: number;
  maxMana: number;
  currentMana: number;
}
