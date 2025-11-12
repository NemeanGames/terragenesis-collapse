import * as THREE from "three";
import { createTerrainGeometry } from "../../render/assets/geometries";
import { createTerrainMaterial } from "../../render/assets/materials";

export const GRID = 256;
export const SIZE = 256;

export const ELEV_BANDS = { WATER: 0.34, LOW: 0.56, HIGH: 0.82 } as const;

export const BAND_COLORS = {
  water: new THREE.Color(0x1852aa),
  lowland: new THREE.Color(0x307854),
  upland: new THREE.Color(0x75623e),
  mountain: new THREE.Color(0x9b938b)
} as const;

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const makeRng = (seed: number) => () => ((seed = Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;

export function elevBand(z: number) {
  if (z <= ELEV_BANDS.WATER) return "water" as const;
  if (z <= ELEV_BANDS.LOW) return "lowland" as const;
  if (z <= ELEV_BANDS.HIGH) return "upland" as const;
  return "mountain" as const;
}

export function sampleHeight(height: Float32Array[], x: number, y: number) {
  const ix = clamp(Math.floor(x), 0, GRID - 1);
  const iy = clamp(Math.floor(y), 0, GRID - 1);
  const fx = x - ix;
  const fy = y - iy;
  const a = height[iy][ix];
  const b = height[iy][ix + 1];
  const c = height[iy + 1][ix];
  const d = height[iy + 1][ix + 1];
  const top = lerp(a, b, fx);
  const bot = lerp(c, d, fx);
  return lerp(top, bot, fy);
}

export function diamondSquare(n = 8, rough = 0.58, rng: () => number = Math.random) {
  const size = (1 << n) + 1;
  const height = Array.from({ length: size }, () => new Float32Array(size));
  height[0][0] = rng();
  height[0][size - 1] = rng();
  height[size - 1][0] = rng();
  height[size - 1][size - 1] = rng();
  let step = size - 1;
  let scale = rough;
  while (step > 1) {
    const half = step >> 1;
    for (let y = half; y < size; y += step) {
      for (let x = half; x < size; x += step) {
        const avg =
          (height[y - half][x - half] +
            height[y - half][x + half] +
            height[y + half][x - half] +
            height[y + half][x + half]) * 0.25;
        height[y][x] = avg + (rng() * 2 - 1) * scale;
      }
    }
    for (let y = 0; y < size; y += half) {
      const shift = (y / half) & 1 ? 0 : half;
      for (let x = shift; x < size; x += step) {
        let acc = 0;
        let c = 0;
        if (y - half >= 0) {
          acc += height[y - half][x];
          c++;
        }
        if (y + half < size) {
          acc += height[y + half][x];
          c++;
        }
        if (x - half >= 0) {
          acc += height[y][x - half];
          c++;
        }
        if (x + half < size) {
          acc += height[y][x + half];
          c++;
        }
        height[y][x] = acc / c + (rng() * 2 - 1) * scale * 0.7;
      }
    }
    step = half;
    scale *= rough;
  }
  let mn = Infinity;
  let mx = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      mn = Math.min(mn, height[y][x]);
      mx = Math.max(mx, height[y][x]);
    }
  }
  const inv = 1 / (mx - mn || 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      height[y][x] = (height[y][x] - mn) * inv;
    }
  }
  return height;
}

export function buildTerrainMesh(height: Float32Array[], scaleY: number) {
  const geometry = createTerrainGeometry();
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array((GRID + 1) * (GRID + 1) * 3);
  let colorIndex = 0;
  for (let vy = 0; vy <= GRID; vy++) {
    for (let vx = 0; vx <= GRID; vx++) {
      const idx = vy * (GRID + 1) + vx;
      const z = height[vy][vx];
      position.setZ(idx, z * scaleY);
      const color = BAND_COLORS[elevBand(z)];
      colors[colorIndex++] = color.r;
      colors[colorIndex++] = color.g;
      colors[colorIndex++] = color.b;
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  const material = createTerrainMaterial();
  return new THREE.Mesh(geometry, material);
}
