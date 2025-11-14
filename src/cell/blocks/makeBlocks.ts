import { ZONING_CFG } from '../../config/cellZoning';
import type { BlockId, BlockStats, Cell } from '../cellTypes';

export interface MakeBlocksResult {
  blockId: Int32Array;
  blockStats: Map<BlockId, BlockStats>;
}

const DIR4: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];

export function makeBlocks(cell: Pick<Cell, 'bounds' | 'buildable' | 'roadMask' | 'waterMask'>): MakeBlocksResult {
  const { bounds, buildable, roadMask, waterMask } = cell;
  const size = bounds * bounds;
  const blockId = new Int32Array(size);
  blockId.fill(-1);

  const blockStats = new Map<BlockId, BlockStats>();
  const visited = new Uint8Array(size);
  let nextId = 0;

  const index = (x: number, y: number) => y * bounds + x;

  for (let y = 0; y < bounds; y++) {
    for (let x = 0; x < bounds; x++) {
      const idx = index(x, y);
      if (visited[idx]) continue;
      visited[idx] = 1;
      if (!buildable[idx] || roadMask[idx]) {
        continue;
      }

      const stack = [idx];
      const cells: number[] = [idx];
      let touchesEdge = x === 0 || y === 0 || x === bounds - 1 || y === bounds - 1;
      let waterAdj = 0;

      while (stack.length) {
        const cur = stack.pop()!;
        const cx = cur % bounds;
        const cy = Math.floor(cur / bounds);
        if (cx === 0 || cy === 0 || cx === bounds - 1 || cy === bounds - 1) {
          touchesEdge = true;
        }

        for (const [dx, dy] of DIR4) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= bounds || ny >= bounds) {
            touchesEdge = true;
            continue;
          }
          const nIdx = index(nx, ny);
          if (roadMask[nIdx]) {
            continue;
          }
          if (waterMask && waterMask[nIdx]) {
            waterAdj++;
          }
          if (!buildable[nIdx]) {
            continue;
          }
          if (visited[nIdx]) {
            continue;
          }
          visited[nIdx] = 1;
          stack.push(nIdx);
          cells.push(nIdx);
        }
      }

      if (cells.length < ZONING_CFG.lotMinAreaPx) {
        for (const id of cells) {
          blockId[id] = -1;
        }
        continue;
      }

      const currentId = nextId++;
      for (const id of cells) {
        blockId[id] = currentId;
      }
      blockStats.set(currentId, {
        area: cells.length,
        edgeTouch: touchesEdge,
        waterAdj
      });
    }
  }

  return { blockId, blockStats };
}
