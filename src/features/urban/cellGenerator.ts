import type { Cell, RoadEdge, RoadGraph, RoadNode } from '../../cell';

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toIndex(bounds: number, x: number, y: number) {
  return y * bounds + x;
}

export function generateCell(seed: number, opts: { densityBand: 0 | 1 | 2; biomeId: string }): Cell {
  const bounds = 64;
  const rand = mulberry32(seed | 0);
  const buildable = new Uint8Array(bounds * bounds);
  const roadMask = new Uint8Array(bounds * bounds);
  const waterMask = new Uint8Array(bounds * bounds);

  // base terrain: mark edges as non-buildable buffer
  for (let y = 0; y < bounds; y++) {
    for (let x = 0; x < bounds; x++) {
      const idx = toIndex(bounds, x, y);
      const border = x === 0 || y === 0 || x === bounds - 1 || y === bounds - 1;
      buildable[idx] = border ? 0 : 1;
    }
  }

  // scatter water basins
  const lakes = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < lakes; i++) {
    const radius = 4 + Math.floor(rand() * 6);
    const cx = 8 + Math.floor(rand() * (bounds - 16));
    const cy = 8 + Math.floor(rand() * (bounds - 16));
    for (let y = cy - radius; y <= cy + radius; y++) {
      if (y < 0 || y >= bounds) continue;
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x < 0 || x >= bounds) continue;
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          const id = toIndex(bounds, x, y);
          waterMask[id] = 1;
          buildable[id] = 0;
        }
      }
    }
  }

  // generate a simple road grid with one backbone
  const majorX = [Math.floor(bounds / 2), Math.floor(bounds / 2) - 12, Math.floor(bounds / 2) + 12];
  const majorY = [Math.floor(bounds / 2), Math.floor(bounds / 2) - 14, Math.floor(bounds / 2) + 14];
  const nodes: RoadNode[] = [];
  const nodeIndex = new Map<string, number>();
  const edges: RoadEdge[] = [];
  let nodeId = 0;

  const getNode = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (nodeIndex.has(key)) return nodeIndex.get(key)!;
    const id = nodeId++;
    nodeIndex.set(key, id);
    nodes.push({ id, position: [x, y], tags: [] });
    return id;
  };

  const addEdge = (ax: number, ay: number, bx: number, by: number, tags?: string[]) => {
    const a = getNode(ax, ay);
    const b = getNode(bx, by);
    edges.push({ from: a, to: b, tags });
  };

  for (const x of majorX) {
    for (let y = 0; y < bounds; y++) {
      const idx = toIndex(bounds, x, y);
      roadMask[idx] = 1;
      buildable[idx] = 0;
      if (y > 0) {
        addEdge(x, y - 1, x, y, [x === majorX[0] ? 'backbone' : 'local']);
      }
    }
  }

  for (const y of majorY) {
    for (let x = 0; x < bounds; x++) {
      const idx = toIndex(bounds, x, y);
      roadMask[idx] = 1;
      buildable[idx] = 0;
      if (x > 0) {
        addEdge(x - 1, y, x, y, [y === majorY[0] ? 'backbone' : 'local']);
      }
    }
  }

  // add a few diagonal spurs for intersections
  for (let y = 10; y < bounds - 10; y += 16) {
    for (let x = 10; x < bounds - 10; x += 16) {
      const idx = toIndex(bounds, x, y);
      if (!buildable[idx]) continue;
      if (rand() < 0.5) {
        for (let i = 0; i < 6; i++) {
          const px = x + i;
          const py = y + i;
          if (px >= bounds || py >= bounds) break;
          const id = toIndex(bounds, px, py);
          roadMask[id] = 1;
          buildable[id] = 0;
          if (i > 0) addEdge(px - 1, py - 1, px, py, ['local']);
        }
      }
    }
  }

  const roadGraph: RoadGraph = { nodes, edges };

  // ensure some random obstacles
  for (let y = 4; y < bounds - 4; y++) {
    for (let x = 4; x < bounds - 4; x++) {
      const id = toIndex(bounds, x, y);
      if (!buildable[id]) continue;
      const noise = rand();
      if (noise < 0.08) {
        buildable[id] = 0;
      }
    }
  }

  return {
    bounds,
    seed,
    biomeId: opts.biomeId,
    densityBand: opts.densityBand,
    buildable,
    roadMask,
    roadGraph,
    waterMask
  };
}
