import {
  GameState,
  RESOURCE_TYPES,
  ResourceDelta,
  FacilityInstance,
  FacilityTemplate,
  ProjectInstance,
  ProjectTemplate,
  EnvironmentMetrics
} from '../state/gameState';
import { FACILITY_TEMPLATES } from '../content/facilities';
import { PROJECT_TEMPLATES } from '../content/projects';

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

export interface TickOptions {
  hours?: number;
}

export interface TickResult {
  completedFacilities: string[];
  completedProjects: string[];
  failedProjects: string[];
  resourceShortages: ResourceDelta;
}

const SURVIVOR_HOURLY_CONSUMPTION: ResourceDelta = {
  oxygen: -0.25,
  water: -0.2,
  biomass: -0.1
};

const SHORTAGE_MORTALITY: Record<string, number> = {
  oxygen: 2,
  water: 1,
  biomass: 0
};

function ensureResourceDelta(delta: ResourceDelta): Required<ResourceDelta> {
  const output: Mutable<Required<ResourceDelta>> = {
    credits: 0,
    biomass: 0,
    oxygen: 0,
    water: 0,
    power: 0,
    research: 0
  };

  for (const type of Object.keys(delta) as (keyof ResourceDelta)[]) {
    if (typeof delta[type] === 'number') {
      output[type] = delta[type] ?? 0;
    }
  }

  return output;
}

function addResourceDelta(target: ResourceDelta, source: ResourceDelta): void {
  for (const key of Object.keys(source) as (keyof ResourceDelta)[]) {
    target[key] = (target[key] ?? 0) + (source[key] ?? 0);
  }
}

function scaleResourceDelta(delta: ResourceDelta, scale: number): ResourceDelta {
  const result: ResourceDelta = {};
  for (const key of Object.keys(delta) as (keyof ResourceDelta)[]) {
    result[key] = (delta[key] ?? 0) * scale;
  }
  return result;
}

function applyResourceDelta(state: GameState, delta: ResourceDelta, shortages: ResourceDelta): void {
  for (const resourceType of RESOURCE_TYPES) {
    const change = delta[resourceType] ?? 0;
    const nextValue = state.resources[resourceType] + change;
    if (nextValue < 0) {
      shortages[resourceType] = (shortages[resourceType] ?? 0) + nextValue;
      state.resources[resourceType] = 0;
    } else {
      state.resources[resourceType] = nextValue;
    }
  }
}

function updateFacility(
  instance: FacilityInstance,
  template: FacilityTemplate,
  state: GameState,
  delta: ResourceDelta,
  envDelta: Partial<EnvironmentMetrics>
): boolean {
  if (instance.status === 'under-construction') {
    instance.remainingBuildHours -= 1;
    if (instance.remainingBuildHours <= 0) {
      instance.status = 'operational';
      instance.remainingBuildHours = 0;
      if (template.capacityBonus) {
        state.population.capacity += template.capacityBonus;
      }
      state.logs.push(`${template.name} completed construction.`);
      return true;
    }
    return false;
  }

  if (instance.status !== 'operational') {
    return false;
  }

  const requiredCrew = Math.max(template.crewRequired, 0);
  const crewed = requiredCrew === 0 ? 1 : Math.min(instance.assignedSurvivors, requiredCrew) / requiredCrew;
  const efficiency = instance.efficiency * crewed;

  if (Object.keys(template.hourlyEffects).length > 0) {
    addResourceDelta(delta, scaleResourceDelta(template.hourlyEffects, efficiency));
  }

  if (template.environmentEffects) {
    for (const key of Object.keys(template.environmentEffects) as (keyof EnvironmentMetrics)[]) {
      const change = (template.environmentEffects[key] ?? 0) * efficiency;
      envDelta[key] = (envDelta[key] ?? 0) + change;
    }
  }

  return false;
}

function updateProject(
  project: ProjectInstance,
  template: ProjectTemplate,
  shortages: ResourceDelta,
  state: GameState
): 'completed' | 'failed' | 'active' {
  if (project.status !== 'active') {
    return project.status;
  }

  const upkeep = template.upkeep ? ensureResourceDelta(template.upkeep) : undefined;
  if (upkeep) {
    for (const resource of Object.keys(upkeep) as (keyof ResourceDelta)[]) {
      const shortage = shortages[resource] ?? 0;
      if (shortage < 0) {
        project.status = 'failed';
        state.logs.push(`${template.name} failed due to lack of ${resource}.`);
        return 'failed';
      }
    }
  }

  project.remainingHours -= 1;
  project.progressHours += 1;
  if (project.remainingHours <= 0) {
    project.status = 'completed';
    if (template.completionEnvironmentDelta) {
      for (const key of Object.keys(template.completionEnvironmentDelta) as (keyof typeof state.environment.metrics)[]) {
        const delta = template.completionEnvironmentDelta[key] ?? 0;
        state.environment.metrics[key] += delta;
      }
    }
    if (template.completionResourceDelta) {
      for (const resource of Object.keys(template.completionResourceDelta) as (keyof ResourceDelta)[]) {
        const change = template.completionResourceDelta[resource] ?? 0;
        state.resources[resource] += change;
      }
    }
    state.logs.push(`${template.name} completed successfully.`);
    return 'completed';
  }
  return 'active';
}

function applyEnvironmentDelta(state: GameState, envDelta: Partial<EnvironmentMetrics>): void {
  for (const key of Object.keys(envDelta) as (keyof EnvironmentMetrics)[]) {
    const value = envDelta[key];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      state.environment.metrics[key] += value;
    }
  }
}

function advanceTime(state: GameState): void {
  state.time.hour += 1;
  if (state.time.hour >= 24) {
    state.time.hour = 0;
    state.time.day += 1;
  }
}

function applyShortageConsequences(state: GameState, shortages: ResourceDelta): void {
  for (const resourceType of Object.keys(shortages) as (keyof ResourceDelta)[]) {
    const shortageValue = shortages[resourceType];
    if ((shortageValue ?? 0) >= 0) continue;

    const affected = SHORTAGE_MORTALITY[resourceType as string];
    if (affected && state.population.survivors > 0) {
      const deaths = Math.min(state.population.survivors, affected);
      state.population.survivors -= deaths;
      state.population.unassigned = Math.max(0, state.population.unassigned - deaths);
      state.logs.push(`${deaths} survivor(s) lost due to ${resourceType} shortage.`);
    }

    if (resourceType === 'power') {
      state.logs.push('Power shortage reduced facility efficiency.');
      for (const facility of state.facilities) {
        facility.efficiency = Math.max(0.25, facility.efficiency * 0.9);
      }
    }
  }
}

function consumeByPopulation(state: GameState): ResourceDelta {
  const consumption: ResourceDelta = {};
  for (const [resourceType, value] of Object.entries(SURVIVOR_HOURLY_CONSUMPTION)) {
    consumption[resourceType as keyof ResourceDelta] = value * state.population.survivors;
  }
  return consumption;
}

export function processTick(state: GameState, options: TickOptions = {}): TickResult {
  const hours = Math.max(1, Math.floor(options.hours ?? 1));
  const completedFacilities: string[] = [];
  const completedProjects: string[] = [];
  const failedProjects: string[] = [];
  const resourceShortages: ResourceDelta = {};

  for (let i = 0; i < hours; i += 1) {
    advanceTime(state);

    const resourceDelta: ResourceDelta = {};
    addResourceDelta(resourceDelta, consumeByPopulation(state));

    const envDelta: Partial<EnvironmentMetrics> = {};

    for (const facility of state.facilities) {
      const template = FACILITY_TEMPLATES[facility.templateId];
      if (!template) {
        continue;
      }
      const completed = updateFacility(facility, template, state, resourceDelta, envDelta);
      if (completed) {
        completedFacilities.push(facility.id);
      }
    }

    // Apply project upkeep before resources are committed.
    for (const project of state.projects) {
      if (project.status !== 'active') continue;
      const template = PROJECT_TEMPLATES[project.templateId];
      if (!template || !template.upkeep) continue;
      addResourceDelta(resourceDelta, template.upkeep);
    }

    applyResourceDelta(state, resourceDelta, resourceShortages);
    applyEnvironmentDelta(state, envDelta);
    applyShortageConsequences(state, resourceShortages);

    for (const project of state.projects) {
      const template = PROJECT_TEMPLATES[project.templateId];
      if (!template) continue;
      const status = updateProject(project, template, resourceShortages, state);
      if (status === 'completed') {
        completedProjects.push(project.id);
      } else if (status === 'failed') {
        failedProjects.push(project.id);
      }
    }
  }

  return { completedFacilities, completedProjects, failedProjects, resourceShortages };
}
