import { useMemo } from "react";
import { useGameStore } from "../state/gameState";
import type { ResourceKey } from "../state/types";

const resourceLabels: Record<ResourceKey, { label: string; icon: string }> = {
  credits: { label: "Credits", icon: "🪙" },
  biofuel: { label: "Biofuel", icon: "🛢️" },
  research: { label: "Research", icon: "🔬" },
  oxygenReserve: { label: "O₂ Reserve", icon: "🫧" },
  supplies: { label: "Supplies", icon: "📦" }
};

function StatRow({ label, value, icon }: { label: string; value: number; icon?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        fontSize: "0.95rem"
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <span style={{ fontSize: "1.1rem" }}>{icon}</span>}
        <span>{label}</span>
      </span>
      <strong style={{ fontVariantNumeric: "tabular-nums" }}>{value.toFixed(0)}</strong>
    </div>
  );
}

function Gauge({ value, label }: { value: number; label: string }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  const gradient = value >= 0.66 ? "#34d399" : value >= 0.33 ? "#facc15" : "#f87171";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
        <span>{label}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 9999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
          marginTop: 4
        }}
      >
        <div style={{ width: `${pct}%`, background: gradient, height: "100%" }} />
      </div>
    </div>
  );
}

export default function StatsPanel() {
  const { resources, environment, environmentTargets, hostility, morale, isPaused, togglePause } =
    useGameStore((state) => ({
      resources: state.resources,
      environment: state.environment,
      environmentTargets: state.environmentTargets,
      hostility: state.hostility,
      morale: state.morale,
      isPaused: state.isPaused,
      togglePause: state.togglePause
    }));

  const environmentRatios = useMemo(() => {
    return Object.entries(environment).map(([key, value]) => {
      const target = environmentTargets[key as keyof typeof environmentTargets];
      const ratio = value / target;
      return {
        key,
        ratio: Math.min(1.25, ratio)
      };
    });
  }, [environment, environmentTargets]);

  return (
    <div
      style={{
        background: "rgba(17, 23, 34, 0.85)",
        borderRadius: 16,
        padding: "16px 18px",
        border: "1px solid rgba(88,166,255,0.18)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Camp Overview</h2>
          <small style={{ opacity: 0.65 }}>Operational metrics updated every tick.</small>
        </div>
        <button
          onClick={togglePause}
          style={{
            borderRadius: 9999,
            padding: "6px 14px",
            border: "1px solid rgba(88,166,255,0.4)",
            background: isPaused ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)",
            color: isPaused ? "#fca5a5" : "#bbf7d0"
          }}
        >
          {isPaused ? "Resume" : "Pause"}
        </button>
      </header>

      <div>
        {Object.entries(resources).map(([key, value]) => {
          const meta = resourceLabels[key as ResourceKey];
          return <StatRow key={key} label={meta.label} icon={meta.icon} value={value} />;
        })}
      </div>

      <div
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(8,12,20,0.9)",
          border: "1px solid rgba(148,163,184,0.18)"
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "1rem" }}>Terraforming</h3>
        {environmentRatios.map((entry) => (
          <Gauge key={entry.key} value={entry.ratio} label={entry.key} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div
          style={{
            padding: "10px",
            borderRadius: 12,
            background: "rgba(15,23,42,0.75)",
            border: "1px solid rgba(59,130,246,0.25)"
          }}
        >
          <h4 style={{ margin: 0, fontSize: "0.9rem", opacity: 0.75 }}>Hostility</h4>
          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{hostility.toFixed(1)}</div>
        </div>
        <div
          style={{
            padding: "10px",
            borderRadius: 12,
            background: "rgba(30,41,59,0.6)",
            border: "1px solid rgba(59,130,246,0.25)"
          }}
        >
          <h4 style={{ margin: 0, fontSize: "0.9rem", opacity: 0.75 }}>Morale</h4>
          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{morale.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}
