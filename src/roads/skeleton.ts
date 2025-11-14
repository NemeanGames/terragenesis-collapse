import type { CostField, PhysarumField, PhysarumParams, RoadEdge, RoadGraph, RoadNode } from "./types";

const IDX = (x: number, y: number, width: number) => y * width + x;

function cellCenter(x: number, y: number) {
  return { x: x + 0.5, y: y + 0.5 };
}

function neighbors(width: number, height: number, index: number) {
  const x = index % width;
  const y = Math.floor(index / width);
  const list: number[] = [];
  if (x > 0) list.push(index - 1);
  if (x < width - 1) list.push(index + 1);
  if (y > 0) list.push(index - width);
  if (y < height - 1) list.push(index + width);
  return list;
}

export function fieldToMask(field: PhysarumField, threshold: number) {
  const mask = new Uint8Array(field.width * field.height);
  const values = field.data;
  for (let i = 0; i < values.length; i++) {
    mask[i] = values[i] >= threshold ? 1 : 0;
  }
  return mask;
}

function countNeighbors(mask: Uint8Array, width: number, height: number, index: number) {
  if (!mask[index]) return 0;
  let count = 0;
  for (const neighbor of neighbors(width, height, index)) {
    if (mask[neighbor]) count++;
  }
  return count;
}

export function thinMask(mask: Uint8Array, width: number, height: number) {
  const next = mask.slice();
  let changed = true;
  const idx = (x: number, y: number) => IDX(x, y, width);
  while (changed) {
    changed = false;
    const toClear: number[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = idx(x, y);
        if (!next[i]) continue;
        const n = countNeighbors(next, width, height, i);
        if (n < 2 || n > 6) continue;
        const p2 = next[idx(x, y - 1)];
        const p4 = next[idx(x + 1, y)];
        const p6 = next[idx(x, y + 1)];
        const p8 = next[idx(x - 1, y)];
        const transitions =
          (!p2 && p4 ? 1 : 0) +
          (!p4 && p6 ? 1 : 0) +
          (!p6 && p8 ? 1 : 0) +
          (!p8 && p2 ? 1 : 0);
        if (transitions !== 1) continue;
        if (!p2 || !p4 || !p6) toClear.push(i);
      }
    }
    if (toClear.length) {
      changed = true;
      for (const i of toClear) next[i] = 0;
    }
    toClear.length = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = idx(x, y);
        if (!next[i]) continue;
        const n = countNeighbors(next, width, height, i);
        if (n < 2 || n > 6) continue;
        const p2 = next[idx(x, y - 1)];
        const p4 = next[idx(x + 1, y)];
        const p6 = next[idx(x, y + 1)];
        const p8 = next[idx(x - 1, y)];
        const transitions =
          (!p2 && p4 ? 1 : 0) +
          (!p4 && p6 ? 1 : 0) +
          (!p6 && p8 ? 1 : 0) +
          (!p8 && p2 ? 1 : 0);
        if (transitions !== 1) continue;
        if (!p2 || !p4 || !p8) toClear.push(i);
      }
    }
    if (toClear.length) {
      changed = true;
      for (const i of toClear) next[i] = 0;
    }
  }
  return next;
}

function ensureNode(
  index: number,
  width: number,
  nodes: Map<number, RoadNode>,
  mergeDistance: number,
  counter: { value: number }
) {
  const existing = nodes.get(index);
  if (existing) return existing;
  const x = index % width;
  const y = Math.floor(index / width);
  const center = cellCenter(x, y);
  for (const node of nodes.values()) {
    const dx = node.x - center.x;
    const dy = node.y - center.y;
    if (Math.hypot(dx, dy) <= mergeDistance) {
      nodes.set(index, node);
      return node;
    }
  }
  const node: RoadNode = {
    id: `n${counter.value++}`,
    x: center.x,
    y: center.y
  };
  nodes.set(index, node);
  return node;
}

function computeEdgeProperties(
  points: Array<{ x: number; y: number }>,
  costField?: CostField
) {
  let length = 0;
  let minRadius = Infinity;
  let totalCost = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    length += segment;
    if (costField) {
      const cx = (a.x + b.x) * 0.5;
      const cy = (a.y + b.y) * 0.5;
      const ix = Math.max(0, Math.min(costField.width - 1, Math.floor(cx)));
      const iy = Math.max(0, Math.min(costField.height - 1, Math.floor(cy)));
      totalCost += costField.data[IDX(ix, iy, costField.width)] * segment;
    }
    if (i < points.length - 1) {
      const c = points[i + 1];
      const ab = Math.hypot(b.x - a.x, b.y - a.y);
      const bc = Math.hypot(c.x - b.x, c.y - b.y);
      const ac = Math.hypot(c.x - a.x, c.y - a.y);
      const s = (ab + bc + ac) * 0.5;
      const areaSq = Math.max(s * (s - ab) * (s - bc) * (s - ac), 0);
      if (areaSq > 0 && ab > 0 && bc > 0 && ac > 0) {
        const area = Math.sqrt(areaSq);
        const radius = (ab * bc * ac) / (4 * area);
        if (radius < minRadius) minRadius = radius;
      }
    }
  }
  const curvature = minRadius === Infinity ? 0 : 1 / minRadius;
  const cost = length > 0 ? totalCost / length : 0;
  return { length, curvature, cost };
}

export function skeletonToGraph(
  mask: Uint8Array,
  field: PhysarumField,
  params: PhysarumParams,
  costField?: CostField
): RoadGraph {
  const { width, height } = field;
  const nodes = new Map<number, RoadNode>();
  const counter = { value: 0 };
  const graph: RoadGraph = { nodes: [], edges: [] };
  const visited = new Set<string>();
  const mergeDistance = params.mergeDistance;
  const minBranch = params.minBranchLength;

  const degree = new Map<number, number>();
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const n = countNeighbors(mask, width, height, i);
    degree.set(i, n);
  }

  const walk = (start: number, nextIndex: number, from: number) => {
    const points: Array<{ x: number; y: number }> = [];
    const startCoord = cellCenter(start % width, Math.floor(start / width));
    points.push(startCoord);
    let prev = start;
    let current = nextIndex;
    while (true) {
      const cx = current % width;
      const cy = Math.floor(current / width);
      points.push(cellCenter(cx, cy));
      const deg = degree.get(current) ?? 0;
      if (deg === 0) break;
      if (deg !== 2) break;
      const neigh = neighbors(width, height, current).filter((n) => mask[n] && n !== prev);
      if (neigh.length === 0) break;
      prev = current;
      current = neigh[0];
    }
    return { end: current, points };
  };

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const deg = degree.get(i) ?? 0;
    if (deg === 0) continue;
    if (deg === 2) continue;
    const nodeA = ensureNode(i, width, nodes, mergeDistance, counter);
    for (const neigh of neighbors(width, height, i)) {
      if (!mask[neigh]) continue;
      const key = i < neigh ? `${i}-${neigh}` : `${neigh}-${i}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const { end, points } = walk(i, neigh, i);
      const degEnd = degree.get(end) ?? 0;
      const nodeB = ensureNode(end, width, nodes, mergeDistance, counter);
      if (nodeA.id === nodeB.id) continue;
      if (points.length < 2) continue;
      const { length, curvature, cost } = computeEdgeProperties(points, costField);
      if (length < minBranch) continue;
      const straight = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y) || 1;
      if (length / straight > params.maxDetourFactor) continue;
      if (params.minCurvatureRadius > 0 && curvature > 0) {
        const radius = 1 / curvature;
        if (radius < params.minCurvatureRadius) continue;
      }
      const edge: RoadEdge = {
        id: `e${graph.edges.length}`,
        fromId: nodeA.id,
        toId: nodeB.id,
        length,
        curvature,
        cost,
        points
      };
      graph.edges.push(edge);
    }
  }

  graph.nodes = Array.from(new Set(nodes.values()));
  return graph;
}
