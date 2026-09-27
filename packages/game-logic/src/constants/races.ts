import { Race, BaseStats } from '../types/card';

export const RACE_BASE: Record<Race, BaseStats> = {
  dragon: { hp: 1200, atk: 180, def: 110, spd: 85, mana: 120 },
  elf: { hp: 800, atk: 160, def: 70, spd: 125, mana: 160 },
  human: { hp: 950, atk: 130, def: 95, spd: 100, mana: 100 },
  dwarf: { hp: 1400, atk: 120, def: 150, spd: 70, mana: 80 },
  orc: { hp: 1350, atk: 170, def: 85, spd: 90, mana: 60 },
  troll: { hp: 1600, atk: 110, def: 90, spd: 60, mana: 70 },
  goblin: { hp: 750, atk: 140, def: 60, spd: 140, mana: 110 }
};
