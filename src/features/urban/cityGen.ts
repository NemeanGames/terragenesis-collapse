export type Terrain = "water" | "plains" | "forest" | "hill" | "mountain";
export type District =
  | "CENTER"
  | "RES"
  | "COM"
  | "IND"
  | "CAMPUS"
  | "HOLY"
  | "ENT"
  | "PARK"
  | "FARM"
  | "PORT";

export interface HexCell {
  q: number;
  r: number;
  terrain: Terrain;
  coast: boolean;
  district?: District;
  cityId?: number;
}

export interface CityNode {
  id: number;
  q: number;
  r: number;
}

export interface CityPlan {
  grid: HexCell[][];
  cities: CityNode[];
  roads: [number, number][][];
  width: number;
  height: number;
}

const W = 42;
const H = 32;
const HEX = 16;
const PADDING = 12;

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed: number) {
  seed |= 0;
  const hash = (x: number, y: number) => {
    let n = (x * 374761393 + y * 668265263 + seed * 1013904223) | 0;
    n ^= n << 13;
    n = (n * 1274126177) | 0;
    n ^= n >>> 16;
    return (n >>> 0) / 4294967295;
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    let total = 0;
    let amp = 1;
    let scale = 96;
    let norm = 0;
    for (let o = 0; o < 5; o++) {
      const X = Math.floor(x / scale);
      const Y = Math.floor(y / scale);
      const fx = (x / scale) - X;
      const fy = (y / scale) - Y;
      const v00 = hash(X, Y);
      const v10 = hash(X + 1, Y);
      const v01 = hash(X, Y + 1);
      const v11 = hash(X + 1, Y + 1);
      const ix0 = lerp(v00, v10, smooth(fx));
      const ix1 = lerp(v01, v11, smooth(fx));
      total += lerp(ix0, ix1, smooth(fy)) * amp;
      norm += amp;
      amp *= 0.5;
      scale *= 0.5;
    }
    return total / norm;
  };
}

function inBounds(q: number, r: number) {
  return q >= 0 && q < W && r >= 0 && r < H;
}

function neighbors(q: number, r: number) {
  const odd = r & 1;
  const deltas = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [odd ? 1 : -1, -1],
    [odd ? 1 : -1, 1]
  ];
  const out: [number, number][] = [];
  for (const [dq, dr] of deltas) {
    const nq = q + dq;
    const nr = r + dr;
    if (inBounds(nq, nr)) out.push([nq, nr]);
  }
  return out;
}

function hexToPixel(q: number, r: number) {
  const x = HEX * Math.sqrt(3) * (q + (r & 1) * 0.5);
  const y = HEX * 1.5 * r;
  return { x: x + PADDING, y: y + PADDING };
}

function genTerrain(seed: number) {
  const noise = makeNoise(seed);
  const grid: HexCell[][] = [];
  for (let r = 0; r < H; r++) {
    const row: HexCell[] = [];
    for (let q = 0; q < W; q++) {
      const { x, y } = hexToPixel(q, r);
      const n = noise(x, y);
      let terrain: Terrain;
      if (n < 0.28) terrain = "water";
      else if (n > 0.82) terrain = "mountain";
      else if (n > 0.66) terrain = "hill";
      else if (n > 0.48) terrain = "forest";
      else terrain = "plains";
      row.push({ q, r, terrain, coast: false });
    }
    grid.push(row);
  }
  for (let r = 0; r < H; r++) {
    for (let q = 0; q < W; q++) {
      const cell = grid[r][q];
      if (cell.terrain !== "water") {
        cell.coast = neighbors(q, r).some(([nq, nr]) => grid[nr][nq].terrain === "water");
      }
    }
  }
  return grid;
}

function distance(a: { q: number; r: number }, b: { q: number; r: number }) {
  const ax = a.q - (a.r - (a.r & 1)) / 2;
  const az = a.r;
  const ay = -ax - az;
  const bx = b.q - (b.r - (b.r & 1)) / 2;
  const bz = b.r;
  const by = -bx - bz;
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

function placeCities(grid: HexCell[][], seed: number, count = 5) {
  const rand = mulberry32(seed ^ 0x9e3779b1);
  const spots: { q: number; r: number; score: number }[] = [];
  for (let r = 2; r < H - 2; r++) {
    for (let q = 2; q < W - 2; q++) {
      const cell = grid[r][q];
      if (cell.terrain === "plains" || (cell.terrain === "forest" && !cell.coast)) {
        let s = 1 + (cell.coast ? 1 : 0);
        for (const [nq, nr] of neighbors(q, r)) {
          const nt = grid[nr][nq].terrain;
          if (nt === "plains") s += 0.2;
          if (nt === "water") s += 0.5;
          if (nt === "mountain") s -= 0.6;
        }
        s *= 0.75 + rand() * 0.5;
        spots.push({ q, r, score: s });
      }
    }
  }
  spots.sort((a, b) => b.score - a.score);
  const chosen: CityNode[] = [];
  for (const spot of spots) {
    if (chosen.every((c) => distance(c, spot) >= 8)) {
      const id = chosen.length;
      chosen.push({ id, q: spot.q, r: spot.r });
      grid[spot.r][spot.q].district = "CENTER";
      grid[spot.r][spot.q].cityId = id;
      if (chosen.length >= count) break;
    }
  }
  return chosen;
}

function scoreFor(
  grid: HexCell[][],
  q: number,
  r: number,
  d: District,
  city: CityNode
) {
  const cell = grid[r][q];
  if (cell.terrain === "water" && d !== "PORT") return -999;
  if (cell.terrain === "mountain") return -999;
  if (d === "PORT" && !cell.coast) return -999;
  let s = 0;

  const base: Record<District, number> = {
    CENTER: -999,
    RES: 1,
    COM: 1,
    IND: 1,
    CAMPUS: 1,
    HOLY: 1,
    ENT: 1,
    PARK: 1,
    FARM: 1,
    PORT: 2
  };
  s += base[d];

  if (d === "FARM") {
    if (cell.terrain === "plains") s += 1.5;
    if (cell.coast) s += 0.5;
  }
  if (d === "IND") {
    if (cell.terrain === "hill") s += 1.5;
    if (cell.terrain === "forest") s += 0.3;
    if (cell.coast) s -= 0.5;
  }
  if (d === "CAMPUS") {
    for (const [nq, nr] of neighbors(q, r)) {
      const nt = grid[nr][nq].terrain;
      if (nt === "mountain") s += 2.0;
      if (nt === "hill") s += 0.6;
    }
  }
  if (d === "HOLY" && cell.terrain === "forest") s += 1.0;
  if (d === "COM" && cell.coast) s += 1.2;
  if (d === "PARK") {
    if (cell.coast) s += 1.2;
    if (cell.terrain === "forest") s += 0.8;
  }
  if (d === "ENT" && cell.terrain === "plains") s += 0.5;

  for (const [nq, nr] of neighbors(q, r)) {
    const nd = grid[nr][nq].district;
    const nt = grid[nr][nq].terrain;
    if (!nd) continue;
    if (d === "RES") {
      if (nd === "PARK") s += 1.2;
      if (nd === "ENT") s += 1.0;
      if (nd === "COM") s += 0.8;
      if (nd === "IND") s -= 1.5;
    }
    if (d === "COM") {
      if (nd === "CENTER") s += 1.0;
      if (nd === "RES") s += 0.6;
      if (nd === "IND") s -= 0.3;
    }
    if (d === "IND") {
      if (nd === "RES") s -= 1.2;
      if (nd === "PORT") s += 0.8;
    }
    if (d === "CAMPUS" && nt === "mountain") s += 0.5;
    if (d === "HOLY" && nd === "PARK") s += 0.6;
    if (d === "PORT" && nd === "COM") s += 0.6;
  }

  const dist = distance({ q, r }, city);
  if (d === "IND") s += -0.05 * dist + 0.6;
  else if (d === "PARK" || d === "FARM") s += -0.03 * dist + 0.3;
  else s += -0.15 * dist + 1.5;

  return s;
}

function placeDistricts(grid: HexCell[][], city: CityNode, rand: () => number) {
  const wants: District[] = [
    "COM",
    "IND",
    "RES",
    "RES",
    "PARK",
    "ENT",
    rand() < 0.6 ? "CAMPUS" : "HOLY",
    "FARM"
  ];
  if (grid[city.r][city.q].coast) wants.push("PORT");

  for (const d of wants) {
    let best: { q: number; r: number; s: number } | null = null;
    for (let r = city.r - 6; r <= city.r + 6; r++) {
      for (let q = city.q - 6; q <= city.q + 6; q++) {
        if (!inBounds(q, r)) continue;
        const cell = grid[r][q];
        if (cell.district || cell.terrain === "water") continue;
        if (d !== "RES") {
          let nearSame = false;
          for (const [nq, nr] of neighbors(q, r)) {
            if (grid[nr][nq].district === d) nearSame = true;
          }
          if (nearSame) continue;
        }
        const score = scoreFor(grid, q, r, d, city);
        if (!best || score > best.s) best = { q, r, s: score };
      }
    }
    if (best) {
      const cell = grid[best.r][best.q];
      cell.district = d;
      cell.cityId = city.id;
    }
  }
}

function bfsRoad(grid: HexCell[][], a: { q: number; r: number }, b: { q: number; r: number }) {
  const key = (q: number, r: number) => `${q},${r}`;
  const queue: [number, number][] = [[a.q, a.r]];
  const prev = new Map<string, string>();
  prev.set(key(a.q, a.r), "");
  while (queue.length) {
    const [q, r] = queue.shift()!;
    if (q === b.q && r === b.r) break;
    for (const [nq, nr] of neighbors(q, r)) {
      const cell = grid[nr][nq];
      if (cell.terrain === "water" || cell.terrain === "mountain") continue;
      const k = key(nq, nr);
      if (!prev.has(k)) {
        prev.set(k, key(q, r));
        queue.push([nq, nr]);
      }
    }
  }
  const path: [number, number][] = [];
  let cur = key(b.q, b.r);
  if (!prev.has(cur)) return path;
  while (cur) {
    const [q, r] = cur.split(",").map(Number) as [number, number];
    path.push([q, r]);
    cur = prev.get(cur) || "";
  }
  return path.reverse();
}

export function generateCityPlan(seed: number): CityPlan {
  const grid = genTerrain(seed);
  const cities = placeCities(grid, seed, 5);
  const rand = mulberry32(seed ^ 0x1234abcd);
  for (const city of cities) {
    placeDistricts(grid, city, rand);
  }
  const roads: [number, number][][] = [];
  for (const city of cities) {
    const center = { q: city.q, r: city.r };
    for (let r = 0; r < H; r++) {
      for (let q = 0; q < W; q++) {
        const cell = grid[r][q];
        if (cell.cityId === city.id && cell.district && cell.district !== "CENTER") {
          const path = bfsRoad(grid, center, { q, r });
          if (path.length) roads.push(path);
        }
      }
    }
  }
  return { grid, cities, roads, width: W, height: H };
}
