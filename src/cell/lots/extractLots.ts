import { ZONING_CFG } from '../../config/cellZoning';
import type { BlockId, LotGeometry } from '../cellTypes';

export interface ExtractLotsInput {
  bounds: number;
  blockId: Int32Array;
  buildable: Uint8Array;
  roadMask: Uint8Array;
  waterMask?: Uint8Array;
}

export interface ExtractLotsResult {
  lotId: Int32Array;
  lots: LotGeometry[];
  lotBBox: LotGeometry['bbox'][];
}

const DIR4: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];

interface FrontCell {
  x: number;
  y: number;
  dir: [number, number];
}

function idx(bounds: number, x: number, y: number) {
  return y * bounds + x;
}

function getRoadDir(
  bounds: number,
  x: number,
  y: number,
  roadMask: Uint8Array
): [number, number] | null {
  for (const [dx, dy] of DIR4) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= bounds || ny >= bounds) continue;
    if (roadMask[idx(bounds, nx, ny)]) {
      return [dx, dy];
    }
  }
  return null;
}

function computeDepth(
  bounds: number,
  frontage: FrontCell[],
  dir: [number, number],
  blockId: Int32Array,
  lotId: Int32Array,
  currentBlock: number
) {
  const inwardX = -dir[0];
  const inwardY = -dir[1];
  let depth = 1;
  const maxDepth = ZONING_CFG.depthMaxPx;
  while (depth < maxDepth) {
    const nextDepth = depth + 1;
    let valid = true;
    for (const cell of frontage) {
      const nx = cell.x + inwardX * depth;
      const ny = cell.y + inwardY * depth;
      if (nx < 0 || ny < 0 || nx >= bounds || ny >= bounds) {
        valid = false;
        break;
      }
      const nIdx = idx(bounds, nx, ny);
      if (blockId[nIdx] !== currentBlock || lotId[nIdx] >= 0) {
        valid = false;
        break;
      }
    }
    if (!valid) break;
    depth = nextDepth;
  }
  return depth;
}

function rasterizeLot(
  bounds: number,
  lotIndex: number,
  frontage: FrontCell[],
  depth: number,
  dir: [number, number],
  lotId: Int32Array
) {
  const inwardX = -dir[0];
  const inwardY = -dir[1];
  const cells: number[] = [];
  for (const front of frontage) {
    for (let d = 0; d < depth; d++) {
      const x = front.x + inwardX * d;
      const y = front.y + inwardY * d;
      if (x < 0 || y < 0 || x >= bounds || y >= bounds) continue;
      const id = idx(bounds, x, y);
      lotId[id] = lotIndex;
      cells.push(id);
    }
  }
  return cells;
}

function bboxFromCells(bounds: number, cells: number[]): LotGeometry['bbox'] {
  let minX = bounds;
  let minY = bounds;
  let maxX = 0;
  let maxY = 0;
  for (const cell of cells) {
    const x = cell % bounds;
    const y = Math.floor(cell / bounds);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function centroidFromCells(bounds: number, cells: number[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const cell of cells) {
    sx += (cell % bounds) + 0.5;
    sy += Math.floor(cell / bounds) + 0.5;
  }
  const inv = cells.length ? 1 / cells.length : 0;
  return { x: sx * inv, y: sy * inv };
}

function waterAdjacency(
  bounds: number,
  cells: number[],
  waterMask?: Uint8Array
): number {
  if (!waterMask) return 0;
  let count = 0;
  for (const cell of cells) {
    const x = cell % bounds;
    const y = Math.floor(cell / bounds);
    for (const [dx, dy] of DIR4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= bounds || ny >= bounds) continue;
      if (waterMask[idx(bounds, nx, ny)]) count++;
    }
  }
  return count;
}

function edgeTouch(bounds: number, bbox: LotGeometry['bbox']) {
  return bbox.minX <= 0 || bbox.minY <= 0 || bbox.maxX >= bounds - 1 || bbox.maxY >= bounds - 1;
}

function partitionRun(length: number) {
  const target = Math.max(4, ZONING_CFG.frontageTargetPx);
  const lots = Math.max(1, Math.round(length / target));
  const base = Math.max(1, Math.floor(length / lots));
  const remainder = length - base * lots;
  const sizes: number[] = [];
  for (let i = 0; i < lots; i++) {
    sizes.push(base + (i < remainder ? 1 : 0));
  }
  return sizes;
}

export function extractLots(input: ExtractLotsInput): ExtractLotsResult {
  const { bounds, blockId, buildable, roadMask, waterMask } = input;
  const lotId = new Int32Array(bounds * bounds);
  lotId.fill(-1);

  const blockFronts = new Map<BlockId, { horizontal: Map<number, FrontCell[]>; vertical: Map<number, FrontCell[]> }>();

  for (let y = 0; y < bounds; y++) {
    for (let x = 0; x < bounds; x++) {
      const id = blockId[idx(bounds, x, y)];
      if (id < 0) continue;
      if (!buildable[idx(bounds, x, y)]) continue;
      const dir = getRoadDir(bounds, x, y, roadMask);
      if (!dir) continue;
      const fronts = blockFronts.get(id) ?? {
        horizontal: new Map<number, FrontCell[]>(),
        vertical: new Map<number, FrontCell[]>()
      };
      if (!blockFronts.has(id)) blockFronts.set(id, fronts);
      if (dir[1] !== 0) {
        const row = fronts.horizontal.get(y) ?? [];
        row.push({ x, y, dir });
        fronts.horizontal.set(y, row);
      } else {
        const col = fronts.vertical.get(x) ?? [];
        col.push({ x, y, dir });
        fronts.vertical.set(x, col);
      }
    }
  }

  const lots: LotGeometry[] = [];

  const commitLot = (
    block: BlockId,
    frontageCells: FrontCell[],
    dir: [number, number]
  ) => {
    const depth = computeDepth(bounds, frontageCells, dir, blockId, lotId, block);
    if (depth < ZONING_CFG.depthMinPx) return;
    const area = frontageCells.length * depth;
    if (area < ZONING_CFG.lotMinAreaPx) return;
    const lotIndex = lots.length;
    const cells = rasterizeLot(bounds, lotIndex, frontageCells, depth, dir, lotId);
    if (!cells.length) return;
    const bbox = bboxFromCells(bounds, cells);
    const centroid = centroidFromCells(bounds, cells);
    const waterAdj = waterAdjacency(bounds, cells, waterMask);
    const frontPoints = frontageCells.map((f) => [f.x + 0.5, f.y + 0.5] as [number, number]);
    const uniqueDirs: Array<[number, number]> = [];
    for (const f of frontageCells) {
      if (!uniqueDirs.some(([ux, uy]) => ux === f.dir[0] && uy === f.dir[1])) {
        uniqueDirs.push([f.dir[0], f.dir[1]]);
      }
    }
    lots.push({
      id: lotIndex,
      blockId: block,
      frontage: frontageCells.length,
      depth,
      area,
      centroid,
      bbox,
      frontagePoints: frontPoints,
      roadDirections: uniqueDirs,
      edgeTouch: edgeTouch(bounds, bbox),
      waterAdj
    });
  };

  const processRun = (
    block: BlockId,
    seq: FrontCell[],
    orientation: 'horizontal' | 'vertical'
  ) => {
    if (!seq.length) return;
    seq.sort((a, b) => (orientation === 'horizontal' ? a.x - b.x : a.y - b.y));
    let run: FrontCell[] = [];
    for (const cell of seq) {
      if (!run.length) {
        run.push(cell);
        continue;
      }
      const last = run[run.length - 1];
      const contiguous =
        orientation === 'horizontal'
          ? cell.x === last.x + 1 && cell.y === last.y && cell.dir[1] === last.dir[1]
          : cell.y === last.y + 1 && cell.x === last.x && cell.dir[0] === last.dir[0];
      if (contiguous) {
        run.push(cell);
      } else {
        finalizeRun(block, run, orientation);
        run = [cell];
      }
    }
    finalizeRun(block, run, orientation);
  };

  const finalizeRun = (
    block: BlockId,
    run: FrontCell[],
    orientation: 'horizontal' | 'vertical'
  ) => {
    if (!run.length) return;
    const sizes = partitionRun(run.length);
    let offset = 0;
    for (const size of sizes) {
      const slice = run.slice(offset, offset + size);
      offset += size;
      if (!slice.length) continue;
      const head = slice[0];
      const dir = head.dir;
      const allFrontageCells = slice.slice();
      if (
        slice.some((front) => lotId[idx(bounds, front.x, front.y)] >= 0 || blockId[idx(bounds, front.x, front.y)] !== block)
      ) {
        continue;
      }
      commitLot(block, allFrontageCells, dir);
    }
  };

  for (const [block, fronts] of blockFronts.entries()) {
    for (const [, row] of fronts.horizontal.entries()) {
      processRun(block, row, 'horizontal');
    }
    for (const [, col] of fronts.vertical.entries()) {
      processRun(block, col, 'vertical');
    }
  }

  const lotBBox = lots.map((lot) => lot.bbox);
  return { lotId, lots, lotBBox };
}
