import type { CostField, PhysarumParams, PhysarumRunResult, PlannerSources } from "./types";

const TAU = Math.PI * 2;

interface Agent {
  x: number;
  y: number;
  heading: number;
}

interface PhysarumOptions {
  rng?: () => number;
  maxIterations?: number;
  minDelta?: number;
}

const DEFAULT_OPTIONS: Required<PhysarumOptions> = {
  rng: Math.random,
  maxIterations: 2000,
  minDelta: 1e-4
};

const IDX = (x: number, y: number, width: number) => y * width + x;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function bilinear(field: Float32Array, width: number, height: number, x: number, y: number) {
  const fx = clamp(x, 0, width - 1);
  const fy = clamp(y, 0, height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const i00 = IDX(x0, y0, width);
  const i10 = IDX(x1, y0, width);
  const i01 = IDX(x0, y1, width);
  const i11 = IDX(x1, y1, width);
  const a = lerp(field[i00], field[i10], tx);
  const b = lerp(field[i01], field[i11], tx);
  return lerp(a, b, ty);
}

function seedAgents(
  count: number,
  width: number,
  height: number,
  sources: PlannerSources[],
  rng: () => number
) {
  const agents: Agent[] = [];
  const weightedSources = sources.length
    ? sources
    : [{ x: width * 0.5, y: height * 0.5, weight: 1 }];
  const totalWeight = weightedSources.reduce((acc, src) => acc + (src.weight ?? 1), 0);

  for (let i = 0; i < count; i++) {
    const pick = rng() * totalWeight;
    let accum = 0;
    let src = weightedSources[0];
    for (const candidate of weightedSources) {
      accum += candidate.weight ?? 1;
      if (pick <= accum) {
        src = candidate;
        break;
      }
    }
    const jitter = () => (rng() - 0.5) * Math.min(width, height) * 0.02;
    const x = clamp(src.x + jitter(), 0, width - 1);
    const y = clamp(src.y + jitter(), 0, height - 1);
    agents.push({ x, y, heading: rng() * TAU });
  }

  return agents;
}

function sense(
  field: Float32Array,
  cost: Float32Array,
  width: number,
  height: number,
  agent: Agent,
  params: PhysarumParams
) {
  const { sensorAngle, sensorDistance, costInfluence } = params;
  const { x, y, heading } = agent;

  const offsets = [
    heading,
    heading - sensorAngle,
    heading + sensorAngle
  ];

  const samples = offsets.map((angle) => {
    const sx = x + Math.cos(angle) * sensorDistance;
    const sy = y + Math.sin(angle) * sensorDistance;
    const conductance = bilinear(field, width, height, sx, sy);
    const terrainCost = bilinear(cost, width, height, sx, sy);
    return conductance - terrainCost * costInfluence;
  });

  return samples;
}

function stepAgent(
  field: Float32Array,
  cost: Float32Array,
  width: number,
  height: number,
  agent: Agent,
  params: PhysarumParams,
  rng: () => number
) {
  const [forward, left, right] = sense(field, cost, width, height, agent, params);
  let heading = agent.heading;

  if (forward >= left && forward >= right) {
    // stay on course
  } else if (left > right) heading -= params.sensorAngle * 0.5;
  else if (right > left) heading += params.sensorAngle * 0.5;
  else heading += (rng() - 0.5) * params.sensorAngle;

  const nx = clamp(agent.x + Math.cos(heading) * params.stepSize, 0, width - 1);
  const ny = clamp(agent.y + Math.sin(heading) * params.stepSize, 0, height - 1);

  agent.x = nx;
  agent.y = ny;
  agent.heading = heading;

  const terrainCost = bilinear(cost, width, height, nx, ny);
  const deposition = params.depositRate / (1 + terrainCost);
  const idx = IDX(Math.round(nx), Math.round(ny), width);
  field[idx] += deposition;
  return deposition;
}

function diffuse(field: Float32Array, width: number, height: number, params: PhysarumParams) {
  const next = new Float32Array(field.length);
  const { diffusionRate, evaporationRate } = params;
  const alpha = diffusionRate / 9;
  let maxDelta = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = IDX(x, y, width);
      const current = field[idx];
      let sum = 0;
      sum += field[idx - width - 1];
      sum += field[idx - width];
      sum += field[idx - width + 1];
      sum += field[idx - 1];
      sum += field[idx];
      sum += field[idx + 1];
      sum += field[idx + width - 1];
      sum += field[idx + width];
      sum += field[idx + width + 1];
      const nextValue = current * (1 - evaporationRate) + alpha * sum;
      next[idx] = nextValue;
      maxDelta = Math.max(maxDelta, Math.abs(nextValue - current));
    }
  }
  // copy boundaries unchanged
  for (let x = 0; x < width; x++) {
    next[IDX(x, 0, width)] = field[IDX(x, 0, width)];
    next[IDX(x, height - 1, width)] = field[IDX(x, height - 1, width)];
  }
  for (let y = 0; y < height; y++) {
    next[IDX(0, y, width)] = field[IDX(0, y, width)];
    next[IDX(width - 1, y, width)] = field[IDX(width - 1, y, width)];
  }
  field.set(next);
  return maxDelta;
}

function injectSources(field: Float32Array, width: number, sources: PlannerSources[]) {
  const amount = sources.length ? 0.05 : 0;
  for (const src of sources) {
    const x = clamp(Math.round(src.x), 0, width - 1);
    const y = clamp(Math.round(src.y), 0, width - 1);
    field[IDX(x, y, width)] += amount * (src.weight ?? 1);
  }
}

export function runPhysarum(
  costField: CostField,
  sources: PlannerSources[],
  params: PhysarumParams,
  options?: PhysarumOptions
): PhysarumRunResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const width = costField.width;
  const height = costField.height;
  const field = new Float32Array(width * height);
  const rng = opts.rng ?? Math.random;
  const agents = seedAgents(params.agentCount, width, height, sources, rng);
  let iteration = 0;
  let converged = false;
  let lastDelta = Infinity;

  while (iteration < params.iterations && iteration < opts.maxIterations) {
    iteration++;
    let totalDeposit = 0;
    for (const agent of agents) {
      totalDeposit += stepAgent(field, costField.data, width, height, agent, params, rng);
    }
    injectSources(field, width, sources);
    const delta = diffuse(field, width, height, params);
    lastDelta = delta;
    if (delta < opts.minDelta && totalDeposit < params.agentCount * params.depositRate * 0.05) {
      converged = true;
      break;
    }
  }

  return {
    field: { width, height, data: field },
    iterations: iteration,
    converged
  } satisfies PhysarumRunResult;
}
