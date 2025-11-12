/**
 * Hostility management models the mounting pressure from hostile forces.
 *
 * The meter is influenced by three main vectors:
 *  - **Time pressure**: the longer a zone is left unattended the more the hordes gather.
 *  - **Noise**: facilities and survivor actions produce attention.
 *  - **Mission choices**: aggressive or loud missions spike hostility while
 *    diplomatic actions can temporarily relieve it.
 *
 * Retaliatory events are generated whenever an escalation threshold is crossed
 * or noise spikes past safe limits.  The higher the escalation stage, the more
 * severe the retaliation that is queued for the event engine.
 */

export type HostilityStage = 0 | 1 | 2 | 3;

export type RetaliationKind = "RAID" | "SIEGE" | "SABOTAGE";

export interface RetaliationEvent {
  /** Stable identifier so the event engine can debounce duplicates. */
  id: string;
  kind: RetaliationKind;
  /** Target facility identifier; the UI can highlight the structure. */
  facilityId?: string;
  /**
   * Estimated turns or minutes before the retaliation lands.  The event engine
   * can use this to schedule follow-up cards.
   */
  etaMinutes: number;
  /** Severity multiplier for downstream effects. */
  severity: number;
  /** Optional flavour text hook. */
  prompt: string;
}

export interface HostilityState {
  /** Normalised 0-100 hostility meter. */
  level: number;
  /** Cumulative noise generated during the current day/night cycle. */
  accumulatedNoise: number;
  /** Running average of recent mission risk. */
  missionPressure: number;
  /** Tracks the highest escalation stage reached. */
  escalationStage: HostilityStage;
  /** Used for delta calculations when performing a tick update. */
  lastUpdatedAt: number;
  /** Retaliation queue to be consumed by the event engine. */
  pendingRetaliations: RetaliationEvent[];
}

export interface HostilityTickContext {
  /** Milliseconds since the previous update. */
  elapsedMs: number;
  /** Ambient noise from facilities (0-1). */
  ambientNoise: number;
  /** Additional mission threat or relief (negative values reduce hostility). */
  missionImpact: number;
}

export interface HostilityTickResult {
  state: HostilityState;
  /** Net change applied to the hostility meter. */
  hostilityDelta: number;
  /** Newly enqueued retaliations. */
  triggeredRetaliations: RetaliationEvent[];
  /** True if the escalation stage increased. */
  escalated: boolean;
}

const HOSTILITY_MAX = 100;
const HOSTILITY_MIN = 0;

const ESCALATION_THRESHOLDS: Record<HostilityStage, number> = {
  0: 0,
  1: 30,
  2: 60,
  3: 85,
};

/** Rate at which hostility rises per real-time minute when idle. */
const BASE_TIME_RATE = 0.04; // ~4% every 100 minutes when idle.

/**
 * Noise is sticky: once the accumulated noise crosses this limit a retaliation
 * is forced even without an escalation bump.
 */
const NOISE_RETALIATION_THRESHOLD = 18;

/** Mission pressure is damped towards zero each tick using this factor. */
const MISSION_DECAY = 0.92;

export function createHostilityState(now: number = Date.now()): HostilityState {
  return {
    level: 5,
    accumulatedNoise: 0,
    missionPressure: 0,
    escalationStage: 0,
    lastUpdatedAt: now,
    pendingRetaliations: [],
  };
}

/** Utility to clamp a numeric value into a bounded range. */
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

function computeEscalationStage(level: number): HostilityStage {
  if (level >= ESCALATION_THRESHOLDS[3]) return 3;
  if (level >= ESCALATION_THRESHOLDS[2]) return 2;
  if (level >= ESCALATION_THRESHOLDS[1]) return 1;
  return 0;
}

function makeRetaliation(
  stage: HostilityStage,
  noiseBurst: number,
  missionImpact: number,
): RetaliationEvent {
  const severity = stage + 1 + Math.max(0, noiseBurst) * 0.25 + Math.max(0, missionImpact);
  const raidKind: RetaliationKind =
    stage >= 3 ? "SIEGE" : stage >= 2 ? "SABOTAGE" : "RAID";

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: raidKind,
    facilityId: undefined,
    etaMinutes: clamp(30 - stage * 8 - noiseBurst * 1.5, 5, 35),
    severity: clamp(severity, 1, 8),
    prompt:
      raidKind === "SIEGE"
        ? "Scouts report a massed horde marching directly on headquarters."
        : raidKind === "SABOTAGE"
        ? "Saboteurs have infiltrated the perimeter and are targeting power conduits."
        : "A raiding party has been spotted approaching the outer defenses.",
  };
}

/**
 * Apply a tick to the hostility state.  The function is pure: it clones the
 * state, applies the delta and returns the updated copy alongside any newly
 * generated retaliation events.
 */
export function tickHostility(
  previous: HostilityState,
  context: HostilityTickContext,
): HostilityTickResult {
  const state: HostilityState = {
    ...previous,
    pendingRetaliations: [...previous.pendingRetaliations],
  };

  const elapsedMinutes = context.elapsedMs / 1000 / 60;
  const baseIncrease = elapsedMinutes * BASE_TIME_RATE * 100;
  const noiseIncrease = context.ambientNoise * 6;
  state.accumulatedNoise += context.ambientNoise * elapsedMinutes * 10;

  const missionDelta = context.missionImpact * 8;
  state.missionPressure = state.missionPressure * MISSION_DECAY + missionDelta;

  const hostilityDelta = baseIncrease + noiseIncrease + missionDelta * 0.6;
  state.level = clamp(state.level + hostilityDelta, HOSTILITY_MIN, HOSTILITY_MAX);
  state.lastUpdatedAt += context.elapsedMs;

  const newStage = computeEscalationStage(state.level);
  const triggeredRetaliations: RetaliationEvent[] = [];
  let escalated = false;

  if (newStage > state.escalationStage) {
    escalated = true;
    state.escalationStage = newStage;
    const retaliation = makeRetaliation(newStage, state.accumulatedNoise, context.missionImpact);
    state.pendingRetaliations.push(retaliation);
    triggeredRetaliations.push(retaliation);
    state.accumulatedNoise = 0; // reset noise after major response
  }

  if (!escalated && state.accumulatedNoise >= NOISE_RETALIATION_THRESHOLD) {
    const retaliation = makeRetaliation(newStage, state.accumulatedNoise, context.missionImpact);
    state.pendingRetaliations.push(retaliation);
    triggeredRetaliations.push(retaliation);
    state.accumulatedNoise *= 0.25; // dampen but retain some memory
  }

  // Mission relief can reduce hostility below the current stage.  When that
  // happens we also bleed off accumulated noise to represent the lull.
  const postStage = computeEscalationStage(state.level);
  if (postStage < state.escalationStage) {
    state.escalationStage = postStage;
    state.accumulatedNoise *= 0.4;
  }

  return {
    state,
    hostilityDelta,
    triggeredRetaliations,
    escalated,
  };
}

/**
 * Injects direct hostility changes coming from explicit mission choices.  The
 * value is added to both the meter and the mission pressure tracker to allow
 * the UI to visualise how recent operations affect the threat level.
 */
export function applyMissionChoice(
  previous: HostilityState,
  missionImpact: number,
): HostilityState {
  const state = {
    ...previous,
    pendingRetaliations: [...previous.pendingRetaliations],
  };
  state.level = clamp(state.level + missionImpact * 10, HOSTILITY_MIN, HOSTILITY_MAX);
  state.missionPressure = state.missionPressure + missionImpact * 6;

  if (missionImpact > 0 && state.escalationStage < 3) {
    const nextThreshold = ESCALATION_THRESHOLDS[(state.escalationStage + 1) as HostilityStage];
    if (state.level >= nextThreshold) {
      const stage = computeEscalationStage(state.level);
      if (stage > state.escalationStage) {
        state.escalationStage = stage;
        const retaliation = makeRetaliation(stage, state.accumulatedNoise, missionImpact);
        state.pendingRetaliations.push(retaliation);
      }
    }
  }

  if (missionImpact < 0) {
    state.accumulatedNoise = Math.max(0, state.accumulatedNoise + missionImpact * 4);
  }

  return state;
}

/**
 * Pulls the next retaliation in the queue.  Consumers should pop one event at
 * a time so they can be scheduled as part of the narrative engine.
 */
export function dequeueRetaliation(state: HostilityState): [RetaliationEvent | undefined, HostilityState] {
  if (state.pendingRetaliations.length === 0) {
    return [undefined, state];
  }

  const [next, ...rest] = state.pendingRetaliations;
  return [next, { ...state, pendingRetaliations: rest }];
}

/** Serialises the hostility state for persistence. */
export function serialiseHostility(state: HostilityState): string {
  return JSON.stringify(state);
}

/** Restores the hostility state from a stored payload. */
export function deserialiseHostility(payload: string | null | undefined): HostilityState {
  if (!payload) {
    return createHostilityState();
  }

  try {
    const raw = JSON.parse(payload);
    const result: HostilityState = {
      ...createHostilityState(),
      ...raw,
      lastUpdatedAt: typeof raw.lastUpdatedAt === "number" ? raw.lastUpdatedAt : Date.now(),
      level: clamp(typeof raw.level === "number" ? raw.level : 5, HOSTILITY_MIN, HOSTILITY_MAX),
      accumulatedNoise: Math.max(0, Number(raw.accumulatedNoise) || 0),
      missionPressure: Number(raw.missionPressure) || 0,
      escalationStage: computeEscalationStage(Number(raw.level) || 0),
      pendingRetaliations: Array.isArray(raw.pendingRetaliations)
        ? raw.pendingRetaliations.map((item: RetaliationEvent) => ({
            ...item,
            kind: item.kind ?? "RAID",
            etaMinutes: clamp(item.etaMinutes ?? 20, 1, 60),
            severity: clamp(item.severity ?? 1, 1, 10),
          }))
        : [],
    };
    return result;
  } catch (error) {
    console.warn("Failed to parse hostility payload", error);
    return createHostilityState();
  }
}
