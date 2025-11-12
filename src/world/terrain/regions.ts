import type { RegionCategory } from "../../state/types";
import { ELEV_BANDS, SIZE, clamp, sampleHeight } from "./heightmap";
import type { SeedPoint } from "./seeds";

export interface RegionAnalysis {
  category: RegionCategory;
  metrics: {
    elevation: number;
    slope: number;
    distanceToSettlement: number;
    moisture: number;
    coastal: boolean;
  };
}

export function analyzeRegion({
  height,
  seeds,
  worldX,
  worldZ
}: {
  height: Float32Array[];
  seeds: SeedPoint[];
  worldX: number;
  worldZ: number;
}): RegionAnalysis | null {
  const hx = clamp(worldX + SIZE / 2, 0, SIZE - 1);
  const hz = clamp(worldZ + SIZE / 2, 0, SIZE - 1);
  const elevation = sampleHeight(height, hx, hz);
  if (elevation <= ELEV_BANDS.WATER + 0.01) {
    return null;
  }

  const step = 2;
  const east = sampleHeight(height, hx + step, hz);
  const west = sampleHeight(height, hx - step, hz);
  const north = sampleHeight(height, hx, hz - step);
  const south = sampleHeight(height, hx, hz + step);
  const slope = Math.max(Math.abs(east - west), Math.abs(north - south));

  let minSettlement = Infinity;
  for (const seed of seeds) {
    const sx = seed.x - SIZE / 2;
    const sz = seed.y - SIZE / 2;
    const dx = sx - worldX;
    const dz = sz - worldZ;
    const dist = Math.hypot(dx, dz);
    if (dist < minSettlement) minSettlement = dist;
  }

  const moistureInfo = estimateMoisture(height, hx, hz);

  const category = classifyRegion({
    elevation,
    slope,
    distanceToSettlement: minSettlement,
    moisture: moistureInfo.moisture
  });

  return {
    category,
    metrics: {
      elevation,
      slope,
      distanceToSettlement: minSettlement,
      moisture: moistureInfo.moisture,
      coastal: moistureInfo.coastal
    }
  };
}

function classifyRegion({
  elevation,
  slope,
  distanceToSettlement,
  moisture
}: {
  elevation: number;
  slope: number;
  distanceToSettlement: number;
  moisture: number;
}): RegionCategory {
  if (distanceToSettlement <= 16) return "urbanCore";
  if (distanceToSettlement <= 32) return "urbanDistrict";
  if (slope > 0.22 || elevation >= ELEV_BANDS.HIGH + 0.04) return "wilderness";
  if (moisture < 0.18 || elevation <= ELEV_BANDS.WATER + 0.04) return "wilderness";
  return "rural";
}

function estimateMoisture(height: Float32Array[], hx: number, hz: number) {
  const offsets = [-36, -24, -12, 0, 12, 24, 36];
  let closest = Infinity;
  for (const ox of offsets) {
    for (const oz of offsets) {
      if (ox === 0 && oz === 0) continue;
      const x = clamp(hx + ox, 0, SIZE - 1);
      const z = clamp(hz + oz, 0, SIZE - 1);
      const elev = sampleHeight(height, x, z);
      if (elev <= ELEV_BANDS.WATER) {
        const dist = Math.hypot(ox, oz);
        if (dist < closest) closest = dist;
      }
    }
  }
  if (closest === Infinity) {
    return { moisture: 0.2, coastal: false };
  }
  const moisture = Math.max(0.1, Math.min(1, 1 - closest / 64));
  return { moisture, coastal: closest <= 8 };
}
