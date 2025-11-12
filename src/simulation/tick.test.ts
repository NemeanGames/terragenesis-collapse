import { describe, expect, it } from "vitest";
import { advanceTick } from "./tick";
import type { GameSnapshot, Project } from "../state/types";

function makeSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  const base: GameSnapshot = {
    resources: {
      credits: 400,
      biofuel: 60,
      research: 30,
      oxygenReserve: 100,
      supplies: 80
    },
    environment: { pressure: 0.3, temperature: 0.28, oxygen: 0.5, water: 0.4 },
    survivors: [
      { id: "s1", name: "Test 1", role: "scavenge", skill: 1 },
      { id: "s2", name: "Test 2", role: "terraform", skill: 1 }
    ],
    facilities: [
      { id: "hab", count: 1 },
      { id: "solar", count: 1 },
      { id: "water", count: 0 },
      { id: "lab", count: 0 },
      { id: "barricade", count: 0 }
    ],
    hostility: 20,
    morale: 60,
    activeProjects: [],
    tickLengthMinutes: 30
  };
  return { ...base, ...overrides };
}

describe("advanceTick", () => {
  it("produces positive resource deltas from facilities and survivors", () => {
    const snapshot = makeSnapshot();
    const result = advanceTick(snapshot, snapshot.tickLengthMinutes, 1.5);
    expect(result.resourceDelta.credits).toBeGreaterThan(0);
    expect(result.resourceDelta.research).toBeGreaterThan(0);
  });

  it("reduces remaining hours on active projects and marks completion", () => {
    const project: Project = {
      id: "proj-1",
      name: "Test",
      remainingHours: 0.1,
      totalHours: 1,
      reward: {
        resources: { credits: 10 }
      }
    };
    const snapshot = makeSnapshot({ activeProjects: [project] });
    const result = advanceTick(snapshot, snapshot.tickLengthMinutes, 1.5);
    const progress = result.projects.find((p) => p.id === project.id);
    expect(progress?.completed).toBe(true);
    expect(result.resourceDelta.credits ?? 0).toBeGreaterThan(0);
  });
});
