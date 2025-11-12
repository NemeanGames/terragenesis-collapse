export type SurvivorSpecialty = "SCAVENGER" | "DEFENDER" | "RESEARCHER" | "MEDIC";

export interface Survivor {
  id: string;
  name: string;
  /** Represents overall experience level 0-5. */
  rank: number;
  stamina: number; // 0-100 scale used to throttle assignments
  specialties: Partial<Record<SurvivorSpecialty, number>>;
  morale: number; // -1 to 1 modifier applied to risk/reward rolls
}

export type SurvivorTaskType = "SCAVENGE" | "DEFEND" | "RESEARCH" | "HUMANITARIAN";

export interface TaskAssignment {
  survivorId: string;
  task: SurvivorTaskType;
  /** Additional context such as target zone or facility. */
  metadata?: Record<string, unknown>;
}

export interface TaskOutcome {
  survivorId: string;
  task: SurvivorTaskType;
  success: boolean;
  /** Resource yields (materials, intel, supplies). */
  rewards: Record<string, number>;
  /** Injuries or morale loss expressed as numeric changes. */
  risks: Record<string, number>;
  narrativeHook: string;
}

export interface AssignmentSummary {
  outcomes: TaskOutcome[];
  casualties: string[];
  /** Average risk so the hostility system can infer pressure. */
  pressureScore: number;
}

export interface AssignmentOptions {
  /**
   * Optional deterministic random number generator.  If omitted, Math.random is
   * used.  The function should return a float in the range [0, 1).
   */
  rng?: () => number;
}
