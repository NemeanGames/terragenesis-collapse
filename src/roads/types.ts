export interface GridField {
  width: number;
  height: number;
  data: Float32Array;
}

export interface CostField extends GridField {}

export interface PhysarumField extends GridField {}

export interface PhysarumParams {
  iterations: number;
  agentCount: number;
  depositRate: number;
  diffusionRate: number;
  evaporationRate: number;
  sensorAngle: number;
  sensorDistance: number;
  stepSize: number;
  costInfluence: number;
  threshold: number;
  minBranchLength: number;
  mergeDistance: number;
  maxDetourFactor: number;
  minCurvatureRadius: number;
}

export interface RoadNode {
  id: string;
  x: number;
  y: number;
}

export interface RoadEdge {
  id: string;
  fromId: string;
  toId: string;
  length: number;
  curvature: number;
  cost: number;
  points: Array<{ x: number; y: number }>;
}

export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadEdge[];
}

export interface PlannerSources {
  x: number;
  y: number;
  weight?: number;
}

export interface PhysarumRunResult {
  field: PhysarumField;
  iterations: number;
  converged: boolean;
}

export interface PhysarumPlan {
  field: PhysarumField;
  mask: Uint8Array;
  graph: RoadGraph;
  iterations: number;
  converged: boolean;
}
