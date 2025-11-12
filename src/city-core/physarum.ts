import { mulberry32, hashStr } from "./seed";
import type { PhysarumParams, PhysarumResult, RoadEdge } from "./types";

export type MaskFn = (x: number, z: number) => number;

type Agent = { x: number; z: number; a: number };

type Grid = {
  w: number;
  h: number;
  ox: number;
  oz: number;
  scale: number;
  trail: Float32Array;
};

const IDX = (x: number, y: number, w: number) => y * w + x;

function worldToGrid(g: Grid, x: number, z: number) {
  return {
    gx: Math.max(0, Math.min(g.w - 1, Math.round((x - g.ox) * g.scale))),
    gz: Math.max(0, Math.min(g.h - 1, Math.round((z - g.oz) * g.scale)))
  };
}

function gridToWorld(g: Grid, gx: number, gz: number) {
  return {
    x: g.ox + gx / g.scale,
    z: g.oz + gz / g.scale
  };
}

function makeGrid(width: number, height: number, gridRes: number): Grid {
  const scale = gridRes;
  const w = Math.max(8, Math.round(width * scale));
  const h = Math.max(8, Math.round(height * scale));
  return { w, h, ox: 0, oz: 0, scale, trail: new Float32Array(w * h) };
}

function diffuseAndDecay(g: Grid, diffusion: number, decay: number, tmp: Float32Array) {
  const { w, h, trail } = g;
  tmp.fill(0);
  const alpha = diffusion / 9;
  for (let y = 1; y < h - 1; y++) {
    const yy = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = yy + x;
      let sum = 0;
      sum += trail[i - w - 1];
      sum += trail[i - w];
      sum += trail[i - w + 1];
      sum += trail[i - 1];
      sum += trail[i];
      sum += trail[i + 1];
      sum += trail[i + w - 1];
      sum += trail[i + w];
      sum += trail[i + w + 1];
      tmp[i] = trail[i] * (1 - decay) + alpha * sum;
    }
  }
  trail.set(tmp);
}

function sampleTrail(g: Grid, x: number, z: number) {
  const fx = (x - g.ox) * g.scale;
  const fz = (z - g.oz) * g.scale;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(g.w - 1, x0 + 1);
  const z1 = Math.min(g.h - 1, z0 + 1);
  const tx = fx - x0;
  const tz = fz - z0;
  const i00 = IDX(x0, z0, g.w);
  const i10 = IDX(x1, z0, g.w);
  const i01 = IDX(x0, z1, g.w);
  const i11 = IDX(x1, z1, g.w);
  const a = g.trail[i00] * (1 - tx) + g.trail[i10] * tx;
  const b = g.trail[i01] * (1 - tx) + g.trail[i11] * tx;
  return a * (1 - tz) + b * tz;
}

function deposit(g: Grid, x: number, z: number, amount: number) {
  const fx = (x - g.ox) * g.scale;
  const fz = (z - g.oz) * g.scale;
  const gx = Math.max(0, Math.min(g.w - 1, Math.round(fx)));
  const gz = Math.max(0, Math.min(g.h - 1, Math.round(fz)));
  g.trail[IDX(gx, gz, g.w)] += amount;
}

function seedAgents(
  n: number,
  width: number,
  height: number,
  mask: MaskFn,
  rng: () => number,
  attractors: Array<[number, number]>
) {
  const out: Agent[] = [];
  const near = Math.min(n, Math.floor(n * 0.5));
  for (let i = 0; i < near; i++) {
    const at = attractors[i % attractors.length] ?? [width * 0.5, height * 0.5];
    let x = at[0] + (rng() - 0.5) * 6;
    let z = at[1] + (rng() - 0.5) * 6;
    let safe = 0;
    while (mask(x, z) < 0.5 && safe++ < 50) {
      x = at[0] + (rng() - 0.5) * 10;
      z = at[1] + (rng() - 0.5) * 10;
    }
    out.push({ x, z, a: rng() * Math.PI * 2 });
  }
  while (out.length < n) {
    let x = rng() * width;
    let z = rng() * height;
    let tries = 0;
    while (mask(x, z) < 0.5 && tries++ < 100) {
      x = rng() * width;
      z = rng() * height;
    }
    out.push({ x, z, a: rng() * Math.PI * 2 });
  }
  return out;
}

function steer(agent: Agent, g: Grid, params: PhysarumParams, rng: () => number, mask: MaskFn) {
  const { sensorAngle, sensorDist, step, turn } = params;
  const { x, z, a } = agent;
  const d = sensorDist;

  const aL = a - sensorAngle;
  const aF = a;
  const aR = a + sensorAngle;
  const pL: [number, number] = [x + Math.cos(aL) * d, z + Math.sin(aL) * d];
  const pF: [number, number] = [x + Math.cos(aF) * d, z + Math.sin(aF) * d];
  const pR: [number, number] = [x + Math.cos(aR) * d, z + Math.sin(aR) * d];

  const sL = sampleTrail(g, pL[0], pL[1]);
  const sF = sampleTrail(g, pF[0], pF[1]);
  const sR = sampleTrail(g, pR[0], pR[1]);

  let newA = a;
  if (sF >= sL && sF >= sR) {
    // go straight
  } else if (sL > sR) newA -= turn;
  else if (sR > sL) newA += turn;
  else newA += (rng() - 0.5) * turn;

  let nx = x + Math.cos(newA) * step;
  let nz = z + Math.sin(newA) * step;

  if (mask(nx, nz) < 0.5) {
    newA += (rng() - 0.5) * 1.8;
    nx = x + Math.cos(newA) * step;
    nz = z + Math.sin(newA) * step;
  }
  agent.x = nx;
  agent.z = nz;
  agent.a = newA;
}

function rasterToPolylines(g: Grid, threshold: number) {
  const { w, h, trail } = g;
  const lines: Array<Array<[number, number]>> = [];
  const visited = new Uint8Array(w * h);
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1]
  ] as const;

  const isHigh = (i: number) => trail[i] >= threshold;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = IDX(x, y, w);
      if (!isHigh(i) || visited[i]) continue;
      const stroke: Array<[number, number]> = [];
      let cx = x;
      let cy = y;
      let guard = 0;
      while (guard++ < 4000) {
        visited[IDX(cx, cy, w)] = 1;
        const { x: wx, z: wz } = gridToWorld(g, cx, cy);
        stroke.push([wx, wz]);
        let best = -1;
        let bx = cx;
        let by = cy;
        for (const [dx, dz] of dirs) {
          const nx = cx + dx;
          const ny = cy + dz;
          const ni = IDX(nx, ny, w);
          if (trail[ni] > best && trail[ni] >= threshold && !visited[ni]) {
            best = trail[ni];
            bx = nx;
            by = ny;
          }
        }
        if (bx === cx && by === cy) break;
        cx = bx;
        cy = by;
      }
      if (stroke.length >= 3) lines.push(stroke);
    }
  }
  return lines;
}

function simplifyRDP(path: Array<[number, number]>, eps: number) {
  const d2 = (a: [number, number], b: [number, number]) => {
    const dx = a[0] - b[0];
    const dz = a[1] - b[1];
    return dx * dx + dz * dz;
  };
  const segDist = (p: [number, number], a: [number, number], b: [number, number]) => {
    const denom = d2(a, b) || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / denom));
    const px = a[0] + t * (b[0] - a[0]);
    const pz = a[1] + t * (b[1] - a[1]);
    return Math.hypot(p[0] - px, p[1] - pz);
  };
  const keep = new Uint8Array(path.length);
  keep[0] = 1;
  keep[path.length - 1] = 1;
  function recurse(start: number, end: number) {
    let maxDistance = -1;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const dist = segDist(path[i], path[start], path[end]);
      if (dist > maxDistance) {
        maxDistance = dist;
        index = i;
      }
    }
    if (maxDistance > eps && index > -1) {
      keep[index] = 1;
      recurse(start, index);
      recurse(index, end);
    }
  }
  recurse(0, path.length - 1);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < path.length; i++) {
    if (keep[i]) out.push(path[i]);
  }
  return out;
}

export function mergePhysarumWithMST(
  phys: PhysarumResult,
  mst: Array<{ a: [number, number]; b: [number, number] }>,
  gates: Array<[number, number]>,
  minLen = 4,
  snapDist = 2.5
): RoadEdge[] {
  const edges: RoadEdge[] = [];
  for (const e of mst) edges.push({ a: e.a, b: e.b, width: 7, kind: "arterial" });

  for (const line of phys.polylines) {
    if (line.length < 2) continue;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < minLen) continue;
      edges.push({ a, b, width: 5, kind: "local" });
    }
  }

  const nodes: Array<[number, number]> = [];
  for (const edge of edges) {
    nodes.push(edge.a, edge.b);
  }
  nodes.push(...gates);

  const snap = (p: [number, number]) => {
    let best = Infinity;
    let bx = p[0];
    let bz = p[1];
    for (const n of nodes) {
      const d = Math.hypot(p[0] - n[0], p[1] - n[1]);
      if (d < best) {
        best = d;
        bx = n[0];
        bz = n[1];
      }
    }
    return best <= snapDist ? ([bx, bz] as [number, number]) : p;
  };

  for (const edge of edges) {
    edge.a = snap(edge.a);
    edge.b = snap(edge.b);
  }

  return edges;
}

export function runPhysarumRoads(
  seed: number,
  width: number,
  height: number,
  params: PhysarumParams,
  mask: MaskFn,
  attractors: Array<[number, number]>
): PhysarumResult {
  const rng = mulberry32(seed ^ hashStr("physarum"));
  const grid = makeGrid(width, height, params.gridRes);
  const tmp = new Float32Array(grid.trail.length);
  const agents = seedAgents(params.agents, width, height, mask, rng, attractors);

  for (let s = 0; s < params.steps; s++) {
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      steer(agent, grid, params, rng, mask);
      deposit(grid, agent.x, agent.z, params.deposit);
    }
    diffuseAndDecay(grid, params.diffusion, params.decay, tmp);
  }

  const trail = grid.trail;
  let mean = 0;
  for (let i = 0; i < trail.length; i++) mean += trail[i];
  mean /= Math.max(1, trail.length);
  const polylines = rasterToPolylines(grid, mean * 1.2).map((p) => simplifyRDP(p, 1));

  const edges: PhysarumResult["edges"] = [];
  for (const line of polylines) {
    for (let i = 1; i < line.length; i++) {
      edges.push({ a: line[i - 1], b: line[i], flux: 1 });
    }
  }

  return { gridW: grid.w, gridH: grid.h, field: grid.trail, polylines, edges };
}
