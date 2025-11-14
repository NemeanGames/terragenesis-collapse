import { describe, expect, it } from "vitest";

import { runPhysarum } from "../src/roads/physarum";
import { buildPhysarumPlan } from "../src/roads/planner";
import type { CostField, PhysarumParams, PlannerSources } from "../src/roads/types";

function createCostField(width: number, height: number, penalty = 0): CostField {
  const data = new Float32Array(width * height).fill(1 + penalty);
  return { width, height, data };
}

const baseParams: PhysarumParams = {
  iterations: 160,
  agentCount: 240,
  depositRate: 0.35,
  diffusionRate: 0.45,
  evaporationRate: 0.04,
  sensorAngle: Math.PI / 3,
  sensorDistance: 1.4,
  stepSize: 1,
  costInfluence: 0.35,
  threshold: 0.22,
  minBranchLength: 1,
  mergeDistance: 1.5,
  maxDetourFactor: 5,
  minCurvatureRadius: 0.5
};

describe("physarum core", () => {
  it("increases conductance near the source corridor", () => {
    const costField = createCostField(24, 24);
    const sources: PlannerSources[] = [
      { x: 4, y: 4 },
      { x: 20, y: 20 }
    ];
    const result = runPhysarum(costField, sources, baseParams, { maxIterations: 240 });
    expect(result.iterations).toBeGreaterThan(0);
    const { data } = result.field;
    let diagonal = 0;
    let offAxis = 0;
    for (let i = 0; i < 24; i++) {
      diagonal += data[i * 24 + i];
      offAxis += data[i * 24 + Math.max(0, Math.min(23, (i + 6) % 24))];
    }
    expect(diagonal).toBeGreaterThan(offAxis);
  });

  it("extracts a skeleton graph for a simple corridor", () => {
    const costField = createCostField(32, 32);
    const sources: PlannerSources[] = [
      { x: 6, y: 6 },
      { x: 26, y: 24 },
      { x: 16, y: 12 }
    ];
    const plan = buildPhysarumPlan(costField, sources, baseParams, { adaptiveThreshold: true });
    expect(plan.field.data.length).toBe(costField.data.length);
    expect(plan.mask.some((value) => value > 0)).toBe(true);
    expect(plan.graph.nodes.length).toBeGreaterThan(0);
    expect(plan.graph.edges.length).toBeGreaterThan(0);
    for (const edge of plan.graph.edges) {
      expect(edge.length).toBeGreaterThan(0);
      expect(edge.points.length).toBeGreaterThan(1);
      expect(edge.cost).toBeGreaterThanOrEqual(0);
    }
  });
});
