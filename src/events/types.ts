import { HostilityState } from "../state/hostility";
import { AssignmentSummary } from "../features/survivors";

export interface RadioMessage {
  id: string;
  timestamp: number;
  text: string;
  tone: "INFO" | "ALERT" | "SUCCESS" | "DISTRESS";
}

export interface BranchingConsequence {
  /** Narrative description displayed in the event UI. */
  description: string;
  /** Optional change to the hostility meter. */
  hostilityDelta?: number;
  /** Resources or stats modified by the choice. */
  resourceDelta?: Record<string, number>;
  /** Survivors returning from the mission. */
  survivorSummary?: AssignmentSummary;
  /** Cards queued after this choice resolves. */
  followUp?: NarrativeCard | NarrativeCard[] | (() => NarrativeCard | NarrativeCard[]);
}

export interface NarrativeChoice {
  id: string;
  label: string;
  consequence: BranchingConsequence;
}

export interface NarrativeCard {
  id: string;
  title: string;
  body: string;
  /** Optional visual identifier to map to UI art. */
  illustration?: string;
  /** Thematic tags so the deck can filter by tone. */
  tags?: string[];
  choices: NarrativeChoice[];
}

export interface EventResolution {
  applied: BranchingConsequence;
  updatedHostility?: HostilityState;
  radioMessages: RadioMessage[];
  queuedCards: NarrativeCard[];
}

export interface EventContext {
  /** Latest hostility snapshot so consequences can mutate it. */
  hostility: HostilityState;
  /** Callback used to persist hostility updates externally. */
  commitHostility: (state: HostilityState) => void;
  /** Emits radio messages for UI consumption. */
  emitRadio: (message: RadioMessage) => void;
}
