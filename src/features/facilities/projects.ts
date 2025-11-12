import type { Project } from "../../state/types";

export const PROJECT_LIBRARY: Project[] = [
  {
    id: "pressurePulse",
    name: "Pressure Pulse Injectors",
    remainingHours: 12,
    totalHours: 12,
    reward: {
      environment: { pressure: 0.04 },
      resources: { research: 18 },
      moraleDelta: 2
    }
  },
  {
    id: "sporeShield",
    name: "Spore Shield Deployment",
    remainingHours: 16,
    totalHours: 16,
    reward: {
      hostilityDelta: -12,
      moraleDelta: 3,
      resources: { credits: 80 }
    }
  },
  {
    id: "hydroCycle",
    name: "Hydro Cycle Tuners",
    remainingHours: 10,
    totalHours: 10,
    reward: {
      environment: { water: 0.05, oxygen: 0.03 },
      resources: { oxygenReserve: 20 }
    }
  }
];
