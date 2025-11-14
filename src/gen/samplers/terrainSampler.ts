import { makeWarp4D, type Warp4DConfig, type Warp4DSampler } from "../noise/warp4d";

export interface TerrainSamplerConfig extends Warp4DConfig {}

export type TerrainSampler = Warp4DSampler;

export function createTerrainSampler(config: TerrainSamplerConfig): TerrainSampler {
  return makeWarp4D(config);
}

export { makeWarp4D } from "../noise/warp4d";
