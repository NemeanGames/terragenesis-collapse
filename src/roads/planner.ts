import type { CostField, PhysarumParams, PhysarumPlan, PlannerSources } from "./types";
import { runPhysarum } from "./physarum";
import { fieldToMask, skeletonToGraph, thinMask } from "./skeleton";

export interface PhysarumPlannerOptions {
  adaptiveThreshold?: boolean;
  thresholdMultiplier?: number;
}

export function buildPhysarumPlan(
  costField: CostField,
  sources: PlannerSources[],
  params: PhysarumParams,
  options: PhysarumPlannerOptions = {}
): PhysarumPlan {
  const result = runPhysarum(costField, sources, params);
  const { field } = result;
  const values = field.data;
  let threshold = params.threshold;
  if (options.adaptiveThreshold) {
    let mean = 0;
    let max = 0;
    for (const value of values) {
      mean += value;
      if (value > max) max = value;
    }
    mean /= values.length || 1;
    const multiplier = options.thresholdMultiplier ?? 1.5;
    threshold = Math.min(max * 0.8, Math.max(mean * multiplier, params.threshold));
  }
  const rawMask = fieldToMask(field, threshold);
  let mask = thinMask(rawMask, field.width, field.height);
  let graph = skeletonToGraph(mask, field, params, costField);
  if (graph.edges.length === 0) {
    mask = rawMask;
    graph = skeletonToGraph(mask, field, params, costField);
  }
  return {
    field,
    mask,
    graph,
    iterations: result.iterations,
    converged: result.converged
  };
}
