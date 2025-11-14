export type ResourceKey = "credits" | "biofuel" | "research" | "oxygenReserve" | "supplies";

export type ResourceMap = Record<ResourceKey, number>;

export interface EnvironmentState {
  pressure: number;
  temperature: number;
  oxygen: number;
  water: number;
}

export interface EnvironmentTargets {
  pressure: number;
  temperature: number;
  oxygen: number;
  water: number;
}

export type SurvivorRole = "idle" | "scavenge" | "defend" | "research" | "terraform";

export interface Survivor {
  id: string;
  name: string;
  role: SurvivorRole;
  skill: number;
}

export interface FacilityState {
  id: string;
  count: number;
}

export interface Project {
  id: string;
  name: string;
  remainingHours: number;
  totalHours: number;
  reward: {
    resources?: Partial<ResourceMap>;
    hostilityDelta?: number;
    moraleDelta?: number;
    environment?: Partial<EnvironmentState>;
  };
}

export interface GameEvent {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  severity: "info" | "warning" | "danger";
}

export interface GameSnapshot {
  resources: ResourceMap;
  environment: EnvironmentState;
  survivors: Survivor[];
  facilities: FacilityState[];
  hostility: number;
  morale: number;
  activeProjects: Project[];
  tickLengthMinutes: number;
}

export type Axial = { q: number; r: number };

export type MapView = "terra" | "urban" | "zombie" | "cell";

export type RegionCategory = "wilderness" | "rural" | "urbanCore" | "urbanDistrict";

export type RegionGate = { edge: "N" | "S" | "E" | "W"; t: number; width: number };

export type RegionPoiStatus = "idle" | "assigned" | "completed";

export interface RegionPoi {
  id: string;
  name: string;
  type: string;
  difficulty: number;
  status: RegionPoiStatus;
  description?: string;
}

export interface TerrainTileMeta {
  height: number;
  slope: number;
  moisture: number;
  biomeId: number;
  waterMask: number;
  coastFlag: boolean;
  densityBand?: number;
  roadAnchors?: Array<[number, number]>;
}

export interface RegionDetail {
  axial: Axial;
  category: RegionCategory;
  seed: number;
  worldPosition: [number, number];
  label: string;
  metrics: {
    elevation: number;
    slope: number;
    distanceToSettlement: number;
    moisture: number;
    coastal: boolean;
  };
  gates: RegionGate[];
  pois: RegionPoi[];
  tileMeta?: TerrainTileMeta;
}

export interface CellOpenArgs {
  q: number;
  r: number;
  seed: number;
  tile: TerrainTileMeta;
  regionId?: string;
}

export interface CellSnapshot {
  id: string;
  q: number;
  r: number;
  seed: number;
  buildablePct: number;
  overlays: {
    roads: boolean;
    lots: boolean;
    poi: boolean;
    heat: boolean;
  };
}

export interface CellRuntime {
  lots: Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    zone: "res" | "mix" | "com";
    poi?: string;
  }>;
  roads: Array<{
    id: string;
    path: [number, number][];
    degree: number;
  }>;
  anchors: Array<[number, number]>;
  stats: { buildablePct: number };
}
