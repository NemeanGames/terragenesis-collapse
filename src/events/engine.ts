import { applyMissionChoice } from "../state/hostility";
import {
  BranchingConsequence,
  EventContext,
  EventResolution,
  NarrativeCard,
  NarrativeChoice,
  RadioMessage,
} from "./types";

function normaliseArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function makeRadioMessage(text: string, tone: RadioMessage["tone"]): RadioMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    text,
    tone,
  };
}

export class EventEngine {
  private queue: NarrativeCard[] = [];
  private radioLog: RadioMessage[] = [];

  constructor(initialCards: NarrativeCard[] = []) {
    this.queue = [...initialCards];
  }

  get pendingCards(): readonly NarrativeCard[] {
    return this.queue;
  }

  get latestRadioMessages(): readonly RadioMessage[] {
    return this.radioLog.slice(-25);
  }

  enqueue(card: NarrativeCard | NarrativeCard[]): void {
    const items = Array.isArray(card) ? card : [card];
    this.queue.push(...items);
  }

  /**
   * Peek at the current narrative card without dequeuing it.  Returns undefined
   * if the queue is empty.
   */
  peek(): NarrativeCard | undefined {
    return this.queue[0];
  }

  /**
   * Remove the current card from the queue without resolving it.  Useful when
   * a card expires due to timeouts or external triggers.
   */
  discardCurrent(): NarrativeCard | undefined {
    return this.queue.shift();
  }

  private resolveConsequence(
    choice: NarrativeChoice,
    context: EventContext,
  ): { consequence: BranchingConsequence; followUps: NarrativeCard[]; messages: RadioMessage[] } {
    const { consequence } = choice;
    const messages: RadioMessage[] = [];

    if (consequence.description) {
      const tone: RadioMessage["tone"] = consequence.hostilityDelta && consequence.hostilityDelta > 0 ? "ALERT" : "INFO";
      messages.push(makeRadioMessage(consequence.description, tone));
    }

    if (typeof consequence.hostilityDelta === "number" && consequence.hostilityDelta !== 0) {
      const updated = applyMissionChoice(context.hostility, consequence.hostilityDelta);
      context.hostility = updated;
      context.commitHostility(updated);
      messages.push(
        makeRadioMessage(
          consequence.hostilityDelta > 0
            ? "Hostility rises in response to your decision."
            : "Tensions ease as the zone takes a breath.",
          consequence.hostilityDelta > 0 ? "ALERT" : "SUCCESS",
        ),
      );
    }

    const followUps = normaliseArray(
      typeof consequence.followUp === "function" ? consequence.followUp() : consequence.followUp,
    );

    followUps.forEach((card) => {
      messages.push(
        makeRadioMessage(`New Intel: ${card.title}`, card.tags?.includes("danger") ? "ALERT" : "INFO"),
      );
    });

    if (consequence.resourceDelta) {
      const summary = Object.entries(consequence.resourceDelta)
        .map(([key, value]) => `${value >= 0 ? "+" : ""}${value} ${key}`)
        .join(", ");
      messages.push(makeRadioMessage(`Resource update: ${summary}`, "INFO"));
    }

    if (consequence.survivorSummary) {
      messages.push(
        makeRadioMessage(
          `Team reports ${consequence.survivorSummary.outcomes.length} outcomes with ` +
            `${consequence.survivorSummary.casualties.length} casualties.`,
          consequence.survivorSummary.casualties.length > 0 ? "DISTRESS" : "INFO",
        ),
      );
    }

    return { consequence, followUps, messages };
  }

  resolveCurrent(choiceId: string, context: EventContext): EventResolution | undefined {
    const card = this.queue.shift();
    if (!card) return undefined;

    const choice = card.choices.find((item) => item.id === choiceId);
    if (!choice) {
      // Push the card back since no valid choice was made.
      this.queue.unshift(card);
      return undefined;
    }

    const { consequence, followUps, messages } = this.resolveConsequence(choice, context);

    this.enqueue(followUps);
    messages.forEach((message) => {
      this.radioLog.push(message);
      context.emitRadio(message);
    });

    // Trim radio log to the latest 50 messages to avoid unbounded growth.
    if (this.radioLog.length > 50) {
      this.radioLog.splice(0, this.radioLog.length - 50);
    }

    return {
      applied: consequence,
      updatedHostility: context.hostility,
      radioMessages: messages,
      queuedCards: followUps,
    };
  }
}
