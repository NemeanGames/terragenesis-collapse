import {
  AssignmentOptions,
  AssignmentSummary,
  Survivor,
  SurvivorSpecialty,
  SurvivorTaskType,
  TaskAssignment,
  TaskOutcome,
} from "./types";

interface TaskDefinition {
  baseRisk: number; // 0-1 scale representing chance of negative consequence
  baseReward: number; // baseline loot multiplier
  primarySpecialty?: SurvivorSpecialty;
  secondarySpecialty?: SurvivorSpecialty;
  narrative: {
    success: string[];
    failure: string[];
  };
  rewardKeys: string[];
  riskKeys: string[];
}

const TASK_TABLE: Record<SurvivorTaskType, TaskDefinition> = {
  SCAVENGE: {
    baseRisk: 0.35,
    baseReward: 1.6,
    primarySpecialty: "SCAVENGER",
    secondarySpecialty: "DEFENDER",
    narrative: {
      success: [
        "A derelict convoy yields intact ration crates.",
        "They locate a secure supply cache hidden beneath debris.",
      ],
      failure: [
        "Noise from collapsing rubble alerts nearby infected.",
        "A rival faction intercepts the team before they return home.",
      ],
    },
    rewardKeys: ["materials", "supplies"],
    riskKeys: ["injury", "morale"],
  },
  DEFEND: {
    baseRisk: 0.25,
    baseReward: 1,
    primarySpecialty: "DEFENDER",
    secondarySpecialty: "SCAVENGER",
    narrative: {
      success: [
        "Patrols fortify weak points along the walls.",
        "They repel probing attacks without casualties.",
      ],
      failure: [
        "An ambush from sewer tunnels catches the guard off balance.",
        "A supply line is severed during a night raid.",
      ],
    },
    rewardKeys: ["stability", "intel"],
    riskKeys: ["injury", "structure"],
  },
  RESEARCH: {
    baseRisk: 0.15,
    baseReward: 1.2,
    primarySpecialty: "RESEARCHER",
    secondarySpecialty: "MEDIC",
    narrative: {
      success: [
        "Breakthrough! A captured sample yields vaccine insights.",
        "Recovered schematics unlock an upgrade blueprint.",
      ],
      failure: [
        "An experiment destabilises containment protocols.",
        "Valuable lab time is lost to equipment failure.",
      ],
    },
    rewardKeys: ["research", "insight"],
    riskKeys: ["contamination", "morale"],
  },
  HUMANITARIAN: {
    baseRisk: 0.2,
    baseReward: 0.9,
    primarySpecialty: "MEDIC",
    secondarySpecialty: "SCAVENGER",
    narrative: {
      success: [
        "Civilians accept aid and agree to relocate inside the perimeter.",
        "Word of the relief convoy boosts morale across the camp.",
      ],
      failure: [
        "Negotiations sour when a splinter group demands tribute.",
        "The convoy is slowed by refugees and nightfall overtakes them.",
      ],
    },
    rewardKeys: ["morale", "allies"],
    riskKeys: ["supplies", "hostility"],
  },
};

const DEFAULT_RNG = () => Math.random();

function getSpecialtyModifier(survivor: Survivor, specialty?: SurvivorSpecialty): number {
  if (!specialty) return 0;
  const value = survivor.specialties?.[specialty] ?? 0;
  return value * 0.1;
}

function computeEffectiveRisk(
  survivor: Survivor,
  task: TaskDefinition,
  moraleModifier: number,
): number {
  const fatiguePenalty = survivor.stamina < 30 ? 0.15 : survivor.stamina < 60 ? 0.05 : 0;
  const specialtyMitigation =
    getSpecialtyModifier(survivor, task.primarySpecialty) * 0.4 +
    getSpecialtyModifier(survivor, task.secondarySpecialty) * 0.2;
  const rankMitigation = survivor.rank * 0.03;
  const moraleShift = moraleModifier * 0.05;
  const rawRisk = task.baseRisk + fatiguePenalty - specialtyMitigation - rankMitigation - moraleShift;
  return Math.max(0.05, Math.min(0.95, rawRisk));
}

function computeRewardMultiplier(survivor: Survivor, task: TaskDefinition, moraleModifier: number): number {
  const specialtyBonus =
    getSpecialtyModifier(survivor, task.primarySpecialty) * 0.4 +
    getSpecialtyModifier(survivor, task.secondarySpecialty) * 0.2;
  const rankBonus = survivor.rank * 0.08;
  const moraleBonus = moraleModifier * 0.1;
  return task.baseReward + specialtyBonus + rankBonus + moraleBonus;
}

function buildOutcome(
  assignment: TaskAssignment,
  survivor: Survivor,
  task: TaskDefinition,
  successRoll: number,
): TaskOutcome {
  const moraleModifier = survivor.morale;
  const risk = computeEffectiveRisk(survivor, task, moraleModifier);
  const success = successRoll > risk;
  const rewardMultiplier = computeRewardMultiplier(survivor, task, moraleModifier);

  const rewards: Record<string, number> = {};
  task.rewardKeys.forEach((key) => {
    const base = success ? rewardMultiplier : rewardMultiplier * 0.2;
    rewards[key] = Number(base.toFixed(2));
  });

  const risks: Record<string, number> = {};
  task.riskKeys.forEach((key) => {
    let magnitude = risk * 10;
    if (!success) {
      magnitude *= 1.5;
    } else {
      magnitude *= 0.5;
    }
    risks[key] = Number((magnitude * (success ? -1 : 1)).toFixed(2));
  });

  const narrativePool = success ? task.narrative.success : task.narrative.failure;
  const narrativeHook = narrativePool[Math.floor(successRoll * narrativePool.length)] ?? narrativePool[0];

  return {
    survivorId: assignment.survivorId,
    task: assignment.task,
    success,
    rewards,
    risks,
    narrativeHook,
  };
}

function applyPostOutcomeFatigue(survivor: Survivor, outcome: TaskOutcome): Survivor {
  const fatigueCost = outcome.success ? 12 : 20;
  const moraleShift = outcome.success ? 0.05 : -0.1;
  return {
    ...survivor,
    stamina: Math.max(0, survivor.stamina - fatigueCost),
    morale: Math.max(
      -1,
      Math.min(1, survivor.morale + moraleShift + (outcome.risks.morale ?? 0)),
    ),
  };
}

function averageRisk(outcomes: TaskOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const total = outcomes.reduce((sum, outcome) => sum + Math.abs(outcome.risks.injury ?? 0), 0);
  return total / outcomes.length;
}

/**
 * Assign a batch of survivors to tasks and resolve the turn.  The survivors
 * array is treated as immutable; updated survivor snapshots are returned so the
 * caller can persist the new stamina/morale values.
 */
export function resolveAssignments(
  survivors: Survivor[],
  assignments: TaskAssignment[],
  options: AssignmentOptions = {},
): { survivors: Survivor[]; summary: AssignmentSummary } {
  const rng = options.rng ?? DEFAULT_RNG;
  const survivorMap = new Map(survivors.map((s) => [s.id, s] as const));

  const outcomes: TaskOutcome[] = [];
  const casualties: string[] = [];
  const updatedSurvivors = new Map<string, Survivor>();

  for (const assignment of assignments) {
    const survivor = updatedSurvivors.get(assignment.survivorId) ?? survivorMap.get(assignment.survivorId);
    if (!survivor) {
      continue;
    }

    if (survivor.stamina <= 5) {
      outcomes.push({
        survivorId: survivor.id,
        task: assignment.task,
        success: false,
        rewards: {},
        risks: { exhaustion: 1 },
        narrativeHook: `${survivor.name} is too exhausted to take on more work.`,
      });
      continue;
    }

    const taskDef = TASK_TABLE[assignment.task];
    if (!taskDef) {
      outcomes.push({
        survivorId: survivor.id,
        task: assignment.task,
        success: false,
        rewards: {},
        risks: {},
        narrativeHook: `Unknown task type: ${assignment.task}`,
      });
      continue;
    }

    const successRoll = rng();
    const outcome = buildOutcome(assignment, survivor, taskDef, successRoll);
    outcomes.push(outcome);

    if (!outcome.success && Math.abs(outcome.risks.injury ?? 0) > 5 && successRoll < 0.1) {
      casualties.push(survivor.id);
      updatedSurvivors.delete(survivor.id);
      continue;
    }

    const updated = applyPostOutcomeFatigue(survivor, outcome);
    updatedSurvivors.set(updated.id, updated);
  }

  const survivorsAfter = survivors.map((s) => updatedSurvivors.get(s.id) ?? s);

  return {
    survivors: survivorsAfter,
    summary: {
      outcomes,
      casualties,
      pressureScore: Number(averageRisk(outcomes).toFixed(2)),
    },
  };
}
