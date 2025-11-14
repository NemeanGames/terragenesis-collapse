import { GRID, ELEV_BANDS, clamp, sampleHeight } from "./heightmap";
import type { PhysarumParams, PhysarumPlan, PlannerSources } from "../../roads/types";
import { buildPhysarumPlan } from "../../roads/planner";
import type { CostField } from "../../roads/types";

export interface PhysarumWorldContext {
  height: Float32Array[];
  seeds: Array<{ x: number; y: number }>;
}

function buildCostField({ height }: PhysarumWorldContext): CostField {
  const width = GRID;
  const heightCells = GRID;
  const data = new Float32Array(width * heightCells);
  for (let y = 0; y < heightCells; y++) {
    for (let x = 0; x < width; x++) {
      const hx = x + 0.5;
      const hy = y + 0.5;
      const elev = sampleHeight(height, hx, hy);
      const east = sampleHeight(height, hx + 1, hy);
      const west = sampleHeight(height, hx - 1, hy);
      const north = sampleHeight(height, hx, hy - 1);
      const south = sampleHeight(height, hx, hy + 1);
      const slope = Math.max(Math.abs(east - west), Math.abs(north - south));
      const slopePenalty = slope * slope * 40;
      const waterPenalty = elev <= ELEV_BANDS.WATER ? 120 : 0;
      const edgePenalty = Math.max(0, 6 - Math.min(Math.min(x, width - 1 - x), Math.min(y, heightCells - 1 - y)));
      data[y * width + x] = 1 + slopePenalty + waterPenalty + edgePenalty * 2;
    }
  }
  return { width, height: heightCells, data };
}

function buildSources({ seeds, height }: PhysarumWorldContext): PlannerSources[] {
  const usable = seeds.filter((seed) => {
    const elev = sampleHeight(height, seed.x, seed.y);
    return elev > ELEV_BANDS.WATER + 0.01;
  });
  const top = usable.slice(0, 48);
  return top.map((seed) => ({ x: clamp(seed.x, 0, GRID - 1), y: clamp(seed.y, 0, GRID - 1), weight: 1 }));
}

export function planWorldPhysarum(
  context: PhysarumWorldContext,
  params: PhysarumParams
): PhysarumPlan {
  const costField = buildCostField(context);
  const sources = buildSources(context);
  return buildPhysarumPlan(costField, sources, params, { adaptiveThreshold: true, thresholdMultiplier: 2 });
}
