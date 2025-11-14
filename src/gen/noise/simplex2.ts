const STRETCH_CONSTANT_2D = -0.2113248654051871; // (1/\u221a(2+1) - 1)/2
const SQUISH_CONSTANT_2D = 0.3660254037844386; // (\u221a(2+1) - 1)/2
const NORM_CONSTANT_2D = 47;

const gradients2D = new Int8Array([
  5, 2,
  2, 5,
  -5, 2,
  -2, 5,
  5, -2,
  2, -5,
  -5, -2,
  -2, -5,
]);

function toSeedNumber(seed: number | string): number {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return seed | 0;
  }

  let hash = 2166136261;
  const str = String(seed);
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPermutation(seed: number): { perm: Uint8Array; permGradIndex: Uint8Array } {
  const random = mulberry32(seed);
  const source = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) {
    source[i] = i;
  }

  const perm = new Uint8Array(256);
  for (let i = 255; i >= 0; i -= 1) {
    const r = Math.floor((i + 1) * random());
    perm[i] = source[r];
    source[r] = source[i];
  }

  const permGradIndex = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) {
    permGradIndex[i] = (perm[i] % (gradients2D.length / 2)) * 2;
  }

  return { perm, permGradIndex };
}

function extrapolate(perm: Uint8Array, permGradIndex: Uint8Array, xsb: number, ysb: number, dx: number, dy: number): number {
  const index = permGradIndex[(perm[xsb & 0xff] + ysb) & 0xff];
  const gx = gradients2D[index];
  const gy = gradients2D[index + 1];
  return gx * dx + gy * dy;
}

export interface OpenSimplex2 {
  noise2D(x: number, y: number): number;
}

export function createOpenSimplex2(seed: number | string): OpenSimplex2 {
  const seedValue = toSeedNumber(seed);
  const { perm, permGradIndex } = buildPermutation(seedValue);

  return {
    noise2D(x: number, y: number): number {
      const stretchOffset = (x + y) * STRETCH_CONSTANT_2D;
      const xs = x + stretchOffset;
      const ys = y + stretchOffset;

      let xsb = Math.floor(xs);
      let ysb = Math.floor(ys);

      const squishOffset = (xsb + ysb) * SQUISH_CONSTANT_2D;
      let dx0 = x - (xsb + squishOffset);
      let dy0 = y - (ysb + squishOffset);

      const xins = xs - xsb;
      const yins = ys - ysb;
      const inSum = xins + yins;

      let value = 0;

      const dx1 = dx0 - 1 - SQUISH_CONSTANT_2D;
      const dy1 = dy0 - 0 - SQUISH_CONSTANT_2D;
      let attn1 = 2 - dx1 * dx1 - dy1 * dy1;
      if (attn1 > 0) {
        attn1 *= attn1;
        value += attn1 * attn1 * extrapolate(perm, permGradIndex, xsb + 1, ysb + 0, dx1, dy1);
      }

      const dx2 = dx0 - 0 - SQUISH_CONSTANT_2D;
      const dy2 = dy0 - 1 - SQUISH_CONSTANT_2D;
      let attn2 = 2 - dx2 * dx2 - dy2 * dy2;
      if (attn2 > 0) {
        attn2 *= attn2;
        value += attn2 * attn2 * extrapolate(perm, permGradIndex, xsb + 0, ysb + 1, dx2, dy2);
      }

      let dxExt: number;
      let dyExt: number;
      let xsvExt: number;
      let ysvExt: number;

      if (inSum <= 1) {
        const zins = 1 - inSum;
        if (zins > xins || zins > yins) {
          if (xins > yins) {
            xsvExt = xsb + 1;
            ysvExt = ysb - 1;
            dxExt = dx0 - 1;
            dyExt = dy0 + 1;
          } else {
            xsvExt = xsb - 1;
            ysvExt = ysb + 1;
            dxExt = dx0 + 1;
            dyExt = dy0 - 1;
          }
        } else {
          xsvExt = xsb + 1;
          ysvExt = ysb + 1;
          dxExt = dx0 - 1 - 2 * SQUISH_CONSTANT_2D;
          dyExt = dy0 - 1 - 2 * SQUISH_CONSTANT_2D;
        }
      } else {
        const zins = 2 - inSum;
        if (zins < xins || zins < yins) {
          if (xins > yins) {
            xsvExt = xsb + 2;
            ysvExt = ysb + 0;
            dxExt = dx0 - 2 - 2 * SQUISH_CONSTANT_2D;
            dyExt = dy0 - 0 - 2 * SQUISH_CONSTANT_2D;
          } else {
            xsvExt = xsb + 0;
            ysvExt = ysb + 2;
            dxExt = dx0 - 0 - 2 * SQUISH_CONSTANT_2D;
            dyExt = dy0 - 2 - 2 * SQUISH_CONSTANT_2D;
          }
        } else {
          xsvExt = xsb + 1;
          ysvExt = ysb + 1;
          dxExt = dx0 - 1 - 2 * SQUISH_CONSTANT_2D;
          dyExt = dy0 - 1 - 2 * SQUISH_CONSTANT_2D;
        }
        xsb += 1;
        ysb += 1;
        dx0 = dx0 - 1 - 2 * SQUISH_CONSTANT_2D;
        dy0 = dy0 - 1 - 2 * SQUISH_CONSTANT_2D;
      }

      let attn0 = 2 - dx0 * dx0 - dy0 * dy0;
      if (attn0 > 0) {
        attn0 *= attn0;
        value += attn0 * attn0 * extrapolate(perm, permGradIndex, xsb, ysb, dx0, dy0);
      }

      let dx3 = dxExt - SQUISH_CONSTANT_2D;
      let dy3 = dyExt - SQUISH_CONSTANT_2D;
      if (inSum <= 1) {
        dx3 = dxExt;
        dy3 = dyExt;
      }

      let attn3 = 2 - dx3 * dx3 - dy3 * dy3;
      if (attn3 > 0) {
        attn3 *= attn3;
        value += attn3 * attn3 * extrapolate(perm, permGradIndex, xsvExt, ysvExt, dx3, dy3);
      }

      return value / NORM_CONSTANT_2D;
    },
  };
}

export type { OpenSimplex2 as SimplexNoise2D };
