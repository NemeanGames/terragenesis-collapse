import type { ResourceKey } from "../../state/types";

export type FacilityId = "hab" | "solar" | "water" | "lab" | "barricade";

export interface FacilityDefinition {
  id: FacilityId;
  name: string;
  description: string;
  buildTimeHours: number;
  cost: Partial<Record<ResourceKey, number>>;
  upkeep: Partial<Record<ResourceKey, number>>;
  outputs: Partial<Record<ResourceKey, number>>;
  moraleBonus?: number;
  hostilityModifier?: number;
  unlocks?: string[];
}

export const FACILITIES: FacilityDefinition[] = [
  {
    id: "hab",
    name: "Habitation Pods",
    description: "Boost survivor capacity and morale stability.",
    buildTimeHours: 6,
    cost: { credits: 120, supplies: 30 },
    upkeep: { supplies: 2 },
    outputs: { credits: 2 },
    moraleBonus: 3
  },
  {
    id: "solar",
    name: "Solar Array",
    description: "Generates credits and research trickles.",
    buildTimeHours: 5,
    cost: { credits: 150 },
    upkeep: {},
    outputs: { credits: 6, research: 1.4 }
  },
  {
    id: "water",
    name: "Atmospheric Extractor",
    description: "Stabilises oxygen and water reserves.",
    buildTimeHours: 7,
    cost: { credits: 130, supplies: 18 },
    upkeep: { credits: 1 },
    outputs: { oxygenReserve: 4.5 },
    hostilityModifier: -0.4
  },
  {
    id: "lab",
    name: "Biolab Dome",
    description: "Accelerates terraforming research.",
    buildTimeHours: 8,
    cost: { credits: 180, research: 25 },
    upkeep: { credits: 3 },
    outputs: { research: 4.5 },
    unlocks: ["sporeShield"]
  },
  {
    id: "barricade",
    name: "Perimeter Barricades",
    description: "Reduces hostility escalation per tick.",
    buildTimeHours: 4,
    cost: { credits: 80, biofuel: 12 },
    upkeep: { biofuel: 1 },
    outputs: {},
    hostilityModifier: -1.6
  }
];

export function facilityById(id: FacilityId) {
  return FACILITIES.find((f) => f.id === id);
}
