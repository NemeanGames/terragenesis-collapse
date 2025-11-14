import { ZONING_CFG } from '../../config/cellZoning';
import type { BlockId, BlockStats, LotGeometry, LotKind, RoadGraph } from '../cellTypes';

export interface ApplyZoningInput {
  densityBand: 0 | 1 | 2;
  biomeId: string;
  roadGraph: RoadGraph;
  blockStats: Map<BlockId, BlockStats>;
  lots: LotGeometry[];
}

const MIX_TARGETS: Record<0 | 1 | 2, Record<Exclude<LotKind, 'none'>, number>> = {
  0: {
    residential: 0.7,
    commercial: 0.15,
    industrial: 0.05,
    park: 0.1,
    civic: 0.04
  },
  1: {
    residential: 0.55,
    commercial: 0.25,
    industrial: 0.05,
    park: 0.1,
    civic: 0.05
  },
  2: {
    residential: 0.45,
    commercial: 0.35,
    industrial: 0.06,
    park: 0.08,
    civic: 0.06
  }
};

const LOT_COLORS: Record<Exclude<LotKind, 'none'>, string> = {
  residential: '#6fbf73',
  commercial: '#4ea6d8',
  industrial: '#b8a14f',
  park: '#4caf7d',
  civic: '#d084d1'
};

function distanceSq(a: [number, number], b: [number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function distanceToSegment(point: [number, number], a: [number, number], b: [number, number]) {
  const [px, py] = point;
  let [ax, ay] = a;
  let [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const cx = ax + clamped * dx;
  const cy = ay + clamped * dy;
  return Math.hypot(px - cx, py - cy);
}

function lotScoreForBackbone(lot: LotGeometry, backboneSegments: Array<[[number, number], [number, number]]>) {
  let min = Infinity;
  for (const [a, b] of backboneSegments) {
    for (const point of lot.frontagePoints) {
      const dist = distanceToSegment(point, a, b);
      if (dist < min) min = dist;
    }
  }
  return min;
}

function lotDistanceToIntersections(
  lot: LotGeometry,
  intersections: [number, number][],
  fallback: number
) {
  let min = fallback;
  for (const node of intersections) {
    const d = Math.sqrt(distanceSq([lot.centroid.x, lot.centroid.y], node));
    if (d < min) min = d;
  }
  return min;
}

function computeBackboneSegments(roadGraph: RoadGraph) {
  const nodeById = new Map<number, [number, number]>();
  for (const node of roadGraph.nodes) {
    nodeById.set(node.id, node.position);
  }
  const segments: Array<[[number, number], [number, number]]> = [];
  for (const edge of roadGraph.edges) {
    if (!edge.tags?.includes(ZONING_CFG.backboneTag)) continue;
    const a = nodeById.get(edge.from);
    const b = nodeById.get(edge.to);
    if (!a || !b) continue;
    segments.push([a, b]);
  }
  return segments;
}

function intersectionNodes(roadGraph: RoadGraph) {
  const degree = new Map<number, number>();
  for (const edge of roadGraph.edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  const nodes: [number, number][] = [];
  for (const node of roadGraph.nodes) {
    if ((degree.get(node.id) ?? 0) >= 3) {
      nodes.push(node.position);
    }
  }
  return nodes;
}

function clampTarget(total: number, ratio: number, max: number) {
  if (ratio <= 0) return 0;
  const count = Math.round(total * ratio);
  return Math.max(0, Math.min(max, count));
}

function pickLots(
  available: Set<number>,
  candidates: Array<{ id: number; score: number }>,
  limit: number
) {
  const out: number[] = [];
  const sorted = candidates.slice().sort((a, b) => (a.score === b.score ? a.id - b.id : b.score - a.score));
  for (const candidate of sorted) {
    if (out.length >= limit) break;
    if (!available.has(candidate.id)) continue;
    out.push(candidate.id);
    available.delete(candidate.id);
  }
  return out;
}

function markKinds(kinds: LotKind[], indices: number[], kind: LotKind) {
  for (const id of indices) {
    kinds[id] = kind;
  }
}

export function applyZoning(input: ApplyZoningInput): LotKind[] {
  const { densityBand, roadGraph, lots, blockStats } = input;
  const totalLots = lots.length;
  const kinds: LotKind[] = new Array(totalLots).fill('residential');
  if (!totalLots) return kinds;

  const available = new Set(lots.map((lot) => lot.id));
  const targets = MIX_TARGETS[densityBand];

  const backboneSegments = computeBackboneSegments(roadGraph);
  const intersections = intersectionNodes(roadGraph);

  const backboneThreshold = 8;

  const commercialCandidates: Array<{ id: number; score: number }> = [];
  const parkCandidates: Array<{ id: number; score: number }> = [];
  const civicCandidates: Array<{ id: number; score: number }> = [];
  const industrialCandidates: Array<{ id: number; score: number }> = [];

  const intersectionInfluence = ZONING_CFG.intersectionInfluencePx;

  for (const lot of lots) {
    const block = blockStats.get(lot.blockId);
    const backboneDist = backboneSegments.length
      ? lotScoreForBackbone(lot, backboneSegments)
      : Number.POSITIVE_INFINITY;
    const nearBackbone = backboneDist <= backboneThreshold;
    const intersectionDist = lotDistanceToIntersections(lot, intersections, intersectionInfluence * 2);
    const intersectionScore = Math.max(0, intersectionInfluence - intersectionDist);
    const waterScore = lot.waterAdj + (block?.waterAdj ?? 0) * 0.1;
    const isCorner = lot.roadDirections.length > 1 || intersectionDist < intersectionInfluence * 0.5;
    const edgeBonus = lot.edgeTouch ? 1 : 0;

    if (nearBackbone || intersectionScore > 0) {
      commercialCandidates.push({
        id: lot.id,
        score: intersectionScore + (nearBackbone ? lot.frontage * 0.5 : 0)
      });
    }

    if (waterScore > 0 || (block?.waterAdj ?? 0) > 0) {
      parkCandidates.push({ id: lot.id, score: waterScore + edgeBonus * 0.5 });
    }

    if (isCorner) {
      civicCandidates.push({ id: lot.id, score: lot.area + intersectionScore * 4 });
    }

    if (lot.edgeTouch && nearBackbone) {
      industrialCandidates.push({ id: lot.id, score: lot.area - waterScore * 0.5 });
    }
  }

  const maxCommercial = clampTarget(totalLots, targets.commercial, totalLots);
  const maxPark = clampTarget(totalLots, targets.park, totalLots);
  const maxCivic = Math.min(2, clampTarget(totalLots, targets.civic, totalLots));
  const maxIndustrial = Math.min(totalLots, clampTarget(totalLots, targets.industrial, totalLots));

  const chosenParks = pickLots(available, parkCandidates, maxPark);
  markKinds(kinds, chosenParks, 'park');

  const civicPool = pickLots(available, civicCandidates, maxCivic);
  markKinds(kinds, civicPool, 'civic');

  const commercialPool = pickLots(available, commercialCandidates, maxCommercial);
  markKinds(kinds, commercialPool, 'commercial');

  const industrialPool = pickLots(available, industrialCandidates, maxIndustrial);
  markKinds(kinds, industrialPool, 'industrial');

  for (const id of available) {
    kinds[id] = 'residential';
  }

  return kinds;
}

export { LOT_COLORS };
