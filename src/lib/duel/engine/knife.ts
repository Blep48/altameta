export const impactAngle = (rotation: number) =>
  (((180 - rotation) % 360) + 360) % 360;
export const angularDistance = (a: number, b: number) =>
  Math.abs(((a - b + 540) % 360) - 180);
export const hitsKnife = (knives: readonly number[], rotation: number) =>
  knives.some((a) => angularDistance(a, impactAngle(rotation)) < 14);
