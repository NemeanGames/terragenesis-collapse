import { mergePhysarumWithMST, runPhysarumRoads, type MaskFn } from "./physarum";
import { hashStr, mulberry32 } from "./seed";
import type { CityData, CityParams, RoadEdge, WorldConstraints } from "./types";

function buildMask(width: number, height: number, _constraints: WorldConstraints, _openMask: number): MaskFn {
  return (_x, _z) => 1;
}

function placeholderRoads(seed: number, params: CityParams): Array<{ a: [number, number]; b: [number, number] }> {
  const rng = mulberry32(seed ^ hashStr("mst"));
  const edges: Array<{ a: [number, number]; b: [number, number] }> = [];
  const hubs = Math.max(3, params.mstHubs);
  const stepX = params.width / hubs;
  for (let i = 0; i < hubs; i++) {
    const ax = stepX * i + rng() * stepX * 0.2;
    const bx = stepX * (i + 1) + rng() * stepX * 0.2;
    const ay = rng() * params.height;
    const by = rng() * params.height;
    edges.push({ a: [ax, ay], b: [bx, by] });
  }
  return edges;
}

export function generate(seed: number, params: CityParams, constraints: WorldConstraints): CityData {
  const rng = mulberry32(seed ^ hashStr("city"));
  const mst = placeholderRoads(seed, params);
  const gates = (constraints.gates ?? []).map((gate) => {
    const x = gate.edge === "W" ? 0 : gate.edge === "E" ? params.width : gate.t * params.width;
    const z = gate.edge === "N" ? 0 : gate.edge === "S" ? params.height : gate.t * params.height;
    return { edge: gate.edge, t: gate.t, x, z, width: gate.width };
  });

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
