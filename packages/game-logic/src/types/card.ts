export type Race = 'dragon' | 'elf' | 'human' | 'dwarf' | 'orc' | 'troll' | 'goblin';

export type Variant = 'normal' | 'silver' | 'gold' | 'diamond' | 'rainbow';

export type ElementTier = 'S' | 'A' | 'B' | 'C';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  mana: number;
}
