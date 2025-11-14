import { createOpenSimplex2, OpenSimplex2 } from "./simplex2";

export interface FBMConfig {
  baseFrequency: number;
  octaves: number;
  lacunarity: number;
  gain: number;
}

export interface Warp4DConfig extends FBMConfig {
  seed: number | string;
  warpAmplitude: number;
  warpFrequency: number;
}

export interface Warp4DSampler {
  height(x: number, y: number): number;
  moisture(x: number, y: number): number;
}

interface ChannelNoise {
  base: OpenSimplex2;
  warpX: OpenSimplex2;
  warpY: OpenSimplex2;
}

function makeChannel(seed: number | string): ChannelNoise {
  return {
    base: createOpenSimplex2(seed),
    warpX: createOpenSimplex2(`${seed}:warpX`),
    warpY: createOpenSimplex2(`${seed}:warpY`),
  };
}

function fbm2D(noise: OpenSimplex2, x: number, y: number, config: FBMConfig): number {
  const { baseFrequency, octaves, lacunarity, gain } = config;
  let frequency = baseFrequency;
  let amplitude = 1;
  let sum = 0;
  let norm = 0;

  for (let i = 0; i < octaves; i += 1) {
    sum += noise.noise2D(x * frequency, y * frequency) * amplitude;
    norm += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }

  if (norm === 0) {
    return 0;
  }
  const value = sum / norm;
  return Math.min(1, Math.max(-1, value));
}

function domainWarp(channel: ChannelNoise, x: number, y: number, config: Warp4DConfig): [number, number] {
  if (config.warpAmplitude === 0) {
    return [x, y];
  }

  const warpX = channel.warpX.noise2D(x * config.warpFrequency, y * config.warpFrequency);
  const warpY = channel.warpY.noise2D((x + 101.7) * config.warpFrequency, (y - 77.3) * config.warpFrequency);

  return [x + warpX * config.warpAmplitude, y + warpY * config.warpAmplitude];
}

function normalise(value: number): number {
  return Math.min(1, Math.max(0, (value + 1) * 0.5));
}

export function makeWarp4D(config: Warp4DConfig): Warp4DSampler {
  const heightChannel = makeChannel(`${config.seed}:height`);
  const moistureChannel = makeChannel(`${config.seed}:moisture`);

  const fbmConfig: FBMConfig = {
    baseFrequency: config.baseFrequency,
    octaves: config.octaves,
    lacunarity: config.lacunarity,
    gain: config.gain,
  };

  return {
    height(x: number, y: number): number {
      const [wx, wy] = domainWarp(heightChannel, x, y, config);
      return normalise(fbm2D(heightChannel.base, wx, wy, fbmConfig));
    },
    moisture(x: number, y: number): number {
      const [wx, wy] = domainWarp(moistureChannel, x, y, config);
      return normalise(fbm2D(moistureChannel.base, wx, wy, fbmConfig));
    },
  };
}

export function makeBaselineFBM(seed: number | string, config: FBMConfig): (x: number, y: number) => number {
  const noise = createOpenSimplex2(seed);
  return (x: number, y: number) => normalise(fbm2D(noise, x, y, config));
}

const perf = typeof globalThis !== "undefined" && globalThis.performance ? globalThis.performance : { now: () => Date.now() };

export function benchmarkWarpSampler(config: Warp4DConfig, samples = 100_000): { heightMs: number; moistureMs: number } {
  const sampler = makeWarp4D(config);
  const startHeight = perf.now();
  let accum = 0;
  for (let i = 0; i < samples; i += 1) {
    const v = sampler.height(i * 0.001, i * 0.001);
    accum += v;
  }
  const heightMs = perf.now() - startHeight;

  const startMoisture = perf.now();
  for (let i = 0; i < samples; i += 1) {
    const v = sampler.moisture(i * 0.001, i * 0.001);
    accum += v;
  }
  const moistureMs = perf.now() - startMoisture;

  // Prevent optimisation removal.
  if (accum === Number.NEGATIVE_INFINITY) {
    throw new Error("Unexpected numeric state during warp4d benchmark");
  }

  const message = `warp4d benchmark — height: ${heightMs.toFixed(2)}ms, moisture: ${moistureMs.toFixed(2)}ms for ${samples} samples`;
  // eslint-disable-next-line no-console
  console.log(message);

  return { heightMs, moistureMs };
}
