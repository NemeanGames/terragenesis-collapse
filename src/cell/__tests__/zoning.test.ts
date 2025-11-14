import { describe, expect, it } from 'vitest';
import { applyZoning, extractLots, makeBlocks } from '..';
import type { Cell } from '..';
import { ZONING_CFG } from '../../config/cellZoning';

const DIR4: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];

function makeTestCell(): Cell {
  const bounds = 48;
  const size = bounds * bounds;
  const buildable = new Uint8Array(size);
  const roadMask = new Uint8Array(size);
  const waterMask = new Uint8Array(size);

  const idx = (x: number, y: number) => y * bounds + x;

  for (let y = 0; y < bounds; y++) {
    for (let x = 0; x < bounds; x++) {
      const border = x === 0 || y === 0 || x === bounds - 1 || y === bounds - 1;
      buildable[idx(x, y)] = border ? 0 : 1;
    }
  }

  // carve a tiny isolated buildable patch that should be discarded
  for (let y = 2; y <= 4; y++) {
    for (let x = 2; x <= 4; x++) {
      buildable[idx(x, y)] = 0;
    }
  }
  buildable[idx(3, 3)] = 1;

  // main arterial cross
  const center = Math.floor(bounds / 2);
  for (let y = 1; y < bounds - 1; y++) {
    roadMask[idx(center, y)] = 1;
    buildable[idx(center, y)] = 0;
    if (y > 1) {
      roadMask[idx(center - 8, y)] = y % 5 === 0 ? 1 : roadMask[idx(center - 8, y)];
      if (roadMask[idx(center - 8, y)]) buildable[idx(center - 8, y)] = 0;
    }
  }
  for (let x = 1; x < bounds - 1; x++) {
    roadMask[idx(x, center)] = 1;
    buildable[idx(x, center)] = 0;
    if (x > 8 && x < bounds - 8 && x % 7 === 0) {
      roadMask[idx(x, center - 6)] = 1;
      buildable[idx(x, center - 6)] = 0;
    }
  }

  // water body along the eastern edge
  for (let y = center - 6; y <= center + 6; y++) {
    for (let x = bounds - 10; x < bounds - 4; x++) {
      const id = idx(x, y);
      waterMask[id] = 1;
      buildable[id] = 0;
    }
  }

  const nodes = [
    { id: 0, position: [center, 6], tags: [] },
    { id: 1, position: [center, center], tags: [] },
    { id: 2, position: [center, bounds - 6], tags: [] },
    { id: 3, position: [6, center], tags: [] },
    { id: 4, position: [bounds - 6, center], tags: [] },
    { id: 5, position: [center, center - 6], tags: [] },
    { id: 6, position: [center + 10, center], tags: [] }
  ];

  const edges = [
    { from: 0, to: 1, tags: ['backbone'] },
    { from: 1, to: 2, tags: ['backbone'] },
    { from: 3, to: 1, tags: ['backbone'] },
    { from: 1, to: 4, tags: ['backbone'] },
    { from: 5, to: 1, tags: ['local'] },
    { from: 1, to: 6, tags: ['local'] }
  ];

  return {
    bounds,
    seed: 42,
    biomeId: 'temperate',
    densityBand: 1,
    buildable,
    roadMask,
    waterMask,
    roadGraph: { nodes, edges }
  };
}

describe('cell zoning pipeline', () => {
  it('produces multiple blocks and removes small islands', () => {
    const cell = makeTestCell();
    const { blockId } = makeBlocks(cell);
    const unique = new Set<number>();
    blockId.forEach((id) => {
      if (id >= 0) unique.add(id);
    });
    expect(unique.size).toBeGreaterThan(1);
    const tinyIdx = (3 * cell.bounds) + 3;
    expect(blockId[tinyIdx]).toBe(-1);
  });

  it('generates lots hugging road frontage', () => {
    const cell = makeTestCell();
    const blocks = makeBlocks(cell);
    const lots = extractLots({
      bounds: cell.bounds,
      blockId: blocks.blockId,
      buildable: cell.buildable,
      roadMask: cell.roadMask,
      waterMask: cell.waterMask
    });

    const frontageTouch = new Map<number, boolean>();
    for (let y = 0; y < cell.bounds; y++) {
      for (let x = 0; x < cell.bounds; x++) {
        const id = lots.lotId[y * cell.bounds + x];
        if (id < 0) continue;
        const adjacentRoad = DIR4.some(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cell.bounds || ny >= cell.bounds) return false;
          return cell.roadMask[ny * cell.bounds + nx] === 1;
        });
        if (adjacentRoad) frontageTouch.set(id, true);
      }
    }
    expect(frontageTouch.size).toBe(lots.lots.length);
  });

  it('mixes zoning near the configured density band ratios', () => {
    const cell = makeTestCell();
    const blocks = makeBlocks(cell);
    const lots = extractLots({
      bounds: cell.bounds,
      blockId: blocks.blockId,
      buildable: cell.buildable,
      roadMask: cell.roadMask,
      waterMask: cell.waterMask
    });
    const lotKind = applyZoning({
      densityBand: cell.densityBand,
      biomeId: cell.biomeId,
      roadGraph: cell.roadGraph,
      blockStats: blocks.blockStats,
      lots: lots.lots
    });

    const counts = lotKind.reduce<Record<string, number>>((acc, kind) => {
      acc[kind] = (acc[kind] ?? 0) + 1;
      return acc;
    }, {});
    const total = lotKind.length || 1;
    const targets = { residential: 0.55, commercial: 0.25, park: 0.1, civic: 0.05, industrial: 0.05 };
    (Object.keys(targets) as Array<keyof typeof targets>).forEach((key) => {
      const actual = (counts[key] ?? 0) / total;
      expect(Math.abs(actual - targets[key])).toBeLessThanOrEqual(0.1);
    });
  });

  it('remains deterministic for identical seeds', () => {
    const cell = makeTestCell();
    const blocks = makeBlocks(cell);
    const lots = extractLots({
      bounds: cell.bounds,
      blockId: blocks.blockId,
      buildable: cell.buildable,
      roadMask: cell.roadMask,
      waterMask: cell.waterMask
    });
    const resultA = applyZoning({
      densityBand: cell.densityBand,
      biomeId: cell.biomeId,
      roadGraph: cell.roadGraph,
      blockStats: blocks.blockStats,
      lots: lots.lots
    });
    const resultB = applyZoning({
      densityBand: cell.densityBand,
      biomeId: cell.biomeId,
      roadGraph: cell.roadGraph,
      blockStats: blocks.blockStats,
      lots: lots.lots
    });
    expect(resultA.join(',')).toEqual(resultB.join(','));
  });

  it('keeps invariants between block and lot rasters', () => {
    const cell = makeTestCell();
    const blocks = makeBlocks(cell);
    const lots = extractLots({
      bounds: cell.bounds,
      blockId: blocks.blockId,
      buildable: cell.buildable,
      roadMask: cell.roadMask,
      waterMask: cell.waterMask
    });

    for (let i = 0; i < blocks.blockId.length; i++) {
      if (blocks.blockId[i] === -1) {
        expect(lots.lotId[i]).toBe(-1);
      }
    }

    const lotAreas = new Map<number, number>();
    lots.lotId.forEach((id) => {
      if (id < 0) return;
      lotAreas.set(id, (lotAreas.get(id) ?? 0) + 1);
    });
    lotAreas.forEach((area) => {
      expect(area).toBeGreaterThanOrEqual(ZONING_CFG.lotMinAreaPx);
    });
  });
});
