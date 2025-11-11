import { useMemo } from "react";
import { useGameStore } from "../state/gameState";

const severityPalette: Record<string, string> = {
  info: "rgba(56,189,248,0.18)",
  warning: "rgba(250,204,21,0.2)",
  danger: "rgba(248,113,113,0.2)"
};

const severityText: Record<string, string> = {
  info: "#bae6fd",
  warning: "#fef08a",
  danger: "#fecaca"
};

export default function EventLogPanel() {
  const events = useGameStore((state) => state.events);

  const sorted = useMemo(() => [...events].sort((a, b) => b.timestamp - a.timestamp), [events]);

  return (
    <div
      style={{
        background: "rgba(12,17,26,0.85)",
        borderRadius: 16,
        padding: "16px 18px",
        border: "1px solid rgba(56,189,248,0.22)",
        boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxHeight: 360,
        overflowY: "auto"
      }}
    >
      <h3 style={{ margin: 0, fontSize: "1rem" }}>Radio Log</h3>
      {sorted.length === 0 && <p style={{ opacity: 0.6 }}>No transmissions yet.</p>}
      {sorted.map((event) => (
        <article
          key={event.id}
          style={{
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,0.18)",
            background: severityPalette[event.severity] ?? "rgba(30,64,175,0.12)",
            padding: "10px 12px"
          }}
        >
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: severityText[event.severity] ?? "inherit" }}>{event.title}</strong>
            <time style={{ fontSize: "0.7rem", opacity: 0.6 }}>
              {new Date(event.timestamp).toLocaleTimeString()}
            </time>
          </header>
          <p style={{ margin: "6px 0 0", fontSize: "0.85rem", opacity: 0.85 }}>{event.body}</p>
        </article>
      ))}
    </div>
  );
}
