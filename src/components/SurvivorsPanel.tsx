import { useMemo } from "react";
import { useGameStore } from "../state/gameState";
import type { SurvivorRole } from "../state/types";

const roleLabels: Record<SurvivorRole, string> = {
  idle: "Idle",
  scavenge: "Scavenge",
  defend: "Defend",
  research: "Research",
  terraform: "Terraform"
};

const roleDescriptions: Record<SurvivorRole, string> = {
  idle: "Restores morale slowly.",
  scavenge: "Finds supplies, credits and biofuel.",
  defend: "Reduces hostility pressure.",
  research: "Generates research data.",
  terraform: "Pushes the environment toward targets."
};

export default function SurvivorsPanel() {
  const { survivors, assignSurvivor, morale } = useGameStore((state) => ({
    survivors: state.survivors,
    assignSurvivor: state.assignSurvivor,
    morale: state.morale
  }));

  const moraleMood = useMemo(() => {
    if (morale >= 80) return "Upbeat";
    if (morale >= 55) return "Steady";
    if (morale >= 35) return "Wary";
    return "Frail";
  }, [morale]);

  return (
    <div
      style={{
        background: "rgba(14,19,28,0.85)",
        borderRadius: 16,
        padding: "16px 18px",
        border: "1px solid rgba(96,165,250,0.2)",
        boxShadow: "0 10px 26px rgba(0,0,0,0.32)",
        display: "flex",
        flexDirection: "column",
        gap: 14
      }}
    >
      <header>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Survivor Roster</h3>
        <small style={{ opacity: 0.6 }}>Camp morale: {moraleMood}</small>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {survivors.map((survivor) => (
          <div
            key={survivor.id}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.2)",
              padding: "10px 12px",
              background: "rgba(8,12,20,0.75)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{survivor.name}</strong>
                <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>Skill {survivor.skill.toFixed(1)}</div>
              </div>
              <select
                value={survivor.role}
                onChange={(event) => assignSurvivor(survivor.id, event.target.value as SurvivorRole)}
                style={{
                  background: "rgba(15,23,42,0.75)",
                  border: "1px solid rgba(96,165,250,0.3)",
                  borderRadius: 8,
                  padding: "6px 8px",
                  color: "inherit"
                }}
              >
                {Object.entries(roleLabels).map(([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ marginBottom: 0, marginTop: 8, fontSize: "0.8rem", opacity: 0.7 }}>
              {roleDescriptions[survivor.role]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
