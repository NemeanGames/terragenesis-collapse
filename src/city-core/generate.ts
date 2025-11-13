import { mergePhysarumWithMST, runPhysarumRoads, type MaskFn } from "./physarum";
import { hashStr, mulberry32 } from "./seed";
import type { CityData, CityParams, RoadEdge, WorldConstraints } from "./types";

declare const sampleSlope: ((point: [number, number]) => number) | undefined;

export const dist = (a: [number, number], b: [number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

export const edgeCost = (a: [number, number], b: [number, number]) => {
  let d = dist(a, b);
  if (typeof sampleSlope === "function") {
    const sA = sampleSlope(a);
    const sB = sampleSlope(b);
    d *= 1 + 0.6 * Math.max(sA, sB);
  }
  return d;
};

export function buildMinimumSpanningTree(
  points: Array<[number, number]>
): Array<{ a: [number, number]; b: [number, number] }> {
  if (points.length < 2) return [];

  const parent = points.map((_, index) => index);
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

  const edges: Array<{ ia: number; ib: number; cost: number }> = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      edges.push({ ia: i, ib: j, cost: edgeCost(points[i], points[j]) });
    }
  }

  edges.sort((ea, eb) => {
    const diff = ea.cost - eb.cost;
    if (Math.abs(diff) > 1e-9) return diff;
    if (ea.ia !== eb.ia) return ea.ia - eb.ia;
    return ea.ib - eb.ib;
  });

  const result: Array<{ a: [number, number]; b: [number, number] }> = [];
  for (const { ia, ib } of edges) {
    if (find(ia) === find(ib)) continue;
    unite(ia, ib);
    result.push({ a: points[ia], b: points[ib] });
    if (result.length === points.length - 1) break;
  }

  return result;
}

function buildMask(width: number, height: number, _constraints: WorldConstraints, _openMask: number): MaskFn {
  return (_x, _z) => 1;
}

export function buildRoadMst(
  seed: number,
  params: CityParams,
  gatePoints: Array<[number, number]> = []
): Array<{ a: [number, number]; b: [number, number] }> {
  const rng = mulberry32(seed ^ hashStr("mst"));
  const hubs = Math.max(2, params.mstHubs);
  const points: Array<[number, number]> = [];
  for (let i = 0; i < hubs; i++) {
    points.push([rng() * params.width, rng() * params.height]);
  }
  for (const gate of gatePoints) points.push(gate);
  return buildMinimumSpanningTree(points);
}

export function generate(seed: number, params: CityParams, constraints: WorldConstraints): CityData {
  const rng = mulberry32(seed ^ hashStr("city"));
  const gates = (constraints.gates ?? []).map((gate) => {
    const x = gate.edge === "W" ? 0 : gate.edge === "E" ? params.width : gate.t * params.width;
    const z = gate.edge === "N" ? 0 : gate.edge === "S" ? params.height : gate.t * params.height;
    return { edge: gate.edge, t: gate.t, x, z, width: gate.width };
  });
  const gatePoints = gates.map((g) => [g.x, g.z] as [number, number]);
  const mst = buildRoadMst(seed, params, gatePoints);

  let roads: RoadEdge[] = mst.map((edge) => ({ a: edge.a, b: edge.b, width: 6, kind: "arterial" }));

  if (params.usePhysarum && params.physarum) {
    const mask = buildMask(params.width, params.height, constraints, params.openMask);
    const attractors = gates.map((g) => [g.x, g.z] as [number, number]);
    const phys = runPhysarumRoads(seed, params.width, params.height, params.physarum, mask, attractors);
    roads = mergePhysarumWithMST(phys, mst, attractors);
  }

  const districts = Array.from({ length: params.sites }, (_, i) => ({
    kind: i === 0 ? "central" : `district-${i}`,
    center: [rng() * params.width, rng() * params.height] as [number, number],
    radius: 24 + rng() * 32
  }));

  const pois = districts.slice(0, Math.max(1, Math.floor(params.sites * params.poiMultiplier * 0.4))).map((d, idx) => ({
    pos: [d.center[0] + rng() * 6 - 3, d.center[1] + rng() * 6 - 3] as [number, number],
    kind: idx % 2 === 0 ? "supply" : "hazard",
    label: `POI ${idx + 1}`,
    district: d.kind
  }));

  return {
    seed,
    districts,
    roads,
    gates,
    buildings: [],
    pois,
    debug: { msg: "placeholder" }
  };
}
