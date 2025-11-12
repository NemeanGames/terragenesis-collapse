import type { GameSnapshot, GameEvent, ResourceMap, EnvironmentState } from "../../state/types";

interface EventTemplate {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "danger";
  condition: (snapshot: GameSnapshot) => boolean;
  effect: (snapshot: GameSnapshot) => {
    resources?: Partial<ResourceMap>;
    environment?: Partial<EnvironmentState>;
    hostilityDelta?: number;
    moraleDelta?: number;
  };
}

const eventTemplates: EventTemplate[] = [
  {
    id: "supply-drop",
    title: "UN Supply Capsule Located",
    body: "Scavengers intercepted a pre-war supply drop beacon. Credits influx!",
    severity: "info",
    condition: (snapshot) => snapshot.resources.credits < 600,
    effect: () => ({
      resources: { credits: 120 }
    })
  },
  {
    id: "oxygen-leak",
    title: "Oxygen Leak",
    body: "An extractor duct cracked. Oxygen reserves dip and morale suffers.",
    severity: "warning",
    condition: (snapshot) => snapshot.environment.oxygen > 0.62,
    effect: () => ({
      resources: { oxygenReserve: -25 },
      moraleDelta: -4
    })
  },
  {
    id: "horde-scouts",
    title: "Horde Scouts",
    body: "Scouts report shamblers probing the barricades. Hostility rising.",
    severity: "danger",
    condition: (snapshot) => snapshot.hostility < 65,
    effect: () => ({
      hostilityDelta: 8
    })
  }
];

export interface EvaluatedEvent {
  event: GameEvent;
  effect: ReturnType<EventTemplate["effect"]>;
}

export function evaluateRandomEvent(snapshot: GameSnapshot): EvaluatedEvent | null {
  const rng = Math.random();
  const eligible = eventTemplates.filter((tpl) => tpl.condition(snapshot));
  if (eligible.length === 0) return null;
  if (rng < 0.45) return null;
  const picked = eligible[Math.floor(Math.random() * eligible.length)];
  const effect = picked.effect(snapshot);
  const event: GameEvent = {
    id: `${picked.id}-${Date.now()}`,
    title: picked.title,
    body: picked.body,
    severity: picked.severity,
    timestamp: Date.now()
  };
  return { event, effect };
}
