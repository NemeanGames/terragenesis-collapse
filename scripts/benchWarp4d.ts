import { benchmarkWarpSampler, type Warp4DConfig } from "../src/gen/noise/warp4d";

const config: Warp4DConfig = {
  seed: 1337,
  baseFrequency: 0.0025,
  octaves: 5,
  lacunarity: 2,
  gain: 0.5,
  warpAmplitude: 12,
  warpFrequency: 0.05,
};

benchmarkWarpSampler(config);
