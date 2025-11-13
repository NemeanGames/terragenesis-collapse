import { describe, expect, it } from "vitest";

import { buildMinimumSpanningTree, buildRoadMst, dist, edgeCost } from "../src/city-core/generate";
import { mulberry32 } from "../src/city-core/seed";
import { createDefaultCityParams } from "../src/city-core/types";

describe("minimum spanning tree", () => {
  it("connects all hubs for a fixed seed", () => {
    const rng = mulberry32(123456789);
    const hubs: Array<[number, number]> = Array.from({ length: 25 }, () => [
      rng() * 512,
      rng() * 512
    ]);

    const edges = buildMinimumSpanningTree(hubs);
    expect(edges).toHaveLength(hubs.length - 1);

    const parent = hubs.map((_, index) => index);
    const find = (i: number): number => {
      if (parent[i] === i) return i;
      parent[i] = find(parent[i]);
      return parent[i];
    };
    const unite = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };

    for (const edge of edges) {
      const ia = hubs.indexOf(edge.a);
      const ib = hubs.indexOf(edge.b);
      expect(ia).toBeGreaterThan(-1);
      expect(ib).toBeGreaterThan(-1);
      unite(ia, ib);
    }

    const root = find(0);
    for (let i = 1; i < hubs.length; i++) {
      expect(find(i)).toBe(root);
    }
  });

  it("keeps distance symmetric", () => {
    const rng = mulberry32(2024);
    for (let i = 0; i < 50; i++) {
      const a: [number, number] = [rng() * 1000, rng() * 1000];
      const b: [number, number] = [rng() * 1000, rng() * 1000];
      expect(dist(a, b)).toBeCloseTo(dist(b, a), 9);
    }
  });

  it("remains deterministic for matching seeds and params", () => {
    const params = createDefaultCityParams();
    params.mstHubs = 20;
    const gates: Array<[number, number]> = [
      [0, 0],
      [params.width, params.height * 0.5],
      [params.width * 0.5, 0]
    ];

    const edgesA = buildRoadMst(987654, params, gates);
    const paramsCopy = { ...params };
    const gatesCopy = gates.map((g) => [...g] as [number, number]);
    const edgesB = buildRoadMst(987654, paramsCopy, gatesCopy);

    expect(edgesA).toHaveLength(edgesB.length);

    const totalCost = (edges: Array<{ a: [number, number]; b: [number, number] }>) =>
      edges.reduce((acc, edge) => acc + edgeCost(edge.a, edge.b), 0);

    expect(totalCost(edgesA)).toBeCloseTo(totalCost(edgesB), 9);
  });
});
