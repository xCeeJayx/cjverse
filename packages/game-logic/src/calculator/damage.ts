export function calculateMitigation(targetDef: number): number {
  const safeDef = Math.max(0, targetDef);
  return 1000 / (1000 + safeDef);
}

export function calculateDamage(
  attackerAtk: number,
  skillMultiplier: number,
  elementalModifier: number,
  targetDef: number
): number {
  const rawDamage = (attackerAtk * skillMultiplier) * elementalModifier;
  const mitigation = calculateMitigation(targetDef);
  return Math.max(1, Math.floor(rawDamage * mitigation));
}
