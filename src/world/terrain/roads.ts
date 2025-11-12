import * as THREE from "three";
import { createRoadGeometry } from "../../render/assets/geometries";
import { createRoadMaterial } from "../../render/assets/materials";
import { SIZE, sampleHeight } from "./heightmap";
import type { SeedPoint } from "./seeds";

export type RoadEdge = [number, number];

export function buildKnnEdges(points: SeedPoint[], k: number) {
  const edges = new Map<string, RoadEdge>();
  for (let i = 0; i < points.length; i++) {
    const distances = points
      .map((point, index) => (index === i ? null : { index, dist: (point.x - points[i].x) ** 2 + (point.y - points[i].y) ** 2 }))
      .filter(Boolean) as { index: number; dist: number }[];
    distances.sort((a, b) => a.dist - b.dist);
    for (const { index } of distances.slice(0, k)) {
      const a = Math.min(i, index);
      const b = Math.max(i, index);
      edges.set(`${a}-${b}`, [a, b]);
    }
  }
  return Array.from(edges.values());
}

export function mstKruskal(points: SeedPoint[], edges: RoadEdge[], weight: (edge: RoadEdge) => number) {
  const parent = points.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const unite = (a: number, b: number) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[a] = b;
  };
  const sorted = [...edges].sort((e1, e2) => weight(e1) - weight(e2));
  const taken: RoadEdge[] = [];
  for (const edge of sorted) {
    const [a, b] = edge;
    if (find(a) !== find(b)) {
      taken.push(edge);
      unite(a, b);
    }
  }
  return taken;
}

export function buildRoadStrip(points: { x: number; y: number; z: number }[], width = 0.9) {
  const count = points.length;
  if (count < 2) return createRoadGeometry();
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    const point = points[i];
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(count - 1, i + 1)];
    const tx = next.x - previous.x;
    const tz = next.z - previous.z;
    const length = Math.hypot(tx, tz) || 1;
    const nx = -tz / length;
    const nz = tx / length;
    positions.push(point.x + nx * width * 0.5, point.y, point.z + nz * width * 0.5);
    positions.push(point.x - nx * width * 0.5, point.y, point.z - nz * width * 0.5);
    if (i < count - 1) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = i * 2 + 2;
      const d = i * 2 + 3;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = createRoadGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildRoadsGroup(
  seeds: SeedPoint[],
  edges: RoadEdge[],
  height: Float32Array[],
  scaleY: number,
  width = 0.9,
  color = 0xd2c099
) {
  const group = new THREE.Group();
  for (const [a, b] of edges) {
    const ax = seeds[a].x;
    const ay = seeds[a].y;
    const bx = seeds[b].x;
    const by = seeds[b].y;
    const steps = 16;
    const points: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const wx = x - SIZE / 2;
      const wy = sampleHeight(height, x, y) * scaleY + 0.02;
      const wz = y - SIZE / 2;
      points.push({ x: wx, y: wy, z: wz });
    }
    const stripGeometry = buildRoadStrip(points, width);
    const material = createRoadMaterial(color);
    const mesh = new THREE.Mesh(stripGeometry, material);
    group.add(mesh);
  }
  return group;
}
