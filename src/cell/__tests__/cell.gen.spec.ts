import { describe, expect, it } from "vitest";
import { generateCellFromMacro } from "../../cell/generateCell";
import type { TerrainTileMeta } from "../../state/types";

describe("generateCellFromMacro", () => {
  const baseTile: TerrainTileMeta = {
    height: 0.42,
    slope: 0.22,
    moisture: 0.5,
    biomeId: 3,
    waterMask: 0,
    coastFlag: false,
    densityBand: 0.6
  };

  it("produces deterministic output for the same seed", () => {
    const first = generateCellFromMacro(123, baseTile);
    const second = generateCellFromMacro(123, baseTile);
    expect(first).toEqual(second);
  });

  it("reduces buildable percentage as slope increases", () => {
    const gentle = generateCellFromMacro(1, { ...baseTile, slope: 0.1 });
    const steep = generateCellFromMacro(1, { ...baseTile, slope: 0.65 });
    expect(gentle.stats.buildablePct).toBeGreaterThan(steep.stats.buildablePct);
  });

  it("creates at least one road and lot", () => {
    const cell = generateCellFromMacro(7, baseTile);
    expect(cell.roads.length).toBeGreaterThan(0);
    expect(cell.roads[0].path.length).toBeGreaterThan(2);
    expect(cell.lots.length).toBeGreaterThan(0);
  });
});
