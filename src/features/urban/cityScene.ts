export type CityBuilding = { pos: [number, number, number]; scale: [number, number, number]; rot: number };
export type CityRoad = { pos: [number, number, number]; scale: [number, number, number] };
export type CityWater = { pos: [number, number, number]; radius: number };

export interface CityData {
  buildings: CityBuilding[];
  roads: CityRoad[];
  waters: CityWater[];
  bounds: number;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nearestDistance(x: number, lines: number[]) {
  let m = Infinity;
  for (const v of lines) {
    const d = Math.abs(x - v);
    if (d < m) m = d;
  }
  return m;
}

export function generateCityData(seed: number, { density = 1 }: { density?: number } = {}): CityData {
  const rand = mulberry32(seed);
  const bounds = 120;
  const major = 30;
  const minor = 12;
  const jitter = 3;
  const roadWMajor = 6;
  const roadWMinor = 3.6;
  const densityClamp = Math.max(0.2, Math.min(1.4, density));

  const xs: number[] = [];
  const zs: number[] = [];
  for (let x = -bounds; x <= bounds; x += minor) xs.push(x + (rand() - 0.5) * jitter);
  for (let z = -bounds; z <= bounds; z += minor) zs.push(z + (rand() - 0.5) * jitter);

  const roads: CityRoad[] = [];
  xs.forEach((x) => {
    const w = Math.abs(Math.round(x / major) * major - x) < minor * 0.6 ? roadWMajor : roadWMinor;
    roads.push({ pos: [x, 0.01, 0], scale: [w, 0.02, bounds * 2] });
  });
  zs.forEach((z) => {
    const w = Math.abs(Math.round(z / major) * major - z) < minor * 0.6 ? roadWMajor : roadWMinor;
    roads.push({ pos: [0, 0.01, z], scale: [bounds * 2, 0.02, w] });
  });

  const waters: CityWater[] = [];
  const lakes = 1 + Math.floor(rand() * 2 * densityClamp);
  for (let i = 0; i < lakes; i++) {
    const r = 18 + rand() * 24;
    const cx = (rand() * 2 - 1) * (bounds * 0.6);
    const cz = (rand() * 2 - 1) * (bounds * 0.6);
    waters.push({ pos: [cx, 0, cz], radius: r });
  }

  const inWater = (x: number, z: number) =>
    waters.some((w) => {
      const dx = x - w.pos[0];
      const dz = z - w.pos[2];
      return dx * dx + dz * dz < w.radius * w.radius;
    });

  const buildings: CityBuilding[] = [];
  const cell = 6;
  const margin = 2.2;
  const limit = Math.floor(((bounds / cell) * (bounds / cell)) * densityClamp);
  let count = 0;
  for (let x = -bounds + cell; x <= bounds - cell; x += cell) {
    for (let z = -bounds + cell; z <= bounds - cell; z += cell) {
      if (count >= limit) break;
      if (inWater(x, z)) continue;
      const dx = nearestDistance(x, xs);
      const dz = nearestDistance(z, zs);
      if (dx < roadWMinor * 0.5 + margin || dz < roadWMinor * 0.5 + margin) continue;
      const r = Math.hypot(x, z) / bounds;
      let h = 6 + rand() * 10 + (1 - r) * 34 * densityClamp;
      if (rand() < 0.02 * densityClamp) h += 60 * densityClamp;
      const sx = 4 + rand() * 3 * densityClamp;
      const sz = 4 + rand() * 3 * densityClamp;
      buildings.push({ pos: [x, 0, z], scale: [sx, h, sz], rot: 0 });
      count++;
    }
  }
  return { buildings, roads, waters, bounds };
}
