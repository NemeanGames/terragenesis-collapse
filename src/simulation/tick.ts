import { FACILITIES } from "../features/facilities/data";
import { evaluateRandomEvent } from "../features/events/data";
import type {
  EnvironmentState,
  GameEvent,
  GameSnapshot,
  Project,
  ResourceKey,
  ResourceMap,
  SurvivorRole
} from "../state/types";

const BASE_SECONDS = 1.5;

export interface ProjectProgress {
  id: string;
  remainingHours: number;
  completed: boolean;
  reward?: Project["reward"];
}

export interface TickComputation {
  resourceDelta: Partial<ResourceMap>;
  environmentDelta: Partial<EnvironmentState>;
  hostilityDelta: number;
  moraleDelta: number;
  projects: ProjectProgress[];
  events: GameEvent[];
}

type SurvivorEffect = {
  resources?: Partial<ResourceMap>;
  environment?: Partial<EnvironmentState>;
  hostility?: number;
  morale?: number;
};

const survivorRoleEffects: Record<SurvivorRole, SurvivorEffect> = {
  scavenge: {
    resources: { credits: 4, supplies: 3, biofuel: 1.2 }
  },
  defend: {
    hostility: -0.9,
    morale: 0.4
  },
  research: {
    resources: { research: 4 }
  },
  terraform: {
    environment: { pressure: 0.006, oxygen: 0.006, water: 0.005, temperature: 0.005 }
  },
  idle: {
    morale: 0.2
  }
};

function mergeResourceDelta(target: Partial<ResourceMap>, delta: Partial<ResourceMap>) {
  (Object.keys(delta) as ResourceKey[]).forEach((key) => {
    target[key] = (target[key] ?? 0) + (delta[key] ?? 0);
  });
}

export function advanceTick(
  snapshot: GameSnapshot,
  tickLengthMinutes: number,
  elapsedSeconds: number
): TickComputation {
  const minuteFactor = tickLengthMinutes * (elapsedSeconds / BASE_SECONDS);
  const hourFactor = minuteFactor / 60;

  const resourceDelta: Partial<ResourceMap> = {};
  const environmentDelta: Partial<EnvironmentState> = {};
  let hostilityDelta = 0;
  let moraleDelta = -0.6 * hourFactor * snapshot.survivors.length; // upkeep mood drain

  // Facility outputs and upkeep
  snapshot.facilities.forEach((facilityState) => {
    const def = FACILITIES.find((f) => f.id === facilityState.id);
    if (!def) return;
    const scale = facilityState.count * hourFactor;
    mergeResourceDelta(resourceDelta, multiplyResources(def.outputs, scale));
    mergeResourceDelta(resourceDelta, multiplyResources(negateResources(def.upkeep), scale));
    if (def.moraleBonus) {
      moraleDelta += def.moraleBonus * scale;
    }
    if (def.hostilityModifier) {
      hostilityDelta += def.hostilityModifier * scale;
    }
  });

  // Survivors contributions
  snapshot.survivors.forEach((survivor) => {
    const effect = survivorRoleEffects[survivor.role];
    if (!effect) return;
    const skillScale = survivor.skill * hourFactor;
    if (effect.resources) {
      mergeResourceDelta(resourceDelta, multiplyResources(effect.resources, skillScale));
    }
    if (effect.environment) {
      Object.entries(effect.environment).forEach(([key, value]) => {
        const numericValue = Number(value);
        environmentDelta[key as keyof EnvironmentState] =
          (environmentDelta[key as keyof EnvironmentState] ?? 0) + numericValue * skillScale;
      });
    }
    if (effect.hostility) {
      hostilityDelta += effect.hostility * skillScale;
    }
    if (effect.morale) {
      moraleDelta += effect.morale * skillScale;
    }
  });

  // Baseline drains
  mergeResourceDelta(
    resourceDelta,
    multiplyResources({ supplies: -2.5 } as Partial<ResourceMap>, minuteFactor / 30)
  );
  mergeResourceDelta(
    resourceDelta,
    multiplyResources({ oxygenReserve: -3.2 } as Partial<ResourceMap>, hourFactor)
  );
  hostilityDelta += 2.4 * hourFactor; // ambient pressure of the horde

  const events: GameEvent[] = [];

  // Project progress
  const projects: ProjectProgress[] = snapshot.activeProjects.map((project) => {
    const progressHours = minuteFactor / 60;
    const remaining = Math.max(0, project.remainingHours - progressHours);
    const completed = remaining <= 0.001;
    if (completed) {
      events.push({
        id: `project-${project.id}-${Date.now()}`,
        title: `${project.name} Complete`,
        body: `${project.name} wrapped up and delivered its benefits.`,
        severity: "info",
        timestamp: Date.now()
      });
    }
    return {
      id: project.id,
      remainingHours: remaining,
      completed,
      reward: completed ? project.reward : undefined
    };
  });

  // Apply project rewards to deltas
  projects
    .filter((p) => p.completed && p.reward)
    .forEach((p) => {
      if (!p.reward) return;
      if (p.reward.resources) {
        mergeResourceDelta(resourceDelta, p.reward.resources);
      }
      if (p.reward.environment) {
        Object.entries(p.reward.environment).forEach(([key, value]) => {
          const numericValue = Number(value);
          environmentDelta[key as keyof EnvironmentState] =
            (environmentDelta[key as keyof EnvironmentState] ?? 0) + numericValue;
        });
      }
      if (p.reward.hostilityDelta) {
        hostilityDelta += p.reward.hostilityDelta;
      }
      if (p.reward.moraleDelta) {
        moraleDelta += p.reward.moraleDelta;
      }
    });

  const evaluated = evaluateRandomEvent(snapshot);
  if (evaluated) {
    events.push(evaluated.event);
    if (evaluated.effect.resources) {
      mergeResourceDelta(resourceDelta, evaluated.effect.resources);
    }
    if (evaluated.effect.environment) {
      Object.entries(evaluated.effect.environment).forEach(([key, value]) => {
        const numericValue = Number(value);
        environmentDelta[key as keyof EnvironmentState] =
          (environmentDelta[key as keyof EnvironmentState] ?? 0) + numericValue;
      });
    }
    if (evaluated.effect.hostilityDelta) {
      hostilityDelta += evaluated.effect.hostilityDelta;
    }
    if (evaluated.effect.moraleDelta) {
      moraleDelta += evaluated.effect.moraleDelta;
    }
  }

  return {
    resourceDelta,
    environmentDelta,
    hostilityDelta,
    moraleDelta,
    projects,
    events
  };
}

function multiplyResources(
  input: Partial<ResourceMap>,
  scalar: number
): Partial<ResourceMap> {
  const result: Partial<ResourceMap> = {};
  (Object.keys(input) as ResourceKey[]).forEach((key) => {
    result[key] = (input[key] ?? 0) * scalar;
  });
  return result;
}

function negateResources(input: Partial<ResourceMap>): Partial<ResourceMap> {
  const result: Partial<ResourceMap> = {};
  (Object.keys(input) as ResourceKey[]).forEach((key) => {
    result[key] = -(input[key] ?? 0);
  });
  return result;
}
