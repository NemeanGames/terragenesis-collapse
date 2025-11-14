import type { CellRuntime, TerrainTileMeta } from "../state/types";

export function generateCellFromMacro(seed: number, tile: TerrainTileMeta): CellRuntime {
  const rand = mulberry32(seed >>> 0);
  const N = 48;
  const slopePenalty = clamp01(tile.slope);
  const waterPenalty = tile.waterMask ? 0.6 : 0.0;

  const mask: boolean[] = new Array(N * N).fill(false);
  let buildable = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ny = y / (N - 1);
      const coastBias = tile.coastFlag ? Math.abs(ny - 0.5) * 0.2 : 0.0;
      const score = 1 - slopePenalty - waterPenalty - coastBias + rand() * 0.05;
      const ok = score > 0.45;
      mask[y * N + x] = ok;
      if (ok) buildable++;
    }
  }

  const anchors: Array<[number, number]> =
    tile.roadAnchors && tile.roadAnchors.length
      ? tile.roadAnchors.map(([u, v]) => [clamp01(u), clamp01(v)])
      : (
          densityAnchors(tile.densityBand ?? 0.5).map(([u, v]) => [clamp01(u), clamp01(v)])
        );

  const roads: CellRuntime["roads"] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    const path: [number, number][] = [];
    const ax = Math.floor(a[0] * (N - 1));
    const ay = Math.floor(a[1] * (N - 1));
    const bx = Math.floor(b[0] * (N - 1));
    const by = Math.floor(b[1] * (N - 1));
    const midx = bx;
    const midy = ay;
    rasterLine(ax, ay, midx, midy, path);
    rasterLine(midx, midy, bx, by, path);
    jitter(path, rand, 0.6);
    roads.push({ id: `r${i}`, path, degree: 2 });
  }

  const lots: CellRuntime["lots"] = [];
  const lotSize = 3;
  for (let y = 1; y < N - 1; y += lotSize) {
    for (let x = 1; x < N - 1; x += lotSize) {
      if (!mask[y * N + x]) continue;
      const w = lotSize - 1;
      const h = lotSize - 1;
      lots.push({
        id: `L${x}_${y}`,
        x,
        y,
        w,
        h,
        zone: zonePick(tile, rand),
        poi: rand() < 0.03 ? poiPick(rand) : undefined
      });
    }
  }

  const buildablePct = buildable / (N * N);
  return { lots, roads, anchors, stats: { buildablePct } };
}

function densityAnchors(density: number): Array<[number, number]> {
  if (density >= 0.75) return [[0.1, 0.5], [0.5, 0.4], [0.9, 0.5]];
  if (density >= 0.5) return [[0.15, 0.55], [0.5, 0.5], [0.85, 0.55]];
  return [[0.12, 0.6], [0.5, 0.55], [0.88, 0.6]];
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function rasterLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  out: [number, number][]
) {
  let dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = err * 2;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function jitter(path: [number, number][], rnd: () => number, intensity: number) {
  for (let i = 1; i < path.length - 1; i++) {
    if (rnd() < 0.2 * intensity) {
      path[i][0] += rnd() < 0.5 ? -1 : 1;
      path[i][0] = Math.max(0, Math.min(47, path[i][0]));
    }
    if (rnd() < 0.2 * intensity) {
      path[i][1] += rnd() < 0.5 ? -1 : 1;
      path[i][1] = Math.max(0, Math.min(47, path[i][1]));
    }
  }
}

function zonePick(tile: TerrainTileMeta, rnd: () => number) {
  const density = clamp01(tile.densityBand ?? 0.5);
  const roll = rnd();
  if (roll < 0.55) return "res";
  if (roll < 0.8) return density > 0.6 ? "com" : "mix";
  return density > 0.7 ? "com" : "mix";
}

function poiPick(rnd: () => number) {
  const opts = ["safehouse", "depot", "clinic", "parklet", "workshop"] as const;
  return opts[Math.floor(rnd() * opts.length)];
}
