export type PhysarumParams = {
  agents: number;
  steps: number;
  deposit: number;
  diffusion: number;
  decay: number;
  step: number;
  turn: number;
  sensorAngle: number;
  sensorDist: number;
  gridRes: number;
  maskPadding: number;
};

export type PhysarumResult = {
  gridW: number;
  gridH: number;
  field: Float32Array;
  polylines: Array<Array<[number, number]>>;
  edges: Array<{ a: [number, number]; b: [number, number]; flux: number }>;
};

export type RoadEdge = {
  a: [number, number];
  b: [number, number];
  width: number;
  kind: "local" | "arterial" | "bridge";
};

export type CityParams = {
  width: number;
  height: number;
  sites: number;
  minSiteSpacing: number;
  falloff: number;
  openMask: number;
  mstHubs: number;
  poiMultiplier: number;
  usePhysarum: boolean;
  physarum?: PhysarumParams;
  useWFC: boolean;
  wfc?: { macroTileset: string; microTileset: string };
  maxBuildings: number;
};

export type WorldConstraints = {
  shoreline?: { y: number; depth: number };
  gates?: Array<{ edge: "N" | "S" | "E" | "W"; t: number; width: number }>;
  noBuildMasks?: Array<{ polygon: [number, number][] }>;
  heightField?: Float32Array;
};

export type CityDistrict = {
  kind: string;
  center: [number, number];
  radius: number;
};

export type CityBuilding = {
  pos: [number, number, number];
  size: [number, number, number];
  district: string;
};

export type CityPOI = {
  pos: [number, number];
  kind: string;
  label: string;
  district: string;
};

export type CityGate = {
  edge: "N" | "S" | "E" | "W";
  t: number;
  x: number;
  z: number;
  width: number;
};

export type CityRoad = {
  a: [number, number];
  b: [number, number];
  width: number;
  kind: "local" | "arterial" | "bridge";
};

export type CityData = {
  seed: number;
  districts: CityDistrict[];
  roads: CityRoad[];
  gates: CityGate[];
  buildings: CityBuilding[];
  pois: CityPOI[];
  debug?: Record<string, unknown>;
};

export function createDefaultCityParams(): CityParams {
  return {
    width: 512,
    height: 512,
    sites: 12,
    minSiteSpacing: 28,
    falloff: 1.1,
    openMask: 0.5,
    mstHubs: 6,
    poiMultiplier: 1,
    usePhysarum: false,
    physarum: {
      agents: 8000,
      steps: 8000,
      deposit: 1,
      diffusion: 0.18,
      decay: 0.01,
      step: 1,
      turn: 0.6,
      sensorAngle: 0.9,
      sensorDist: 1.6,
      gridRes: 1,
      maskPadding: 1
    },
    useWFC: false,
    wfc: { macroTileset: "default", microTileset: "default" },
    maxBuildings: 1200
  };
}
