import * as THREE from "three";
import { createRiverMaterial } from "../../render/assets/materials";
import { ELEV_BANDS, GRID, SIZE, sampleHeight } from "./heightmap";

export interface BuildRiversOptions {
  count?: number;
  minLen?: number;
  rng?: () => number;
}

export function buildRivers(
  height: Float32Array[],
  { count = 120, minLen = 40, rng = Math.random as () => number }: BuildRiversOptions = {}
) {
  const rivers: number[][][] = [];
  const inBounds = (x: number, y: number) => x > 0 && y > 0 && x < GRID && y < GRID;
  const pickHigh = () => {
    for (let t = 0; t < 4000; t++) {
      const x = 1 + (rng() * (GRID - 2)) | 0;
      const y = 1 + (rng() * (GRID - 2)) | 0;
      if (height[y][x] > ELEV_BANDS.HIGH) return { x, y };
    }
    return { x: (rng() * GRID) | 0, y: (rng() * GRID) | 0 };
  };
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ] as const;
  for (let i = 0; i < count; i++) {
    let { x, y } = pickHigh();
    const path: number[][] = [];
    let guard = 0;
    let stuck = 0;
    while (inBounds(x, y) && height[y][x] > ELEV_BANDS.WATER && guard < 3000) {
      path.push([x, y]);
      let bestDx = 0;
      let bestDy = 0;
      let best = 0;
      const curr = height[y][x];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const down = curr - height[ny][nx];
        if (down > best) {
          best = down;
          bestDx = dx;
          bestDy = dy;
        }
      }
      if (best <= 1e-4) {
        const r = dirs[(rng() * dirs.length) | 0];
        x += r[0];
        y += r[1];
        stuck++;
        if (stuck > 12) break;
      } else {
        x += bestDx;
        y += bestDy;
        stuck = 0;
      }
      guard++;
    }
    if (path.length >= minLen) rivers.push(path);
  }
  return rivers;
}

export function buildRiversGroup(rivers: number[][][], height: Float32Array[], scaleY: number) {
  const group = new THREE.Group();
  const material = createRiverMaterial();
  for (const path of rivers.slice(0, 200)) {
    const positions = new Float32Array(path.length * 3);
    for (let p = 0; p < path.length; p++) {
      const [x, y] = path[p];
      const wx = x - SIZE / 2;
      const wy = sampleHeight(height, x, y) * scaleY + 0.05;
      const wz = y - SIZE / 2;
      positions[p * 3 + 0] = wx;
      positions[p * 3 + 1] = wy;
      positions[p * 3 + 2] = wz;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(geometry, material);
    group.add(line);
  }
  return group;
}
