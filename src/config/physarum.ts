import type { PhysarumParams } from "../roads/types";

export interface PhysarumFeatureConfig {
  enablePhysarumWorld: boolean;
  enablePhysarumCells: boolean;
  params: PhysarumParams;
}

export function createDefaultPhysarumParams(): PhysarumParams {
  return {
    iterations: 480,
    agentCount: 1800,
    depositRate: 0.22,
    diffusionRate: 0.36,
    evaporationRate: 0.045,
    sensorAngle: Math.PI / 3,
    sensorDistance: 2.2,
    stepSize: 1.05,
    costInfluence: 0.75,
    threshold: 0.48,
    minBranchLength: 6,
    mergeDistance: 2,
    maxDetourFactor: 2.6,
    minCurvatureRadius: 3.5
  } satisfies PhysarumParams;
}

export function createDefaultPhysarumConfig(): PhysarumFeatureConfig {
  return {
    enablePhysarumWorld: false,
    enablePhysarumCells: false,
    params: createDefaultPhysarumParams()
  };
}
