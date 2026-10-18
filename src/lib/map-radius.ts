// The schools maps' dot size: area by roll (radius by its square root), between MIN_RADIUS and MAX_RADIUS
// across the schools drawn. Moved from ConsortiumMap (0.8 SMT feedback round 1, F-2) so SMT's map can
// size every dot, the focus school included, and draw a size key on the same scale. Pure.
export const MIN_RADIUS = 6;
export const MAX_RADIUS = 20;

export function rollRadius(roll: number | null, minRoll: number, maxRoll: number): number {
  if (roll === null || !(maxRoll > minRoll)) return (MIN_RADIUS + MAX_RADIUS) / 2;
  const t = (Math.sqrt(roll) - Math.sqrt(minRoll)) / (Math.sqrt(maxRoll) - Math.sqrt(minRoll));
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * t;
}
