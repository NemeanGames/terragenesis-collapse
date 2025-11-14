import { describe, expect, it } from "vitest";
import { makeBaselineFBM, makeWarp4D, type Warp4DConfig } from "../src/gen/noise/warp4d";

const baseConfig: Warp4DConfig = {
  seed: 42,
  baseFrequency: 0.0025,
  octaves: 5,
  lacunarity: 2,
  gain: 0.5,
  warpAmplitude: 12,
  warpFrequency: 0.05,
};

describe("warp4d sampler", () => {
  it("keeps samples in [0,1] and free of NaN", () => {
    const sampler = makeWarp4D(baseConfig);
    for (let x = -10; x <= 10; x += 1) {
      for (let y = -10; y <= 10; y += 1) {
        const height = sampler.height(x, y);
        const moisture = sampler.moisture(x, y);
        expect(Number.isNaN(height)).toBe(false);
        expect(Number.isNaN(moisture)).toBe(false);
        expect(height).toBeGreaterThanOrEqual(0);
        expect(height).toBeLessThanOrEqual(1);
        expect(moisture).toBeGreaterThanOrEqual(0);
        expect(moisture).toBeLessThanOrEqual(1);
      }
    }
  });

  it("falls back to the baseline fbm when warp amplitude is zero", () => {
    const config = { ...baseConfig, warpAmplitude: 0 };
    const sampler = makeWarp4D(config);
    const baseline = makeBaselineFBM(`${config.seed}:height`, config);
    const baselineMoisture = makeBaselineFBM(`${config.seed}:moisture`, config);

    for (let i = 0; i < 50; i += 1) {
      const x = i * 1.37;
      const y = i * -0.91;
      expect(sampler.height(x, y)).toBeCloseTo(baseline(x, y), 6);
      expect(sampler.moisture(x, y)).toBeCloseTo(baselineMoisture(x, y), 6);
    }
  });

  it("is deterministic per seed", () => {
    const a = makeWarp4D(baseConfig);
    const b = makeWarp4D(baseConfig);

    for (let i = 0; i < 50; i += 1) {
      const x = i * 0.123;
      const y = i * -0.456;
      expect(a.height(x, y)).toBeCloseTo(b.height(x, y));
      expect(a.moisture(x, y)).toBeCloseTo(b.moisture(x, y));
    }
  });
});
