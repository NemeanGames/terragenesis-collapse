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
