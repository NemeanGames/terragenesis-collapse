import { GRID } from "./heightmap";

export interface SeedPoint {
  x: number;
  y: number;
}

export function sampleSeeds(count: number, minDistance: number, rng: () => number) {
  const points: SeedPoint[] = [];
  let tries = 0;
  const limit = count * 2000;
  while (points.length < count && tries < limit) {
    tries++;
    const x = 1 + rng() * (GRID - 2);
    const y = 1 + rng() * (GRID - 2);
    let ok = true;
    for (const p of points) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minDistance * minDistance) {
        ok = false;
        break;
      }
    }
    if (ok) points.push({ x, y });
  }
  return points;
}
