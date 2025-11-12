export type ResourceType =
  | 'credits'
  | 'biomass'
  | 'oxygen'
  | 'water'
  | 'power'
  | 'research';

export type ResourceDelta = Partial<Record<ResourceType, number>>;

export interface ResourcePool {
  credits: number;
  biomass: number;
  oxygen: number;
  water: number;
  power: number;
  research: number;
}

export interface PopulationAssignments {
  [facilityId: string]: number;
}

export interface PopulationState {
  /** Total number of survivors currently alive. */
  survivors: number;
  /** Maximum number of survivors that can be supported by the colony. */
  capacity: number;
  /** Number of survivors not assigned to any facility. */
  unassigned: number;
  /** Average morale score from 0 to 100. */
  morale: number;
  /** Average health score from 0 to 100. */
  health: number;
  /** Mapping of facility instance id to assigned survivor count. */
  assignments: PopulationAssignments;
}

export interface EnvironmentMetrics {
  oxygen: number;
  temperature: number;
  pressure: number;
  waterLevel: number;
  hostility: number;
  biomass: number;
}

export interface EnvironmentTargets {
  oxygen: number;
  temperature: number;
  pressure: number;
  waterLevel: number;
  hostility: number;
  biomass: number;
}

export interface EnvironmentState {
  metrics: EnvironmentMetrics;
  targets: EnvironmentTargets;
}

export type FacilityStatus = 'under-construction' | 'operational' | 'disabled';

export interface FacilityTemplate {
  id: string;
  name: string;
  description: string;
  buildCost: ResourceDelta;
  buildTimeHours: number;
  crewRequired: number;
  /** Resource delta applied each hour when the facility is fully crewed. */
  hourlyEffects: ResourceDelta;
  /** Environmental delta applied each hour when the facility is fully crewed. */
  environmentEffects?: Partial<EnvironmentMetrics>;
  /** Additional survivor capacity granted by the facility when operational. */
  capacityBonus?: number;
}

export interface FacilityInstance {
  id: string;
  templateId: string;
  status: FacilityStatus;
  assignedSurvivors: number;
  remainingBuildHours: number;
  /** Modifier applied to hourly effects (0-1). */
  efficiency: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  launchCost: ResourceDelta;
  durationHours: number;
  /** Environmental adjustments applied once the project completes. */
  completionEnvironmentDelta?: Partial<EnvironmentMetrics>;
  /** Immediate resource reward applied once the project completes. */
  completionResourceDelta?: ResourceDelta;
  /** Optional per-hour resource upkeep. Failure to pay aborts the project. */
  upkeep?: ResourceDelta;
}

export type ProjectStatus = 'active' | 'completed' | 'failed';

export interface ProjectInstance {
  id: string;
  templateId: string;
  remainingHours: number;
  status: ProjectStatus;
  /** Hours of progress accumulated so far. */
  progressHours: number;
}

export interface GameTime {
  /** Current hour (0-23) within the ongoing day. */
  hour: number;
  /** Total number of days elapsed since landing. */
  day: number;
}

export interface GameState {
  time: GameTime;
  resources: ResourcePool;
  population: PopulationState;
  facilities: FacilityInstance[];
  projects: ProjectInstance[];
  environment: EnvironmentState;
  logs: string[];
}

export const RESOURCE_TYPES: readonly ResourceType[] = [
  'credits',
  'biomass',
  'oxygen',
  'water',
  'power',
  'research'
] as const;

export const INITIAL_RESOURCES: ResourcePool = {
  credits: 500,
  biomass: 50,
  oxygen: 100,
  water: 120,
  power: 40,
  research: 0
};

export const INITIAL_ENVIRONMENT: EnvironmentState = {
  metrics: {
    oxygen: 5,
    temperature: -40,
    pressure: 0.2,
    waterLevel: 10,
    hostility: 60,
    biomass: 5
  },
  targets: {
    oxygen: 21,
    temperature: 15,
    pressure: 1,
    waterLevel: 60,
    hostility: 10,
    biomass: 70
  }
};

export function createInitialGameState(): GameState {
  return {
    time: { hour: 0, day: 0 },
    resources: { ...INITIAL_RESOURCES },
    population: {
      survivors: 24,
      capacity: 30,
      unassigned: 24,
      morale: 65,
      health: 80,
      assignments: {}
    },
    facilities: [],
    projects: [],
    environment: {
      metrics: { ...INITIAL_ENVIRONMENT.metrics },
      targets: { ...INITIAL_ENVIRONMENT.targets }
    },
    logs: []
  };
}
